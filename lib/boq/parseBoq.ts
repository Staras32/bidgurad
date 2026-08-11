import * as XLSX from 'xlsx';
import { uid } from '@/lib/uid';
import type { BoqFileType, BoqParseResult, BoqRow, ExcludedBoqLine } from './types';
import { extractBoqTable, type PositionedToken } from './reconstructTable';
import { classifyBoqCandidate } from './boqRowRules';
import { ocrPdfPages, type OcrProgress } from './ocrPdf';

type Row = (string | number | undefined)[];

const FIELD_KEYWORDS = {
  position: ['eil. nr', 'eil.nr', 'eil nr', 'poz. nr', 'pozicijos nr', 'nr.', 'poz.', 'pozicija', 'sąm. eil', 'sam. eil'],
  name: ['darbų pavadinimas', 'darbu pavadinimas', 'pozicijos pavadinimas', 'pavadinimas', 'aprašymas', 'aprasymas', 'aprašymai', 'aprasymai', 'darbų ir išlaidų', 'darbu ir islaidu', 'darbai'],
  unit: ['mato vnt', 'matavimo vienetas', 'mato vienetas', 'mato', 'vnt.', 'vnt'],
  quantity: ['kiekis'],
  notes: ['pastabos', 'pastaba', 'komentaras', 'darbo kodas', 'kodas'],
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

interface HeaderMatch {
  index: number;
  height: number;
  row: Row;
}

function mergeHeaderRows(rows: Row[]): Row {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => rows.map((row) => cellText(row, column)).filter(Boolean).join(' '));
}

/** Lithuanian estimates commonly place the table after title blocks and split headings across 2 rows. */
function findBoqHeader(allRows: Row[]): HeaderMatch | null {
  let best: (HeaderMatch & { score: number }) | null = null;
  for (let index = 0; index < Math.min(50, allRows.length); index++) {
    for (let height = 1; height <= 3 && index + height <= allRows.length; height++) {
      const row = mergeHeaderRows(allRows.slice(index, index + height));
      const score = countFieldHits(row);
      if (score >= 3 && (!best || score > best.score || (score === best.score && height < best.height))) {
        best = { index, height, row, score };
      }
    }
  }
  return best ? { index: best.index, height: best.height, row: best.row } : null;
}

function findBoqHeaderRow(allRows: Row[]): number {
  return findBoqHeader(allRows)?.index ?? -1;
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

const PROJECT_TITLE_LABELS = [
  /^(?:objekto pavadinimas|statybos objektas|projekto pavadinimas|objektas)\s*[:–—-]?\s*(.*)$/i,
  /^(?:užsakovas|statytojas)\s*[:–—-]?\s*(.*)$/i,
] as const;

const PROJECT_TITLE_TERMS = /(?:kapitalin|rekonstr|remont|statyb|gatv|kelio|tako|pastat|infrastruktūr)/i;
const PROJECT_TITLE_NOISE = /^(?:lokalinė sąmata|sąmata|darbų kiekių žiniaraštis|žiniaraštis|tvirtinu|suderinta|data|lapas|puslapis)/i;

function cleanProjectTitle(value: string | null | undefined): string | null {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
    .trim();
  if (cleaned.length < 4 || cleaned.length > 120 || PROJECT_TITLE_NOISE.test(cleaned)) return null;
  return cleaned;
}

/** Reads only the document title block. Explicit object labels win; customer labels are the fallback. */
export function detectProjectNameFromRows(allRows: Row[], headerIndex = -1): string | null {
  const limit = headerIndex >= 0 ? Math.min(headerIndex, 50) : Math.min(allRows.length, 30);
  const titleRows = allRows.slice(0, limit);

  for (const label of PROJECT_TITLE_LABELS) {
    for (let rowIndex = 0; rowIndex < titleRows.length; rowIndex++) {
      const values = titleRows[rowIndex].map((cell) => String(cell ?? '').trim()).filter(Boolean);
      for (let cellIndex = 0; cellIndex < values.length; cellIndex++) {
        const match = values[cellIndex].match(label);
        if (!match) continue;
        const inlineValue = cleanProjectTitle(match[1]);
        if (inlineValue) return inlineValue;
        const sameRowValue = cleanProjectTitle(values[cellIndex + 1]);
        if (sameRowValue) return sameRowValue;
        for (let nextRow = rowIndex + 1; nextRow <= Math.min(rowIndex + 2, titleRows.length - 1); nextRow++) {
          const nextValue = cleanProjectTitle(titleRows[nextRow].map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' '));
          if (nextValue) return nextValue;
        }
      }
    }
  }

  const descriptiveCandidates = titleRows
    .map((row) => cleanProjectTitle(row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' ')))
    .filter((value): value is string => Boolean(value && PROJECT_TITLE_TERMS.test(value)));
  return descriptiveCandidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

interface SheetExtraction {
  rows: Omit<BoqRow, 'packageId'>[];
  excluded: ExcludedBoqLine[];
}

/**
 * Runs every candidate row through the same deterministic, rule-based BOQ-line classifier used for PDFs:
 * a row only becomes a real BOQ position when it has a position number, description, unit, AND quantity.
 * Everything else — section headers, boilerplate, incomplete rows — is reported as excluded, not guessed at.
 */
function rowsFromSheet(allRows: Row[], sheetName: string): SheetExtraction {
  const header = findBoqHeader(allRows);
  const headerIdx = header?.index ?? -1;
  const headerFound = header !== null;
  const rows: Omit<BoqRow, 'packageId'>[] = [];
  const excluded: ExcludedBoqLine[] = [];

  const classify = (position: string, name: string, unit: string, quantityRaw: string, notesRaw: string | null, rawSection: string | null, sourceReference: string) => {
    const result = classifyBoqCandidate({ position, name, unit, quantityRaw, sourceReference });
    if ('accepted' in result) {
      rows.push({
        id: uid(),
        positionNumber: result.accepted.positionNumber,
        name: result.accepted.name,
        unit: result.accepted.unit,
        quantity: result.accepted.quantity,
        notes: notesRaw,
        rawSection,
        sourceReference: result.accepted.sourceReference,
      });
    } else {
      excluded.push({ ...result.rejected, sourceReference });
    }
  };

  if (headerFound) {
    const headerRow = header.row;
    const cols = {
      position: guessColumn(headerRow, FIELD_KEYWORDS.position),
      name: guessColumn(headerRow, FIELD_KEYWORDS.name),
      unit: guessColumn(headerRow, FIELD_KEYWORDS.unit),
      quantity: guessColumn(headerRow, FIELD_KEYWORDS.quantity),
      notes: guessColumn(headerRow, FIELD_KEYWORDS.notes),
      section: guessColumn(headerRow, FIELD_KEYWORDS.section),
    };

    const dataRows = allRows
      .map((row, index) => ({ row, index }))
      .slice(headerIdx + header.height)
      .filter(({ row }) => row.some((c) => c !== undefined && String(c).trim() !== ''));

    if (cols.name === -1) {
      // No confidently-detected name column — nothing to reliably classify against.
      for (const { row: r, index } of dataRows) {
        const raw = r.map((c) => (c == null ? '' : String(c).trim())).filter(Boolean).join(' — ');
        if (raw) excluded.push({ raw, reason: 'Nepavyko atpažinti stulpelių', sourceReference: `${sheetName}, ${index + 1} eil.` });
      }
      return { rows, excluded };
    }

    let currentSection: string | null = null;
    let currentSectionNumber: string | null = null;

    for (const { row: r, index } of dataRows) {
      const qtyRaw = cols.quantity >= 0 ? cellText(r, cols.quantity) ?? '' : '';
      const position = cellText(r, cols.position) ?? '';
      const name = cellText(r, cols.name) ?? '';
      const unit = cellText(r, cols.unit) ?? '';
      const notes = cellText(r, cols.notes);
      const explicitSection = cellText(r, cols.section);

      // Common estimate section: empty position, numeric code in "Darbo kodas", title in description.
      if (!position && name && !unit && !qtyRaw && notes && /^\d+(?:\.\d+)*$/.test(notes.trim())) {
        currentSectionNumber = notes.trim();
        currentSection = name;
        continue;
      }

      const hierarchicalPosition = position && currentSectionNumber ? `${currentSectionNumber}.${position}` : position;
      classify(hierarchicalPosition, name, unit, qtyRaw, notes, explicitSection ?? currentSection, `${sheetName}, ${index + 1} eil.`);
    }
    return { rows, excluded };
  }

  // No header confidently detected — nothing to map columns from, so every non-empty row is excluded.
  const dataRows = allRows.filter((r) => r.some((c) => c !== undefined && String(c).trim() !== ''));
  for (const [index, r] of dataRows.entries()) {
    const raw = r.map((c) => (c == null ? '' : String(c).trim())).filter(Boolean).join(' — ');
    if (raw) excluded.push({ raw, reason: 'Antraštės eilutė neaptikta', sourceReference: `${sheetName}, ${index + 1} eil.` });
  }
  return { rows, excluded };
}

async function parseXlsx(file: File): Promise<BoqParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (workbook.SheetNames.length === 0) {
      return { fileType: 'xlsx', rows: [], excluded: [], headerFound: false, error: 'Šiame faile nerasta nuskaitomo lapo.' };
    }
    const rows: Omit<BoqRow, 'packageId'>[] = [];
    const excluded: ExcludedBoqLine[] = [];
    let headerFound = false;
    let readableSheetFound = false;
    let projectNameSuggestion: string | undefined;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const allRows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: true });
      if (allRows.length === 0) continue;
      readableSheetFound = true;
      const headerRow = findBoqHeaderRow(allRows);
      if (headerRow !== -1) headerFound = true;
      projectNameSuggestion ??= detectProjectNameFromRows(allRows, headerRow) ?? undefined;
      const extracted = rowsFromSheet(allRows, sheetName);
      rows.push(...extracted.rows);
      excluded.push(...extracted.excluded);
    }

    if (!readableSheetFound) {
      return { fileType: 'xlsx', rows: [], excluded: [], headerFound: false, error: 'Šis failas atrodo tuščias.' };
    }
    if (rows.length === 0) {
      return { fileType: 'xlsx', rows: [], excluded, headerFound, error: 'Šiame faile nerasta BOQ pozicijų.' };
    }
    return { fileType: 'xlsx', rows, excluded, headerFound, projectNameSuggestion };
  } catch {
    return { fileType: 'xlsx', rows: [], excluded: [], headerFound: false, error: 'Nepavyko nuskaityti failo. Patikrink, ar tai tinkamas Excel failas.' };
  }
}

const POSITION_PREFIX = /^\s*(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+/;
const TRAILING_QTY_UNIT = /(\d+[.,]?\d*)\s*(vnt\.?|kompl\.?|komplektas|m2|m²|m3|m³|kv\.?\s?m\.?|kub\.?\s?m\.?|kg|t\.?|val\.?|m\.?p\.?|m)\s*$/i;

export function parsePdfLineToCandidate(line: string): { position: string; name: string; unit: string; quantityRaw: string } | null {
  const trimmed = line.trim();
  if (trimmed.length < 3) return null;
  if (/^(puslapis|page)\s*\d+/i.test(trimmed)) return null;
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return null;

  let rest = trimmed;
  let position = '';
  const posMatch = rest.match(POSITION_PREFIX);
  if (posMatch) {
    position = posMatch[1];
    rest = rest.slice(posMatch[0].length);
  }

  let unit = '';
  let quantityRaw = '';
  const qtyMatch = rest.match(TRAILING_QTY_UNIT);
  if (qtyMatch) {
    quantityRaw = qtyMatch[1];
    unit = qtyMatch[2].replace(/\s+/g, ' ');
    rest = rest.slice(0, qtyMatch.index).trim();
  }

  if (!rest && !position) return null;
  return { position, name: rest, unit, quantityRaw };
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
      excluded: [],
      headerFound: false,
      error: 'Nepavyko nuskaityti šio PDF. Patikrink, ar jame yra pažymimas tekstas (ne nuskenuotas vaizdas).',
    };
  }

  if (totalChars > 0) {
    const projectNameSuggestion = detectProjectNameFromRows(pagesLines[0]?.map((line) => [line]) ?? []) ?? undefined;
    const structured = extractBoqTable(pagesTextTokens);
    if (structured.rows.length > 0) {
      return { fileType: 'pdf', rows: structured.rows, excluded: structured.excluded, headerFound: true, pdfExtractionMethod: 'text', projectNameSuggestion };
    }

    const legacyExcluded: ExcludedBoqLine[] = [];
    const legacyRows: Omit<BoqRow, 'packageId'>[] = [];
    for (const [pageIndex, pageLines] of pagesLines.entries()) {
      for (const line of pageLines) {
      const candidate = parsePdfLineToCandidate(line);
      if (!candidate) continue;
      const sourceReference = `PDF, ${pageIndex + 1} psl.`;
      const result = classifyBoqCandidate({ ...candidate, sourceReference });
      if ('accepted' in result) {
        legacyRows.push({
          id: uid(),
          positionNumber: result.accepted.positionNumber,
          name: result.accepted.name,
          unit: result.accepted.unit,
          quantity: result.accepted.quantity,
          notes: null,
          rawSection: null,
          sourceReference,
        });
      } else {
        legacyExcluded.push({ ...result.rejected, sourceReference });
      }
      }
    }
    if (legacyRows.length > 0) {
      return { fileType: 'pdf', rows: legacyRows, excluded: legacyExcluded, headerFound: false, pdfExtractionMethod: 'text', projectNameSuggestion };
    }

    return {
      fileType: 'pdf',
      rows: [],
      excluded: [...structured.excluded, ...legacyExcluded],
      headerFound: false,
      error: 'Iš šio PDF nepavyko ištraukti BOQ pozicijų. Failas turi teksto sluoksnį, bet jame neaptikta atpažįstamų pozicijų.',
    };
  }

  // No text layer at all — this PDF's content is vector paths/outlines, not real glyphs. OCR is the only option.
  try {
    const pagesOcrTokens = await ocrPdfPages(file, onOcrProgress);
    const ocrResult = extractBoqTable(pagesOcrTokens, 18);
    if (ocrResult.rows.length === 0) {
      return {
        fileType: 'pdf',
        rows: [],
        excluded: ocrResult.excluded,
        headerFound: false,
        pdfExtractionMethod: 'ocr',
        error: 'Iš šio PDF nepavyko ištraukti BOQ pozicijų. Galimai tai nuskenuotas vaizdas be pažymimo teksto.',
      };
    }
    return { fileType: 'pdf', rows: ocrResult.rows, excluded: ocrResult.excluded, headerFound: true, pdfExtractionMethod: 'ocr' };
  } catch {
    return {
      fileType: 'pdf',
      rows: [],
      excluded: [],
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
  return { fileType, rows: [], excluded: [], headerFound: false, error: 'Nepalaikomas failo tipas. Įkelk Excel arba PDF failą.' };
}

export type { OcrProgress };
