import { uid } from '@/lib/uid';
import type { BoqRow } from './types';
import { ANCHOR_POSITION_TOKEN, POSITION_NUMBER, classifyBoqCandidate, type ExcludedLine } from './boqRowRules';

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

interface ColumnAnchor {
  key: ValueColumnKey;
  x: number;
}

/**
 * Derives column X-boundaries from the shape of the body content itself, not the header row text.
 * Bold header rows are frequently unreadable to OCR (small bold text against grid lines), while the
 * body's position numbers ("1.1") and reference codes ("TS-02") are short, distinctive, and reliably
 * recognized — so they make a far more robust anchor than header keyword matching. The position number
 * itself is deliberately NOT one of these X-anchors — see extractPositionToken.
 */
function detectColumnAnchors(tokens: PositionedToken[]): ColumnAnchor[] {
  const positionMatches = tokens.filter((t) => ANCHOR_POSITION_TOKEN.test(t.text.trim()));
  const referenceMatches = tokens.filter((t) => REFERENCE_TOKEN.test(t.text.trim()));
  if (positionMatches.length < 2 || referenceMatches.length < 2) return [];

  const positionX = median(positionMatches.map((t) => t.x));
  const referenceX = median(referenceMatches.map((t) => t.x));

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

  // Unit + quantity live in the band between the name column and the reference column.
  // Split by content: tokens with letters are unit-like, purely numeric ones are quantity-like.
  const valueZoneMargin = 550;
  const unitXs: number[] = [];
  const quantityXs: number[] = [];
  for (const t of tokens) {
    const text = t.text.trim();
    if (!text || t.x <= nameX || t.x >= referenceX - 20 || t.x < referenceX - valueZoneMargin) continue;
    if (NUMERIC_CELL.test(text)) quantityXs.push(t.x);
    else if (LIKELY_UNIT_CELL.test(text.replace(/\s+/g, ''))) unitXs.push(t.x);
  }

  const anchors: ColumnAnchor[] = [
    { key: 'name', x: nameX },
    { key: 'reference', x: referenceX },
  ];
  const unitX = dominantColumnStart(unitXs);
  const quantityX = dominantColumnStart(quantityXs);
  if (unitX !== null) anchors.push({ key: 'unit', x: unitX });
  if (quantityX !== null) anchors.push({ key: 'quantity', x: quantityX });

  anchors.sort((a, b) => a.x - b.x);
  return anchors;
}

/**
 * Position numbers are pulled out by content pattern (wherever they sit in the row), not by an X-threshold —
 * a position number's X is too close to the Name column's start for any boundary to reliably separate them
 * across a whole page of OCR jitter.
 */
function extractPositionToken(row: PositionedToken[]): PositionedToken | null {
  for (const t of row) {
    if (POSITION_NUMBER.test(t.text.trim())) return t;
  }
  return null;
}

function assignRowToColumns(row: PositionedToken[], anchors: ColumnAnchor[]): Record<ValueColumnKey, string> {
  const cells: Record<ValueColumnKey, string[]> = { name: [], unit: [], quantity: [], reference: [] };
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
  let lastAnchors: ColumnAnchor[] = [];

  for (const [pageIndex, rawPageTokens] of pagesTokens.entries()) {
    const pageTokens = cleanTokens(rawPageTokens);
    if (pageTokens.length === 0) continue;

    const anchors = detectColumnAnchors(pageTokens);
    const activeAnchors = anchors.length > 0 ? anchors : lastAnchors;
    if (anchors.length > 0) lastAnchors = anchors;
    if (activeAnchors.length === 0) continue;

    // The header row (unreadable or not) always sits above the first real position row —
    // skip anything above that line so garbled header text never merges into a previous page's row.
    const firstRowY = Math.min(
      ...pageTokens.filter((t) => POSITION_NUMBER.test(t.text.trim())).map((t) => t.y),
      Infinity
    );

    const rows = groupIntoRows(pageTokens, rowTolerance);
    for (const row of rows) {
      if (Number.isFinite(firstRowY) && row[0].y < firstRowY - rowTolerance) continue;

      const positionToken = extractPositionToken(row);
      const remainingRow = positionToken ? row.filter((t) => t !== positionToken) : row;
      const cells = assignRowToColumns(remainingRow, activeAnchors);
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
  const seenPositions = new Set<string>();
  for (const row of rows) {
    const position = row.positionNumber?.trim() ?? '';
    if (position && seenPositions.has(position)) {
      excluded.push({ raw: `${position} ${row.name}`, reason: 'Pasikartojantis pozicijos numeris' });
      continue;
    }
    if (position) seenPositions.add(position);
    uniqueRows.push(row);
  }

  return { rows: uniqueRows, excluded };
}
