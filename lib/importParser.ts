import { parseEuNumber } from './numberParser';
import { uid } from './uid';
import type { BidItem, ImportTemplate } from './types';

export type Row = (string | number | undefined)[];

export const norm = (s: unknown): string => String(s ?? '').toLowerCase().trim();

const IMPORT_KEYWORDS = {
  desc: ['aprašymas', 'aprasymas', 'darbų pavadinimas', 'darbu pavadinimas', 'pavadinimas', 'pozicija', 'description', 'item'],
  priceStrong: ['suma', 'total', 'amount', 'iš viso', 'is viso'],
  priceWeak: ['kaina', 'price'],
  qty: ['kiekis', 'qty', 'quantity'],
  unit: ['vnt.', 'vnt', 'mato vnt', 'unit'],
};

const ALL_KEYWORDS = [
  ...IMPORT_KEYWORDS.desc,
  ...IMPORT_KEYWORDS.priceStrong,
  ...IMPORT_KEYWORDS.priceWeak,
  ...IMPORT_KEYWORDS.qty,
  ...IMPORT_KEYWORDS.unit,
];

function countKeywordHits(row: Row): number {
  return (row || []).reduce((n: number, cell) => {
    const c = norm(cell);
    return c && ALL_KEYWORDS.some((k) => c.includes(k)) ? n + 1 : n;
  }, 0);
}

/** Antraštės eilutė = pirma eilutė (iš pirmų 15) su bent 2 raktažodžių atitikmenimis. */
export function findHeaderRow(allRows: Row[]): number {
  let bestIdx = -1;
  let bestScore = 1;
  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const score = countKeywordHits(allRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function guessColumn(headers: string[], keywords: string[]): number {
  for (let idx = 0; idx < headers.length; idx++) {
    if (keywords.some((k) => norm(headers[idx]).includes(k))) return idx;
  }
  return -1;
}

export function guessAllColumns(headers: string[]): ImportTemplate {
  const priceStrongCol = guessColumn(headers, IMPORT_KEYWORDS.priceStrong);
  return {
    descCol: guessColumn(headers, IMPORT_KEYWORDS.desc),
    priceCol: priceStrongCol !== -1 ? priceStrongCol : guessColumn(headers, IMPORT_KEYWORDS.priceWeak),
    qtyCol: guessColumn(headers, IMPORT_KEYWORDS.qty),
    unitCol: guessColumn(headers, IMPORT_KEYWORDS.unit),
  };
}

/** Atpažįsta skirtuką (kablelis / kabliataškis / tabas) pagal pirmą eilutę ir suskaido CSV tekstą į eilutes. */
export function parseCsvText(text: string): Row[] {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts: Record<string, number> = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  };
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ',';

  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const cells: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === delim && !inQuotes) {
          cells.push(cur.trim());
          cur = '';
          continue;
        }
        cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    });
}

export interface BuildItemsResult {
  items?: BidItem[];
  error?: string;
}

/** Bendra validacija + eilučių sudarymas - naudojama ir automatiniam, ir rankiniam importui. */
export function buildItemsFromColumns(rows: Row[], cols: ImportTemplate): BuildItemsResult {
  const { descCol, priceCol, qtyCol, unitCol } = cols;
  if (descCol < 0 || priceCol < 0) {
    return { error: 'Pasirink ir aprašymo, ir kainos stulpelį.' };
  }

  const candidates = rows.map((r) => ({
    desc: String(r[descCol] ?? '').trim(),
    price: parseEuNumber(r[priceCol]),
    qty: qtyCol >= 0 ? String(r[qtyCol] ?? '').trim() : '',
    unit: unitCol >= 0 ? String(r[unitCol] ?? '').trim() : '',
  }));

  const withDesc = candidates.filter((c) => c.desc);
  const numericDescShare = withDesc.length
    ? withDesc.filter((c) => /^\d+$/.test(c.desc)).length / withDesc.length
    : 1;

  if (withDesc.length === 0 || numericDescShare > 0.7) {
    return { error: 'Aprašymo stulpelis pasirinktas neteisingai.' };
  }

  const items: BidItem[] = candidates
    .filter((c) => c.desc && !isNaN(c.price) && c.price > 0)
    .map((c) => ({ id: uid(), desc: c.desc, price: String(c.price), qty: c.qty, unit: c.unit }));

  if (items.length === 0) {
    return { error: 'Su pasirinktais stulpeliais nerasta tinkamų eilučių.' };
  }
  return { items };
}
