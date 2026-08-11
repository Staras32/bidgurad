export interface BoqRow {
  id: string;
  positionNumber: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  notes: string | null;
  /** Section value as literally found in the source file, if the file had one. */
  rawSection: string | null;
  /** Human-readable source location used to audit extraction (for example "Lapas1, 24 eil." or "PDF, 3 psl."). */
  sourceReference: string | null;
  /** Current work package assignment — mutable via rename/merge/split/drag & drop. */
  packageId: string;
}

export interface WorkPackage {
  /** Stable ID, kept for the lifetime of the project — future RFQs are generated per package ID. */
  id: string;
  name: string;
  /** How this package originally came to exist — informational only, never shown as a claim of certainty. */
  source: 'section' | 'classified' | 'custom';
}

export type BoqFileType = 'xlsx' | 'pdf' | 'unknown';

export interface ExcludedBoqLine {
  raw: string;
  reason: string;
  sourceReference?: string | null;
}

export interface BoqParseResult {
  fileType: BoqFileType;
  rows: Omit<BoqRow, 'packageId'>[];
  /** Project/object title read from an explicit estimate title-block label. Never synthesized. */
  projectNameSuggestion?: string;
  /** Lines the deterministic parser looked at but rejected — section headers, document boilerplate,
   * dates, incomplete rows — each with a concrete reason, shown to the user for transparency. */
  excluded: ExcludedBoqLine[];
  /** True when the source file had no reliably-detected header row (xlsx) — a real signal, not a guess. */
  headerFound: boolean;
  /** How PDF content was actually read — absent for xlsx. 'ocr' means the PDF had no text layer at all. */
  pdfExtractionMethod?: 'text' | 'ocr';
  error?: string;
}
