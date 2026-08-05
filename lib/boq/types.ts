export interface BoqRow {
  id: string;
  positionNumber: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  notes: string | null;
  /** Section value as literally found in the source file, if the file had one. */
  rawSection: string | null;
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

export interface BoqParseResult {
  fileType: BoqFileType;
  rows: Omit<BoqRow, 'packageId'>[];
  /** True when the source file had no reliably-detected header row (xlsx) — a real signal, not a guess. */
  headerFound: boolean;
  error?: string;
}
