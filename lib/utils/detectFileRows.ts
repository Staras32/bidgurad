import * as XLSX from 'xlsx';
import { findHeaderRow, parseCsvText, type Row } from '@/lib/importParser';

export type DetectedFileType = 'xlsx' | 'csv' | 'pdf' | 'unknown';

/**
 * Structural issues detected directly from a single file's real content.
 * `missingRows` and `unexpectedColumns` are NOT produced here — they only make
 * sense once a file is compared against a reference (the BOQ), so callers add
 * those separately once both files are known.
 */
export type WarningReason =
  | 'missingHeaders'
  | 'emptyCells'
  | 'duplicateRows'
  | 'unreadablePdf'
  | 'missingRows'
  | 'unexpectedColumns';

export interface FileRowDetection {
  fileType: DetectedFileType;
  /** null when it cannot be determined client-side (e.g. PDF). */
  rowCount: number | null;
  /** null when it cannot be determined client-side (e.g. PDF). */
  columnCount: number | null;
  warnings: WarningReason[];
  error?: string;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function trimmedRowLength(row: Row): number {
  let last = -1;
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== undefined && String(row[i]).trim() !== '') last = i;
  }
  return last + 1;
}

/** Analyzes real row/column structure and returns warnings found from the actual data — no fabricated counts. */
function analyzeRows(allRows: Row[]): { rowCount: number; columnCount: number; warnings: WarningReason[] } {
  const warnings: WarningReason[] = [];
  const headerIdx = findHeaderRow(allRows);
  const headerFound = headerIdx !== -1;
  if (!headerFound) warnings.push('missingHeaders');

  const headerRow = allRows[headerFound ? headerIdx : 0] ?? [];
  const columnCount = Math.max(trimmedRowLength(headerRow), 1);

  // When no header is confidently detected, every row is treated as data —
  // we must not silently discard row 0 just because it looks header-shaped.
  const dataRows = allRows
    .slice(headerFound ? headerIdx + 1 : 0)
    .filter((r) => r.some((c) => c !== undefined && String(c).trim() !== ''));

  const rowsWithEmptyCells = dataRows.filter((r) => {
    for (let i = 0; i < columnCount; i++) {
      if (r[i] === undefined || String(r[i]).trim() === '') return true;
    }
    return false;
  });
  if (rowsWithEmptyCells.length > 0) warnings.push('emptyCells');

  const seen = new Map<string, number>();
  for (const r of dataRows) {
    const key = r
      .slice(0, columnCount)
      .map((c) => String(c ?? '').trim().toLowerCase())
      .join('|');
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  if ([...seen.values()].some((count) => count > 1)) warnings.push('duplicateRows');

  return { rowCount: dataRows.length, columnCount, warnings };
}

/**
 * Reads a file's real structure for the wizard's upload preview: row count, column
 * count, and structural warnings (missing headers, empty cells, duplicate rows).
 * This is plain file parsing — it does not guess column meaning, validate scope,
 * or run any BidGuard bid-comparison logic. Every number returned comes directly
 * from the uploaded file; nothing here is estimated or hardcoded.
 */
export async function detectFileRows(file: File): Promise<FileRowDetection> {
  const ext = extensionOf(file.name);

  if (ext === 'pdf') {
    // We have no client-side PDF text/table extraction, so structure genuinely
    // cannot be verified. That is a real limitation, not a "Ready" result.
    return { fileType: 'pdf', rowCount: null, columnCount: null, warnings: ['unreadablePdf'] };
  }

  if (ext === 'csv') {
    try {
      const text = await file.text();
      const allRows = parseCsvText(text);
      if (allRows.length === 0) {
        return {
          fileType: 'csv',
          rowCount: null,
          columnCount: null,
          warnings: [],
          error: 'This file looks empty — no readable rows were found.',
        };
      }
      const { rowCount, columnCount, warnings } = analyzeRows(allRows);
      if (rowCount === 0) {
        return {
          fileType: 'csv',
          rowCount: null,
          columnCount: null,
          warnings: [],
          error: 'No data rows were found below the header.',
        };
      }
      return { fileType: 'csv', rowCount, columnCount, warnings };
    } catch {
      return {
        fileType: 'csv',
        rowCount: null,
        columnCount: null,
        warnings: [],
        error: "This file couldn't be read. Confirm it's a valid CSV export.",
      };
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        return {
          fileType: 'xlsx',
          rowCount: null,
          columnCount: null,
          warnings: [],
          error: 'No readable sheet was found in this workbook.',
        };
      }
      const allRows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: false });
      if (allRows.length === 0) {
        return {
          fileType: 'xlsx',
          rowCount: null,
          columnCount: null,
          warnings: [],
          error: 'This file looks empty — no readable rows were found.',
        };
      }
      const { rowCount, columnCount, warnings } = analyzeRows(allRows);
      if (rowCount === 0) {
        return {
          fileType: 'xlsx',
          rowCount: null,
          columnCount: null,
          warnings: [],
          error: 'No data rows were found below the header.',
        };
      }
      return { fileType: 'xlsx', rowCount, columnCount, warnings };
    } catch {
      return {
        fileType: 'xlsx',
        rowCount: null,
        columnCount: null,
        warnings: [],
        error: "This file couldn't be read. Confirm it's a valid Excel file.",
      };
    }
  }

  return {
    fileType: 'unknown',
    rowCount: null,
    columnCount: null,
    warnings: [],
    error: 'Unsupported file type. Upload an Excel or PDF file.',
  };
}
