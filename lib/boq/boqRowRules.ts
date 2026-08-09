import { parseEuNumber } from '@/lib/numberParser';

/**
 * A BOQ position number: 1 to 5 dot-separated numeric segments, each 1-2 digits, optional trailing dot.
 * Matches "1", "01", "1.1", "01.02", "1.1.1", "1.2.15", and similar — deliberately permissive on depth
 * since real documents vary (flat "1", "2", "3"… lists exist alongside deeply nested ones).
 */
export const POSITION_NUMBER = /^(\d{1,4}(?:\.\d{1,4}){0,5})\.?$/;

/** Requires an actual dot (2+ levels) — used only to calibrate column X-anchors, where a bare single
 * digit is too easily confused with a quantity value. Row *acceptance* uses POSITION_NUMBER instead. */
export const ANCHOR_POSITION_TOKEN = /^\d{1,4}\.\d{1,4}(?:\.\d{1,4}){0,4}\.?$/;

const BOILERPLATE_PATTERNS = [
  /\bsuderinta\b/i,
  /\btvirtinu\b/i,
  /\batsaking(?:as|a)\s+atstov(?:as|ė)\b/i,
  /\blokalin[ėe]\s+s[aą]mata\b/i,
  /\bužsakov(?:as|o)\b/i,
  /\brangov(?:as|o)\b/i,
  /\bparaš(?:as|ai|yta)\b/i,
  /\bvardas[,\s]+pavardė\b/i,
  /\bpareigos\b/i,
  /\bobjekto\s+pavadinimas\b/i,
  /\bdokument(?:o|ą)\s+(?:parengė|sudarė|pavadinimas)\b/i,
];

const TOTAL_LINE = /^(?:i[šs]\s+viso|viso|tarpin[ėe]\s+suma|bendra\s+suma|subtotal|total)\b/i;
const LETTER = /[a-ząčęėįšųūž]/i;
/** Construction BOQs contain many legitimate project-specific units. Validate their shape instead of
 * maintaining a brittle whitelist that would silently discard units such as kg/m, 100 m or pora. */
const UNIT_TOKEN = /^(?=.{1,16}$)(?=.*(?:[a-ząčęėįšųūž]|%))[a-ząčęėįšųūž0-9²³%./'’-]+$/i;

// Two-digit years are intentionally not treated as dates: values such as 12.03.26 are valid,
// common BOQ hierarchy codes and must not be discarded without stronger date context.
const DATE_ONLY = /^\d{4}[-.]\d{1,2}[-.]\d{1,2}\.?$|^\d{1,2}[-./]\d{1,2}[-./]\d{4}\.?$/;
const PAGE_OR_DOC_FURNITURE = /^(puslapis|page|lapas|lapų|psl\.?|laida)\s*[:.]?\s*\d*$/i;

export interface CandidateFields {
  position: string;
  name: string;
  unit: string;
  quantityRaw: string;
  reference?: string;
  sourceReference?: string;
}

export interface AcceptedBoqLine {
  positionNumber: string;
  name: string;
  unit: string;
  quantity: number;
  reference: string;
  sourceReference: string;
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

  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(name) || pattern.test(raw))) {
    return { rejected: { raw, reason: 'Dokumento antraštė / žymėjimas' } };
  }
  if (TOTAL_LINE.test(name)) return { rejected: { raw, reason: 'Tarpinė arba bendra suma' } };
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
  if (name.length < 3 || !LETTER.test(name)) {
    return { rejected: { raw, reason: 'Neatpažintas darbų aprašymas' } };
  }
  if (name.length > 500) {
    return { rejected: { raw, reason: 'Aprašymas per ilgas – tikėtina sujungta dokumento ištrauka' } };
  }
  if (!unit) {
    return { rejected: { raw, reason: 'Trūksta mato vieneto' } };
  }
  const normalizedUnit = unit.toLowerCase().replace(/\s+/g, '').replace(/\.$/, '');
  if (!UNIT_TOKEN.test(normalizedUnit)) {
    return { rejected: { raw, reason: `Neatpažintas mato vienetas: ${unit}` } };
  }
  const quantity = quantityRaw ? parseEuNumber(quantityRaw) : NaN;
  if (!Number.isFinite(quantity)) {
    return { rejected: { raw, reason: 'Trūksta arba neaiškus kiekis' } };
  }

  return {
    accepted: { positionNumber: position, name, unit, quantity, reference: row.reference?.trim() ?? '', sourceReference: row.sourceReference?.trim() ?? '' },
  };
}
