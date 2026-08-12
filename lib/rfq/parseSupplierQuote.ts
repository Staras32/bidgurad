import * as XLSX from 'xlsx';
import { parseEuNumber } from '@/lib/numberParser';
import type { SupplierQuoteComparison, SupplierQuoteRow, SupplierRequestItem } from './types';

type SheetRow = unknown[];

const keywords = {
  position: ['poz. nr', 'poz nr', 'eil. nr', 'eil nr', 'numeris', 'nr.'],
  description: ['darbų pavadinimas', 'darbu pavadinimas', 'pavadinimas', 'aprašymas', 'aprasymas', 'description'],
  unit: ['mato vnt', 'matavimo vienetas', 'vienetas', 'vnt.'],
  quantity: ['kiekis', 'quantity', 'qty'],
  unitPrice: ['vieneto kaina', 'įkainis', 'ikainis', 'unit price'],
  totalPrice: ['suma', 'bendra kaina', 'viso', 'total'],
};

const text = (value: unknown) => String(value ?? '').trim();
const norm = (value: unknown) => text(value).toLocaleLowerCase('lt-LT');

function columnFor(headers: SheetRow, candidates: string[]): number {
  return headers.findIndex((cell) => candidates.some((keyword) => norm(cell).includes(keyword)));
}

function findHeader(rows: SheetRow[]): { index: number; headers: SheetRow } | null {
  let best: { index: number; headers: SheetRow; score: number } | null = null;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = rows[index];
    const score = Object.values(keywords).filter((set) => columnFor(headers, set) >= 0).length;
    if (score >= 3 && (!best || score > best.score)) best = { index, headers, score };
  }
  return best;
}

function parseRows(rows: SheetRow[]): SupplierQuoteRow[] {
  const detected = findHeader(rows);
  if (!detected) return [];
  const positionCol = columnFor(detected.headers, keywords.position);
  const descriptionCol = columnFor(detected.headers, keywords.description);
  const unitCol = columnFor(detected.headers, keywords.unit);
  const quantityCol = columnFor(detected.headers, keywords.quantity);
  const unitPriceCol = columnFor(detected.headers, keywords.unitPrice);
  const totalPriceCol = columnFor(detected.headers, keywords.totalPrice);
  if (positionCol < 0 || descriptionCol < 0) return [];

  return rows.slice(detected.index + 1).flatMap((row) => {
    const positionNumber = text(row[positionCol]);
    const description = text(row[descriptionCol]);
    if (!positionNumber || !description || !/^\d+(?:[.,]\d+)*$/.test(positionNumber)) return [];
    const numberOrNull = (column: number): number | null => {
      if (column < 0 || text(row[column]) === '') return null;
      const parsed = parseEuNumber(row[column]);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return [{
      positionNumber,
      description,
      unit: unitCol >= 0 ? text(row[unitCol]) || null : null,
      quantity: numberOrNull(quantityCol),
      unitPrice: numberOrNull(unitPriceCol),
      totalPrice: numberOrNull(totalPriceCol),
    }];
  });
}

async function parseExcel(file: File): Promise<SupplierQuoteRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, blankrows: false, raw: true });
    return parseRows(rows);
  });
}

async function parsePdf(file: File): Promise<SupplierQuoteRow[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer(), wasmUrl: '/pdfjs/wasm/' }).promise;
  type Token = { value: string; x: number; x2: number; y: number };
  const pages: Token[][] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const tokens = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number } => 'str' in item && 'transform' in item && 'width' in item)
      .map((item) => ({ value: item.str.trim(), x: item.transform[4], x2: item.transform[4] + item.width, y: item.transform[5] }))
      .filter((item) => item.value);
    pages.push(tokens);
  }
  document.cleanup();

  const allTokens = pages.flat();
  if (allTokens.length === 0) throw new Error('PDF faile nėra nuskaitomo teksto. Įkelkite tekstinį PDF arba Excel pasiūlymą.');
  const positionPattern = /^\d+(?:[.,]\d+)*$/;
  const unitPattern = /^(?:vnt\.?|m|m[²³23]|kg|t|val\.?|kompl\.?|ha|km)$/i;
  const numericPattern = /^-?[\d\s.,]+$/;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const clusters = (values: number[], tolerance = 24) => {
    const groups: number[][] = [];
    for (const value of [...values].sort((a, b) => a - b)) {
      const group = groups.at(-1);
      if (group && value - group.at(-1)! <= tolerance) group.push(value);
      else groups.push([value]);
    }
    return groups.map((group) => ({ count: group.length, x: median(group), min: Math.min(...group) }));
  };

  const minX = Math.min(...allTokens.map((token) => token.x));
  const maxX = Math.max(...allTokens.map((token) => token.x2));
  const positionCluster = clusters(
    allTokens.filter((token) => positionPattern.test(token.value) && token.x < minX + (maxX - minX) * 0.35).map((token) => token.x),
    18
  ).filter((cluster) => cluster.count >= 2).sort((a, b) => b.count - a.count || a.x - b.x)[0];
  if (!positionCluster) throw new Error('PDF pasiūlyme nepavyko patikimai aptikti pozicijų numerių stulpelio.');

  const positionTokens = allTokens.filter((token) => positionPattern.test(token.value) && Math.abs(token.x - positionCluster.x) <= 24);
  const nameStarts = positionTokens.flatMap((positionToken) => {
    const candidate = allTokens
      .filter((token) => token.x > positionToken.x2 && Math.abs(token.y - positionToken.y) <= 3)
      .sort((a, b) => a.x - b.x)[0];
    return candidate ? [candidate.x] : [];
  });
  const nameX = nameStarts.length ? Math.min(...nameStarts) - 3 : positionCluster.x + 35;
  const unitCluster = clusters(allTokens.filter((token) => unitPattern.test(token.value) && token.x > nameX + 30).map((token) => token.x), 22)
    .filter((cluster) => cluster.count >= 2).sort((a, b) => b.count - a.count)[0];
  if (!unitCluster) throw new Error('PDF pasiūlyme nepavyko patikimai aptikti mato vienetų stulpelio.');

  const numericClusters = clusters(
    allTokens.filter((token) => numericPattern.test(token.value) && token.x > unitCluster.x + 20).map((token) => token.x),
    22
  ).filter((cluster) => cluster.count >= 2).sort((a, b) => a.x - b.x);
  if (numericClusters.length < 1) throw new Error('PDF pasiūlyme nepavyko patikimai aptikti kiekių stulpelio.');
  const quantityX = numericClusters[0].min - 5;
  const unitPriceX = numericClusters[1]?.min ? numericClusters[1].min - 5 : Number.POSITIVE_INFINITY;
  const totalPriceX = numericClusters[2]?.min ? numericClusters[2].min - 5 : Number.POSITIVE_INFINITY;

  const result: SupplierQuoteRow[] = [];
  for (const pageTokens of pages) {
    const sorted = [...pageTokens].sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x);
    const visualRows: Token[][] = [];
    for (const token of sorted) {
      const current = visualRows.at(-1);
      if (!current || Math.abs(current[0].y - token.y) > 2.5) visualRows.push([token]);
      else current.push(token);
    }
    let active: SupplierQuoteRow | null = null;
    for (const visualRow of visualRows) {
      visualRow.sort((a, b) => a.x - b.x);
      const positionToken = visualRow.find((token) => positionPattern.test(token.value) && Math.abs(token.x - positionCluster.x) <= 24);
      if (positionToken) {
        if (active?.description) result.push(active);
        active = { positionNumber: positionToken.value, description: '', unit: null, quantity: null, unitPrice: null, totalPrice: null };
      }
      if (!active) continue;
      const fragments = visualRow.filter((token) => token !== positionToken);
      const description = fragments.filter((token) => token.x >= nameX && token.x < unitCluster.x - 8).map((token) => token.value).join(' ').trim();
      if (description) active.description = `${active.description} ${description}`.trim();
      const unit = fragments.filter((token) => token.x >= unitCluster.x - 12 && token.x < quantityX).map((token) => token.value).join('').trim();
      if (unit && unitPattern.test(unit)) active.unit = unit;
      const numericValue = (from: number, to: number) => {
        const raw = fragments.filter((token) => token.x >= from && token.x < to).map((token) => token.value).join('').trim();
        if (!raw) return null;
        const value = parseEuNumber(raw);
        return Number.isFinite(value) ? value : null;
      };
      const quantity = numericValue(quantityX, unitPriceX);
      const unitPrice = numericValue(unitPriceX, totalPriceX);
      const totalPrice = numericValue(totalPriceX, Number.POSITIVE_INFINITY);
      if (quantity !== null) active.quantity = quantity;
      if (unitPrice !== null) active.unitPrice = unitPrice;
      if (totalPrice !== null) active.totalPrice = totalPrice;
    }
    if (active?.description) result.push(active);
  }
  return result;
}

export async function parseSupplierQuoteFile(file: File): Promise<{ fileType: 'xlsx' | 'pdf'; rows: SupplierQuoteRow[] }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx' || extension === 'xls') return { fileType: 'xlsx', rows: await parseExcel(file) };
  if (extension === 'pdf') return { fileType: 'pdf', rows: await parsePdf(file) };
  throw new Error('Įkelkite Excel arba PDF pasiūlymą.');
}

const quoteKey = (row: SupplierQuoteRow) => row.positionNumber.trim().toLocaleLowerCase('lt-LT');
const referenceKey = (row: SupplierRequestItem) => row.position_number?.trim().toLocaleLowerCase('lt-LT') ?? '';

export function compareSupplierQuote(
  reference: SupplierRequestItem[],
  quoted: SupplierQuoteRow[]
): SupplierQuoteComparison {
  const quoteByPosition = new Map(quoted.map((row) => [quoteKey(row), row]));
  const referencePositions = new Set(reference.map(referenceKey).filter(Boolean));
  const missingItems = reference.filter((item) => !quoteByPosition.has(referenceKey(item)));
  const unexpectedItems = quoted.filter((row) => !referencePositions.has(quoteKey(row)));
  const quantityMismatches = reference.flatMap((item) => {
    const quote = quoteByPosition.get(referenceKey(item));
    if (!quote || item.quantity === null || quote.quantity === null || item.quantity === quote.quantity) return [];
    return [{
      positionNumber: item.position_number ?? '',
      description: item.name,
      requestedQuantity: item.quantity,
      quotedQuantity: quote.quantity,
      unit: item.unit,
    }];
  });
  const matchedCount = reference.length - missingItems.length;
  const totals = quoted.map((row) => row.totalPrice).filter((value): value is number => value !== null);
  return {
    referenceCount: reference.length,
    detectedCount: quoted.length,
    matchedCount,
    coverage: reference.length ? Math.round((matchedCount / reference.length) * 1000) / 10 : 0,
    missingItems,
    unexpectedItems,
    quantityMismatches,
    quotedTotal: totals.length ? totals.reduce((sum, value) => sum + value, 0) : null,
  };
}
