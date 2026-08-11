import { uid } from '@/lib/uid';
import type { BoqRow } from './types';
import { POSITION_NUMBER, classifyBoqCandidate, type ExcludedLine } from './boqRowRules';

/** A single word/text fragment positioned on a page. Y increases downward (screen/image convention). */
export interface PositionedToken {
  text: string;
  x: number;
  y: number;
  x2: number;
}

/** "TS-02", "TS-09" style reference codes — distinctive and reliably OCR'd. */
const REFERENCE_TOKEN = /^ts-?\d{2,3}$/i;
/** Pure numeric cell content (quantities), including EU decimal/composite forms like "637,0" or "1/0,3/0,2". */
const NUMERIC_CELL = /^[\d.,/]+$/;
/** Common construction units, including the predictable OCR substitution of a superscript ²/³ with "?". */
const LIKELY_UNIT_CELL = /^(?:vnt|km|kg|ha|kompl|kompl\.|val|pora|t|m|m[²³23?]|m[²³23?]?\/?t|m\/?t|vnt\.?(?:\/m[²³23?]?\/t)?)\.?$/i;
const OCR_UNIT_IN_TEXT = /^(?:vnt\.?\S*|km\.?|kg|ha|kompl\.?|val|pora|t|m\S{0,9})$/i;
const OCR_QUANTITY_IN_TEXT = /^\d[\d.,/]*$/;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Returns the left edge of the most frequently occupied X band (a table column), ignoring isolated
 * numbers or short words that happen to occur at the end of a long description. */
function dominantColumnStart(values: number[], tolerance = 70): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const cluster = clusters.at(-1);
    if (cluster && value - cluster.at(-1)! <= tolerance) cluster.push(value);
    else clusters.push([value]);
  }
  clusters.sort((a, b) => b.length - a.length || median(b) - median(a));
  return Math.min(...clusters[0]) - 8;
}

/**
 * Strips OCR misreads of table border/grid lines (stray "|", "-", brackets) from token text, and drops
 * tokens that are pure punctuation noise once stripped. Without this, a border character concatenated
 * onto a real position number or word (e.g. "|Kelio") breaks exact-pattern matching downstream.
 */
function cleanTokens(tokens: PositionedToken[]): PositionedToken[] {
  const out: PositionedToken[] = [];
  for (const t of tokens) {
    let text = t.text.replace(/^[|\-_=~[\](){}<>]+/, '').replace(/[|\-_=~[\](){}<>]+$/, '').trim();
    if (text && !/[a-ząčęėįšųūž0-9]/i.test(text)) text = '';
    if (text) out.push({ ...t, text });
  }
  return out;
}

/** Groups tokens into visual rows using a Y tolerance (chained), sorted top-to-bottom / left-to-right. */
function groupIntoRows(tokens: PositionedToken[], yTolerance: number): PositionedToken[][] {
  const sorted = [...tokens].sort((a, b) => a.y - b.y);
  const rows: PositionedToken[][] = [];
  for (const token of sorted) {
    const lastRow = rows[rows.length - 1];
    const lastY = lastRow ? lastRow[lastRow.length - 1].y : null;
    if (lastRow && lastY !== null && Math.abs(token.y - lastY) <= yTolerance) {
      lastRow.push(token);
    } else {
      rows.push([token]);
    }
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

type ValueColumnKey = 'name' | 'unit' | 'quantity' | 'reference';
type InternalColumnKey = ValueColumnKey | 'ignore';

interface ColumnAnchor {
  key: InternalColumnKey;
  x: number;
}

interface DetectedColumns {
  positionX: number;
  anchors: ColumnAnchor[];
}

interface XCluster {
  count: number;
  min: number;
  median: number;
}

function clusterXValues(values: number[], tolerance: number): XCluster[] {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const value of sorted) {
    const group = groups.at(-1);
    if (group && value - group.at(-1)! <= tolerance) group.push(value);
    else groups.push([value]);
  }
  return groups.map((group) => ({ count: group.length, min: Math.min(...group), median: median(group) }));
}

/**
 * Derives column X-boundaries from the shape of the body content itself, not the header row text.
 * Bold header rows are frequently unreadable to OCR (small bold text against grid lines), while the
 * body's position numbers ("1.1") and reference codes ("TS-02") are short, distinctive, and reliably
 * recognized — so they make a far more robust anchor than header keyword matching. The position number
 * itself is deliberately NOT one of these X-anchors — see extractPositionToken.
 */
function detectColumnAnchors(tokens: PositionedToken[]): DetectedColumns | null {
  const allPositionCandidates = tokens.filter((t) => POSITION_NUMBER.test(t.text.trim()));
  const referenceMatches = tokens.filter((t) => REFERENCE_TOKEN.test(t.text.trim()));
  if (allPositionCandidates.length < 2) return null;

  // The left-most repeated numeric X band is the position column. This must consider flat numbers as
  // well as dotted ones: prices such as 39.13 also match the dotted position syntax, so using all dotted
  // tokens would incorrectly calibrate the parser to a price column in local-estimate PDFs.
  const minX = Math.min(...tokens.map((t) => t.x));
  const maxX = Math.max(...tokens.map((t) => t.x2));
  const leftLimit = minX + (maxX - minX) * 0.4;
  const positionClusters = clusterXValues(allPositionCandidates.map((t) => t.x), 32)
    .filter((cluster) => cluster.count >= 2 && cluster.median <= leftLimit)
    .sort((a, b) => b.count - a.count || a.median - b.median);
  if (positionClusters.length === 0) return null;
  const positionX = positionClusters[0].median;

  const positionMatches = allPositionCandidates.filter((t) => Math.abs(t.x - positionX) <= 38);
  if (positionMatches.length < 2) return null;
  const referenceX = referenceMatches.length >= 2 ? median(referenceMatches.map((t) => t.x)) : null;

  // Name starts right after the position number on the same line — sample real gaps. A low percentile
  // (rather than the median) is used so the boundary sits safely left of essentially every real name
  // start, since a boundary that's too far right would clip the first word into the position value.
  const nameStartSamples: number[] = [];
  for (const posToken of positionMatches) {
    let best: PositionedToken | null = null;
    for (const t of tokens) {
      if (t === posToken) continue;
      if (Math.abs(t.y - posToken.y) > 8) continue;
      if (t.x <= posToken.x2) continue;
      if (!best || t.x < best.x) best = t;
    }
    if (best) nameStartSamples.push(best.x);
  }
  let nameX = positionX + 60;
  if (nameStartSamples.length > 0) {
    const sorted = [...nameStartSamples].sort((a, b) => a - b);
    nameX = sorted[Math.max(0, Math.floor(sorted.length * 0.15))] - 5;
  }

  // Unit and quantity are derived independently from repeated X bands. The TS/reference column is
  // optional: Lithuanian local estimates often continue with unit-price and total-price columns instead.
  const unitXs: number[] = [];
  for (const t of tokens) {
    const text = t.text.trim();
    if (!text || t.x <= nameX + 30 || (referenceX !== null && t.x >= referenceX - 20)) continue;
    if (LIKELY_UNIT_CELL.test(text.replace(/\s+/g, ''))) unitXs.push(t.x);
  }

  const anchors: ColumnAnchor[] = [{ key: 'name', x: nameX }];
  const unitX = dominantColumnStart(unitXs);
  if (unitX !== null) anchors.push({ key: 'unit', x: unitX });

  if (unitX !== null) {
    const numericClusters = clusterXValues(
      tokens
        .filter((t) => NUMERIC_CELL.test(t.text.trim()) && t.x > unitX + 25 && (referenceX === null || t.x < referenceX - 20))
        .map((t) => t.x),
      28
    )
      .filter((cluster) => cluster.count >= 2)
      .sort((a, b) => a.median - b.median);

    // Quantity is the first repeated numeric column after the unit. Any following numeric column belongs
    // to pricing/totals and is intentionally ignored by the BOQ importer.
    const quantityCluster = numericClusters[0];
    if (quantityCluster) {
      anchors.push({ key: 'quantity', x: quantityCluster.min - 8 });
      const nextNumericCluster = numericClusters.find((cluster) => cluster.median > quantityCluster.median + 45);
      if (nextNumericCluster) anchors.push({ key: 'ignore', x: nextNumericCluster.min - 8 });
    }
  }

  if (referenceX !== null) anchors.push({ key: 'reference', x: referenceX });

  anchors.sort((a, b) => a.x - b.x);
  return { positionX, anchors };
}

/**
 * Position numbers are pulled out by content pattern (wherever they sit in the row), not by an X-threshold —
 * a position number's X is too close to the Name column's start for any boundary to reliably separate them
 * across a whole page of OCR jitter.
 */
function extractPositionToken(row: PositionedToken[], positionX: number): PositionedToken | null {
  for (const t of row) {
    if (Math.abs(t.x - positionX) <= 42 && POSITION_NUMBER.test(t.text.trim())) return t;
  }
  return null;
}

function assignRowToColumns(row: PositionedToken[], anchors: ColumnAnchor[]): Record<ValueColumnKey, string> {
  const cells: Record<InternalColumnKey, string[]> = { name: [], unit: [], quantity: [], reference: [], ignore: [] };
  for (const token of row) {
    let owner: ColumnAnchor | null = null;
    for (const anchor of anchors) {
      if (anchor.x <= token.x + 2) owner = anchor;
    }
    if (!owner) owner = anchors[0] ?? null;
    if (owner) cells[owner.key].push(token.text);
  }
  return {
    name: cells.name.join(' ').trim(),
    unit: cells.unit.join(' ').trim(),
    quantity: cells.quantity.join(' ').trim(),
    reference: cells.reference.join(' ').trim(),
  };
}

interface RawLine {
  position: string;
  name: string;
  cells: Record<ValueColumnKey, string>;
  sourceReference: string;
}

function classifyLines(pagesTokens: PositionedToken[][], rowTolerance: number): RawLine[] {
  const lines: RawLine[] = [];
  let lastColumns: DetectedColumns | null = null;

  for (const [pageIndex, rawPageTokens] of pagesTokens.entries()) {
    const pageTokens = cleanTokens(rawPageTokens);
    if (pageTokens.length === 0) continue;

    const detectedColumns = detectColumnAnchors(pageTokens);
    // This first supported template keeps the same table geometry on every page. Preserve the first
    // reliable calibration so a sparse continuation page cannot mistake a price band for a BOQ column.
    const activeColumns = lastColumns ?? detectedColumns;
    if (!lastColumns && detectedColumns) lastColumns = detectedColumns;
    if (!activeColumns) continue;

    // The header row (unreadable or not) always sits above the first real position row —
    // skip anything above that line so garbled header text never merges into a previous page's row.
    const firstRowY = Math.min(
      ...pageTokens
        .filter((t) => Math.abs(t.x - activeColumns.positionX) <= 42 && POSITION_NUMBER.test(t.text.trim()))
        .map((t) => t.y),
      Infinity
    );

    const rows = groupIntoRows(pageTokens, rowTolerance);
    for (const row of rows) {
      if (Number.isFinite(firstRowY) && row[0].y < firstRowY - rowTolerance) continue;

      const positionToken = extractPositionToken(row, activeColumns.positionX);
      const remainingRow = positionToken ? row.filter((t) => t !== positionToken) : row;
      const cells = assignRowToColumns(remainingRow, activeColumns.anchors);
      lines.push({ position: positionToken ? positionToken.text.trim() : '', name: cells.name.trim(), cells, sourceReference: `PDF, ${pageIndex + 1} psl.` });
    }
  }
  return lines;
}

export interface TableExtractionResult {
  rows: Omit<BoqRow, 'packageId'>[];
  excluded: ExcludedLine[];
}

/**
 * Reconstructs BOQ rows from positioned page tokens (from either a real PDF text layer or OCR words).
 * Column boundaries come from the body content's own geometry (position numbers, reference codes) rather
 * than header text, since bold header rows are often unreadable to OCR.
 *
 * Groups each position-numbered line together with any wrapped continuation lines that follow it (until
 * the next position number starts), then hands the assembled candidate to the shared rule-based validator.
 * Every rejected line — section headers, document boilerplate, dates, incomplete rows — is reported back
 * with a concrete reason rather than being silently dropped or guessed at. No AI, no scoring: fixed rules.
 */
export function extractBoqTable(pagesTokens: PositionedToken[][], rowTolerance = 6): TableExtractionResult {
  const lines = classifyLines(pagesTokens, rowTolerance);
  const rows: Omit<BoqRow, 'packageId'>[] = [];
  const excluded: ExcludedLine[] = [];

  interface OpenCandidate {
    position: string;
    nameParts: string[];
    unit: string;
    quantityRaw: string;
    reference: string;
    sourceReference: string;
  }
  let open: OpenCandidate | null = null;

  const recoverMisplacedCells = (candidate: OpenCandidate): OpenCandidate => {
    const words = candidate.nameParts.join(' ').trim().split(/\s+/).filter(Boolean);
    let unit = candidate.unit.trim();
    let quantityRaw = candidate.quantityRaw.trim();
    let unitIndex = -1;
    let quantityIndex = -1;

    if (!unit || !LIKELY_UNIT_CELL.test(unit.replace(/\s+/g, ''))) {
      for (let index = words.length - 1; index >= 0; index--) {
        if (OCR_UNIT_IN_TEXT.test(words[index])) {
          unit = words[index];
          unitIndex = index;
          break;
        }
      }
    }
    if (!quantityRaw) {
      for (let index = words.length - 1; index >= 0; index--) {
        if (index === unitIndex) continue;
        if (OCR_QUANTITY_IN_TEXT.test(words[index])) {
          quantityRaw = words[index];
          quantityIndex = index;
          break;
        }
      }
    }

    const name = words.filter((_, index) => index !== unitIndex && index !== quantityIndex).join(' ');
    return { ...candidate, nameParts: [name], unit, quantityRaw };
  };

  const finalize = () => {
    if (!open) return;
    open = recoverMisplacedCells(open);
    const result = classifyBoqCandidate({
      position: open.position,
      name: open.nameParts.join(' ').trim(),
      unit: open.unit,
      quantityRaw: open.quantityRaw,
      reference: open.reference,
      sourceReference: open.sourceReference,
    });
    if ('accepted' in result) {
      rows.push({
        id: uid(),
        positionNumber: result.accepted.positionNumber,
        name: result.accepted.name,
        unit: result.accepted.unit,
        quantity: result.accepted.quantity,
        notes: result.accepted.reference ? `Nuoroda: ${result.accepted.reference}` : null,
        rawSection: null,
        sourceReference: result.accepted.sourceReference,
      });
    } else {
      excluded.push(result.rejected);
    }
    open = null;
  };

  for (const line of lines) {
    if (line.position) {
      finalize();
      open = { position: line.position, nameParts: [line.name], unit: line.cells.unit, quantityRaw: line.cells.quantity, reference: line.cells.reference, sourceReference: line.sourceReference };
      continue;
    }

    const combined = [line.name, line.cells.unit, line.cells.quantity, line.cells.reference].filter(Boolean).join(' ').trim();
    if (/\bskyriuje\s+\d+\b/i.test(combined)) {
      finalize();
      excluded.push({ raw: combined, reason: 'Skyriaus suvestinė / antraštė' });
      continue;
    }
    if (!combined) continue; // truly empty — not worth reporting

    const noise = classifyBoqCandidate({ position: '', name: line.name, unit: '', quantityRaw: '' });
    const isKnownNoise = 'rejected' in noise && (noise.rejected.reason === 'Dokumento antraštė / žymėjimas' || noise.rejected.reason === 'Data' || noise.rejected.reason === 'Puslapio / dokumento žyma');

    if (isKnownNoise) {
      excluded.push({ raw: combined, reason: (noise as { rejected: ExcludedLine }).rejected.reason });
      continue;
    }

    // Plausible continuation of the open candidate's wrapped description / trailing unit-qty-reference —
    // bounded so unrelated noise can't snowball an unrelated line into a real position indefinitely.
    if (open && open.nameParts.join(' ').length <= 200 && line.name.length <= 200) {
      if (line.name) open.nameParts.push(line.name);
      if (!open.unit && line.cells.unit) open.unit = line.cells.unit;
      if (!open.quantityRaw && line.cells.quantity) open.quantityRaw = line.cells.quantity;
      if (!open.reference && line.cells.reference) open.reference = line.cells.reference;
      continue;
    }

    excluded.push({ raw: combined, reason: 'Nėra pozicijos numerio' });
  }
  finalize();

  const uniqueRows: typeof rows = [];
  const seenRows = new Set<string>();
  for (const row of rows) {
    const key = [row.positionNumber, row.name, row.unit, row.quantity]
      .map((value) => String(value ?? '').trim().toLocaleLowerCase('lt-LT'))
      .join('|');
    if (seenRows.has(key)) {
      excluded.push({ raw: `${row.positionNumber ?? ''} ${row.name}`, reason: 'Pasikartojanti sąmatos eilutė' });
      continue;
    }
    seenRows.add(key);
    uniqueRows.push(row);
  }

  return { rows: uniqueRows, excluded };
}
