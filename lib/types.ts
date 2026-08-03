export interface BidItem {
  id: string;
  desc: string;
  price: string;
  qty?: string;
  unit?: string;
}

export interface Bid {
  id: string;
  name: string;
  items: BidItem[];
  exclusions: string;
}

export type FlagType = 'price_outlier' | 'scope_gap' | 'risky_language' | 'unique_exclusion';
export type Severity = 'high' | 'medium' | 'low';

export interface Flag {
  bidId: string;
  tipas: FlagType;
  sunkumas: Severity;
  aprasymas: string;
}

export interface BidScore {
  bidId: string;
  balas: number;
  pagrindimas: string;
}

export interface ScopeMatrixCell {
  bidId: string;
  yra: boolean;
  kaina: number | null;
  originalus_aprasymas: string | null;
}

export interface ScopeMatrixRow {
  kategorija: string;
  eilutes: ScopeMatrixCell[];
}

export interface Analysis {
  scopeMatrix: ScopeMatrixRow[];
  flags: Flag[];
  bidScores: BidScore[];
  santrauka: string;
}

export interface FlagFeedbackEntry {
  decision?: 'agree' | 'false_positive';
  comment?: string;
}

export type FlagFeedback = Record<string, FlagFeedbackEntry>;

export interface SavedProject {
  id: string;
  label: string;
  savedAt: number;
  bids: Bid[];
  analysis: Analysis;
  flagFeedback: FlagFeedback;
}

export interface ImportTemplate {
  descCol: number;
  priceCol: number;
  qtyCol: number;
  unitCol: number;
}

export interface PendingImport extends ImportTemplate {
  bidId: string;
  headers: string[];
  rows: (string | number | undefined)[][];
  sig: string;
  headerFound: boolean;
}
