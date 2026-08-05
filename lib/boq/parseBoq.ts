import * as XLSX from 'xlsx';
import { uid } from '@/lib/uid';
import { parseEuNumber } from '@/lib/numberParser';
import type { BoqFileType, BoqParseResult, BoqRow } from './types';
import { extractBoqTable, type PositionedToken } from './reconstructTable';
import { ocrPdfPages, type OcrProgress } from './ocrPdf';

type Row = (string | number | undefined)[];

const FIELD_KEYWORDS = {
  position: ['eil. nr', 'eil.nr', 'eil nr', 'poz. nr', 'pozicijos nr', 'nr.', 'poz.', 'pozicija'],
  name: ['darbų pavadinimas', 'darbu pavadinimas', 'pozicijos pavadinimas', 'pavadinimas', 'aprašymas', 'aprasymas', 'darbai'],
  unit: ['mato vnt', 'matavimo vienetas', 'mato vienetas', 'vnt.', 'vnt'],
  quantity: ['kiekis'],
  notes: ['pastabos', 'pastaba', 'komentaras'],
  section: ['skyrius', 'skirsnis', 'kategorija', 'dalis'],
} as const;

type Field = keyof typeof FIELD_KEYWORDS;

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().trim();
}

function countFieldHits(row: Row): number {
  let hits = 0;
  for (const field of Object.keys(FIELD_KEYWORDS) as Field[]) {
    const keywords = FIELD_KEYWORDS[field];
    if (row.some((cell) => { const c = norm(cell); return c && keywords.some((k) => c.includes(k)); })) hits++;
  }
  return hits;
}

/** Header row = first of the first 15 rows with at least 2 recognizable BOQ field keywords. */
function findBoqHeaderRow(allRows: Row[]): number {
  let bestIdx = -1;
  let bestScore = 1;
  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const score = countFieldHits(allRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function guessColumn(headerRow: Row, keywords: readonly string[]): number {
  for (let idx = 0; idx < headerRow.length; idx++) {
    const c = norm(headerRow[idx]);
    if (c && keywords.some((k) => c.includes(k))) return idx;
  }
  return -1;
}

function cellText(row: Row, col: number): string | null {
  if (col < 0) return null;
  const v = row[col];
  const s = v == null ? '' : String(v).trim();
  return s ? s : null;
}

function rowsFromSheet(allRows: Row[]): Omit<BoqRow, 'packageId'>[] {
  const headerIdx = findBoqHeaderRow(allRows);
  const headerFound = headerIdx !== -1;

  if (headerFound) {
    const headerRow = allRows[headerIdx];
    const cols = {
      position: guessColumn(headerRow, FIELD_KEYWORDS.position),
      name: guessColumn(headerRow, FIELD_KEYWORDS.name),
      unit: guessColumn(headerRow, FIELD_KEYWORDS.unit),
      quantity: guessColumn(headerRow, FIELD_KEYWORDS.quantity),
      notes: guessColumn(headerRow, FIELD_KEYWORDS.notes),
      section: guessColumn(headerRow, FIELD_KEYWORDS.section),
    };

    const dataRows = allRows
      .slice(headerIdx + 1)
      .filter((r) => r.some((c) => c !== undefined && String(c).trim() !== ''));

    if (cols.name === -1) {
      // No confidently-detected name column — fall back to raw-line rows below,
      // same as the no-header case, rather than guessing which column is which.
      return rawLineRows(dataRows);
    }

    return dataRows
      .filter((r) => cellText(r, cols.name))
      .map((r) => {
        const qtyRaw = cols.quantity >= 0 ? r[cols.quantity] : undefined;
        const qty = qtyRaw == null || qtyRaw === '' ? null : parseEuNumber(qtyRaw);
        return {
          id: uid(),
          positionNumber: cellText(r, cols.position),
          name: cellText(r, cols.name) ?? '',
          unit: cellText(r, cols.unit),
          quantity: qty != null && !Number.isNaN(qty) ? qty : null,
          notes: cellText(r, cols.notes),
          rawSection: cellText(r, cols.section),
        };
      });
  }

  // No header confidently detected anywhere in the file — every row becomes a
  // name-only position built from its own real cell content. Nothing invented.
  const dataRows = allRows.filter((r) => r.some((c) => c !== undefined && String(c).trim() !== ''));
  return rawLineRows(dataRows);
}

function rawLineRows(rows: Row[]): Omit<BoqRow, 'packageId'>[] {
  return rows
    .map((r) => r.map((c) => (c == null ? '' : String(c).trim())).filter(Boolean).join(' — '))
    .filter(Boolean)
    .map((name) => ({
      id: uid(),
      positionNumber: null,
      name,
      unit: null,
      quantity: null,
      notes: null,
      rawSection: null,
    }));
}

async function parseXlsx(file: File): Promise<BoqParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return { fileType: 'xlsx', rows: [], headerFound: false, error: 'Šiame faile nerasta nuskaitomo lapo.' };
    }
    const allRows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: false });
    if (allRows.length === 0) {
      return { fileType: 'xlsx', rows: [], headerFound: false, error: 'Šis failas atrodo tuščias.' };
    }
    const headerIdx = findBoqHeaderRow(allRows);
    const rows = rowsFromSheet(allRows);
    if (rows.length === 0) {
      return { fileType: 'xlsx', rows: [], headerFound: headerIdx !== -1, error: 'Šiame faile nerasta BOQ pozicijų.' };
    }
    return { fileType: 'xlsx', rows, headerFound: headerIdx !== -1 };
  } catch {
    return { fileType: 'xlsx', rows: [], headerFound: false, error: 'Nepavyko nuskaityti failo. Patikrink, ar tai tinkamas Excel failas.' };
  }
}

const POSITION_PREFIX = /^\s*(\d+(?:\.\d+)*)[.)]?\s+/;
const TRAILING_QTY_UNIT = /(\d+[.,]?\d*)\s*(vnt\.?|m2|m²|m3|m³|kv\.?\s?m\.?|kub\.?\s?m\.?|kg|t\.?|val\.?|m\.?p\.?|m)\s*$/i;

function parsePdfLineToRow(line: string): Omit<BoqRow, 'packageId'> | null {
  const trimmed = line.trim();
  if (trimmed.length < 3) return null;
  if (/^(puslapis|page)\s*\d+/i.test(trimmed)) return null;
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return null;

  let rest = trimmed;
  let positionNumber: string | null = null;
  const posMatch = rest.match(POSITION_PREFIX);
  if (posMatch) {
    positionNumber = posMatch[1];
    rest = rest.slice(posMatch[0].length);
  }

  let unit: string | null = null;
  let quantity: number | null = null;
  const qtyMatch = rest.match(TRAILING_QTY_UNIT);
  if (qtyMatch) {
    const qty = parseEuNumber(qtyMatch[1]);
    if (!Number.isNaN(qty)) {
      quantity = qty;
      unit = qtyMatch[2].replace(/\s+/g, ' ');
      rest = rest.slice(0, qtyMatch.index).trim();
    }
  }

  if (!rest) return null;

  return {
    id: uid(),
    positionNumber,
    name: rest,
    unit,
    quantity,
    notes: null,
    rawSection: null,
  };
}

async function parsePdf(file: File, onOcrProgress?: (progress: OcrProgress) => void): Promise<BoqParseResult> {
  let pagesTextTokens: PositionedToken[][] = [];
  let pagesLines: string[][] = [];
  let totalChars = 0;

  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as { str: string; transform: number[]; width: number }[];

      const pageTokens: PositionedToken[] = [];
      let currentY: number | null = null;
      let currentLine: string[] = [];
      const lines: string[] = [];
      for (const item of items) {
        if (!item.str) continue;
        totalChars += item.str.replace(/\s/g, '').length;
        pageTokens.push({ text: item.str, x: item.transform[4], y: -item.transform[5], x2: item.transform[4] + item.width });

        const y = item.transform[5];
        if (currentY === null || Math.abs(y - currentY) > 2) {
          if (currentLine.length > 0) lines.push(currentLine.join(' '));
          currentLine = [];
          currentY = y;
        }
        currentLine.push(item.str);
      }
      if (currentLine.length > 0) lines.push(currentLine.join(' '));

      pagesTextTokens.push(pageTokens);
      pagesLines.push(lines);
    }
  } catch {
    return {
      fileType: 'pdf',
      rows: [],
      headerFound: false,
      error: 'Nepavyko nuskaityti šio PDF. Patikrink, ar jame yra pažymimas tekstas (ne nuskenuotas vaizdas).',
    };
  }

  if (totalChars > 0) {
    const structuredRows = extractBoqTable(pagesTextTokens);
    if (structuredRows.length > 0) {
      return { fileType: 'pdf', rows: structuredRows, headerFound: true, pdfExtractionMethod: 'text' };
    }

    const legacyRows = pagesLines
      .flat()
      .map(parsePdfLineToRow)
      .filter((r): r is Omit<BoqRow, 'packageId'> => r !== null);
    if (legacyRows.length > 0) {
      return { fileType: 'pdf', rows: legacyRows, headerFound: false, pdfExtractionMethod: 'text' };
    }

    return {
      fileType: 'pdf',
      rows: [],
      headerFound: false,
      error: 'Iš šio PDF nepavyko ištraukti BOQ pozicijų. Failas turi teksto sluoksnį, bet jame neaptikta atpažįstamų pozicijų.',
    };
  }

  // No text layer at all — this PDF's content is vector paths/outlines, not real glyphs. OCR is the only option.
  try {
    const pagesOcrTokens = await ocrPdfPages(file, onOcrProgress);
    const ocrRows = extractBoqTable(pagesOcrTokens, 18);
    if (ocrRows.length === 0) {
      return {
        fileType: 'pdf',
        rows: [],
        headerFound: false,
        pdfExtractionMethod: 'ocr',
        error: 'Iš šio PDF nepavyko ištraukti BOQ pozicijų. Galimai tai nuskenuotas vaizdas be pažymimo teksto.',
      };
    }
    return { fileType: 'pdf', rows: ocrRows, headerFound: true, pdfExtractionMethod: 'ocr' };
  } catch {
    return {
      fileType: 'pdf',
      rows: [],
      headerFound: false,
      error: 'Nepavyko atpažinti šio PDF teksto (OCR nepavyko). Patikrink, ar failas nėra pažeistas.',
    };
  }
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

export async function parseBoqFile(file: File, onOcrProgress?: (progress: OcrProgress) => void): Promise<BoqParseResult> {
  const ext = extensionOf(file.name);
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(file);
  if (ext === 'pdf') return parsePdf(file, onOcrProgress);
  const fileType: BoqFileType = 'unknown';
  return { fileType, rows: [], headerFound: false, error: 'Nepalaikomas failo tipas. Įkelk Excel arba PDF failą.' };
}

export type { OcrProgress };
