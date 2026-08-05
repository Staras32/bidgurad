import { parseEuNumber } from '@/lib/numberParser';
import { uid } from '@/lib/uid';
import type { BoqRow } from './types';

/** A single word/text fragment positioned on a page. Y increases downward (screen/image convention). */
export interface PositionedToken {
  text: string;
  x: number;
  y: number;
  x2: number;
}

/** A real BOQ position number, e.g. "1.1", "2.11", "5.14." — always has a decimal part, unlike a bare quantity. */
const DETAIL_TOKEN = /^(\d{1,2})[.,](\d{1,2})\.?$/;
/** A bare section number, e.g. "1.", "6" — no decimal part. Tolerates a comma too (a common OCR misread of the period). */
const SECTION_TOKEN = /^(\d{1,2})[.,]?$/;
/** "TS-02", "TS-09" style reference codes — distinctive and reliably OCR'd. */
const REFERENCE_TOKEN = /^ts-?\d{2,3}$/i;
/** Pure numeric cell content (quantities), including EU decimal/composite forms like "637,0" or "1/0,3/0,2". */
const NUMERIC_CELL = /^[\d.,/]+$/;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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
  const positionMatches = tokens.filter((t) => DETAIL_TOKEN.test(t.text.trim()));
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
    else if (/[a-ząčęėįšųūž]/i.test(text)) unitXs.push(t.x);
  }

  const anchors: ColumnAnchor[] = [
    { key: 'name', x: nameX },
    { key: 'reference', x: referenceX },
  ];
  if (unitXs.length > 0) anchors.push({ key: 'unit', x: Math.min(...unitXs) });
  if (quantityXs.length > 0) anchors.push({ key: 'quantity', x: Math.min(...quantityXs) });

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
    const text = t.text.trim();
    if (DETAIL_TOKEN.test(text) || SECTION_TOKEN.test(text)) return t;
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

function buildNotes(reference: string, quantityRaw: string, quantityParsed: number | null): string | null {
  const parts: string[] = [];
  if (reference) parts.push(`Nuoroda: ${reference}`);
  if (quantityRaw && quantityParsed === null) parts.push(`Kiekis: ${quantityRaw}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface ClassifiedRow {
  position: string;
  name: string;
  cells: Record<ValueColumnKey, string>;
  hasUnitOrQty: boolean;
  tokenCount: number;
  sectionMatch: RegExpExecArray | null;
  detailMatch: RegExpExecArray | null;
}

function classifyRows(pagesTokens: PositionedToken[][], rowTolerance: number): ClassifiedRow[] {
  const classified: ClassifiedRow[] = [];
  let lastAnchors: ColumnAnchor[] = [];

  for (const rawPageTokens of pagesTokens) {
    const pageTokens = cleanTokens(rawPageTokens);
    if (pageTokens.length === 0) continue;

    const anchors = detectColumnAnchors(pageTokens);
    const activeAnchors = anchors.length > 0 ? anchors : lastAnchors;
    if (anchors.length > 0) lastAnchors = anchors;
    if (activeAnchors.length === 0) continue;

    // The header row (unreadable or not) always sits above the first real position/section row —
    // skip anything above that line so garbled header text never merges into a previous page's row.
    const firstRowY = Math.min(
      ...pageTokens.filter((t) => DETAIL_TOKEN.test(t.text.trim()) || SECTION_TOKEN.test(t.text.trim())).map((t) => t.y),
      Infinity
    );

    const rows = groupIntoRows(pageTokens, rowTolerance);
    for (const row of rows) {
      if (Number.isFinite(firstRowY) && row[0].y < firstRowY - rowTolerance) continue;

      const positionToken = extractPositionToken(row);
      const remainingRow = positionToken ? row.filter((t) => t !== positionToken) : row;
      const cells = assignRowToColumns(remainingRow, activeAnchors);
      const position = positionToken ? positionToken.text.trim() : '';
      const name = cells.name.trim();

      classified.push({
        position,
        name,
        cells,
        hasUnitOrQty: Boolean(cells.unit.trim() || cells.quantity.trim()),
        tokenCount: remainingRow.length,
        sectionMatch: SECTION_TOKEN.exec(position),
        detailMatch: DETAIL_TOKEN.exec(position),
      });
    }
  }
  return classified;
}

/**
 * Reconstructs BOQ rows from positioned page tokens (from either a real PDF text layer or OCR words).
 * Column boundaries come from the body content's own geometry (position numbers, reference codes) rather
 * than header text, since bold header rows are often unreadable to OCR. Bare-integer rows are recognized
 * as section headers, validated by sequential numbering to reject unrelated tables (e.g. revision blocks).
 * Wrapped description lines are merged into the row above.
 */
export function extractBoqTable(pagesTokens: PositionedToken[][], rowTolerance = 6): Omit<BoqRow, 'packageId'>[] {
  const classified = classifyRows(pagesTokens, rowTolerance);
  const rows: Omit<BoqRow, 'packageId'>[] = [];
  let lastSectionNumber = 0;
  let currentSectionName: string | null = null;
  let lastAcceptedRowIndex = -1;

  for (const r of classified) {
    if (r.detailMatch) {
      const major = Number(r.detailMatch[1]);
      if (major !== lastSectionNumber) continue; // not part of the current section — likely noise
      const quantityRaw = r.cells.quantity.trim();
      const quantityParsed = quantityRaw && !/[/\\]/.test(quantityRaw) ? parseEuNumber(quantityRaw) : NaN;
      const quantity = Number.isFinite(quantityParsed) ? quantityParsed : null;
      rows.push({
        id: uid(),
        positionNumber: r.position,
        name: r.name,
        unit: r.cells.unit.trim() || null,
        quantity,
        notes: buildNotes(r.cells.reference.trim(), quantityRaw, quantity),
        rawSection: currentSectionName,
      });
      lastAcceptedRowIndex = rows.length - 1;
      continue;
    }

    if (r.sectionMatch && r.name && !r.hasUnitOrQty && r.tokenCount <= 10) {
      const num = Number(r.sectionMatch[1]);
      if (num === lastSectionNumber + 1) {
        lastSectionNumber = num;
        currentSectionName = r.name;
      }
      // Either accepted as the next section, or ignored as noise (e.g. a revision-table "0").
      continue;
    }

    // Continuation of a wrapped description line: no position number, no unit/qty/reference, just more
    // name text. Bounded by token count and target length so unrelated noise can't snowball into one row.
    if (
      !r.position && !r.hasUnitOrQty && !r.cells.reference.trim() && r.name && r.tokenCount <= 10 &&
      lastAcceptedRowIndex >= 0 && rows[lastAcceptedRowIndex].name.length <= 200
    ) {
      rows[lastAcceptedRowIndex].name = `${rows[lastAcceptedRowIndex].name} ${r.name}`.trim();
    }
  }

  return rows;
}
