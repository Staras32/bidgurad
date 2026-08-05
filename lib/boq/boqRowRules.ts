import { parseEuNumber } from '@/lib/numberParser';

/**
 * A BOQ position number: 1 to 5 dot-separated numeric segments, each 1-2 digits, optional trailing dot.
 * Matches "1", "01", "1.1", "01.02", "1.1.1", "1.2.15", and similar — deliberately permissive on depth
 * since real documents vary (flat "1", "2", "3"… lists exist alongside deeply nested ones).
 */
export const POSITION_NUMBER = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?$/;

/** Requires an actual dot (2+ levels) — used only to calibrate column X-anchors, where a bare single
 * digit is too easily confused with a quantity value. Row *acceptance* uses POSITION_NUMBER instead. */
export const ANCHOR_POSITION_TOKEN = /^\d{1,2}\.\d{1,2}(?:\.\d{1,2}){0,3}\.?$/;

const BOILERPLATE_KEYWORDS = ['suderinta', 'tvirtinu', 'atsakingas atstovas', 'lokalinė sąmata', 'lokaline samata'];

const DATE_ONLY = /^\d{4}[-.]\d{1,2}[-.]\d{1,2}\.?$|^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}\.?$/;
const PAGE_OR_DOC_FURNITURE = /^(puslapis|page|lapas|lapų|psl\.?|laida)\s*[:.]?\s*\d*$/i;

export interface CandidateFields {
  position: string;
  name: string;
  unit: string;
  quantityRaw: string;
  reference?: string;
}

export interface AcceptedBoqLine {
  positionNumber: string;
  name: string;
  unit: string;
  quantity: number;
  reference: string;
}

export interface ExcludedLine {
  raw: string;
  reason: string;
}

/**
 * Deterministic, rule-based classification of one candidate line — no AI, no LLM, no heuristic scoring.
 * A line only counts as a real BOQ position when it has all four required fields: a position number,
 * a description, a unit, and a parseable quantity. Anything else (section headers, document boilerplate,
 * dates, page furniture, incomplete rows) is reported as excluded with a concrete reason, never silently
 * merged into a real position or guessed at.
 */
export function classifyBoqCandidate(row: CandidateFields): { accepted: AcceptedBoqLine } | { rejected: ExcludedLine } {
  const position = row.position.trim();
  const name = row.name.trim();
  const unit = row.unit.trim();
  const quantityRaw = row.quantityRaw.trim();
  const raw = [position, name, unit, quantityRaw].filter(Boolean).join(' ').trim();

  if (!raw) {
    return { rejected: { raw: '(tuščia eilutė)', reason: 'Tuščia eilutė' } };
  }

  const lowerName = name.toLowerCase();
  if (BOILERPLATE_KEYWORDS.some((kw) => lowerName.includes(kw))) {
    return { rejected: { raw, reason: 'Dokumento antraštė / žymėjimas' } };
  }
  if (DATE_ONLY.test(position) || DATE_ONLY.test(name)) {
    return { rejected: { raw, reason: 'Data' } };
  }
  if (PAGE_OR_DOC_FURNITURE.test(name) || PAGE_OR_DOC_FURNITURE.test(position)) {
    return { rejected: { raw, reason: 'Puslapio / dokumento žyma' } };
  }

  if (!position || !POSITION_NUMBER.test(position)) {
    return { rejected: { raw, reason: 'Nėra pozicijos numerio' } };
  }
  if (!name) {
    return { rejected: { raw, reason: 'Trūksta aprašymo' } };
  }
  if (!unit) {
    return { rejected: { raw, reason: 'Trūksta mato vieneto' } };
  }
  const quantity = quantityRaw ? parseEuNumber(quantityRaw) : NaN;
  if (!Number.isFinite(quantity)) {
    return { rejected: { raw, reason: 'Trūksta arba neaiškus kiekis' } };
  }

  return {
    accepted: { positionNumber: position, name, unit, quantity, reference: row.reference?.trim() ?? '' },
  };
}
