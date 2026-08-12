export const MAX_BOQ_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SUPPLIER_QUOTE_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 250;

export function fileSizeLimitMessage(maxBytes: number): string {
  return `Failas per didelis. Didžiausias leidžiamas dydis – ${Math.round(maxBytes / 1024 / 1024)} MB.`;
}
