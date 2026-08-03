import * as XLSX from 'xlsx';
import { parseCsvText } from '@/lib/importParser';

export type DetectedFileType = 'xlsx' | 'csv' | 'pdf' | 'unknown';

export interface FileRowDetection {
  fileType: DetectedFileType;
  /** null when the row count cannot be determined client-side (e.g. PDF). */
  rowCount: number | null;
  error?: string;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

/**
 * Reads a file's raw structure to report a row count for the wizard's upload preview.
 * This is plain file parsing (sheet dimensions / line count) — it does not guess
 * columns, validate scope, or run any BidGuard bid-comparison logic.
 */
export async function detectFileRows(file: File): Promise<FileRowDetection> {
  const ext = extensionOf(file.name);

  if (ext === 'pdf') {
    return { fileType: 'pdf', rowCount: null };
  }

  if (ext === 'csv') {
    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      if (rows.length < 2) {
        return { fileType: 'csv', rowCount: null, error: 'This file looks empty — no readable rows were found.' };
      }
      return { fileType: 'csv', rowCount: rows.length };
    } catch {
      return { fileType: 'csv', rowCount: null, error: "This file couldn't be read. Confirm it's a valid CSV export." };
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        return { fileType: 'xlsx', rowCount: null, error: 'No readable sheet was found in this workbook.' };
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
      if (rows.length < 2) {
        return { fileType: 'xlsx', rowCount: null, error: 'This file looks empty — no readable rows were found.' };
      }
      return { fileType: 'xlsx', rowCount: rows.length };
    } catch {
      return { fileType: 'xlsx', rowCount: null, error: "This file couldn't be read. Confirm it's a valid Excel file." };
    }
  }

  return { fileType: 'unknown', rowCount: null, error: 'Unsupported file type. Upload an Excel or PDF file.' };
}
