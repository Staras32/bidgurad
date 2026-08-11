import type { PositionedToken } from './reconstructTable';
import { PDFJS_DOCUMENT_OPTIONS } from './pdfjsConfig';

export interface OcrProgress {
  page: number;
  totalPages: number;
  stage: 'render' | 'ocr';
}

/**
 * BOQ tables are usually drawn with dense black grid lines. Tesseract otherwise treats those lines as
 * letters ("I", "|", "t") or joins adjacent cells. Remove only page-spanning dark runs; normal glyph
 * strokes are far too short to pass these thresholds. The operation is deterministic and keeps the
 * original cell contents intact.
 */
function removeTableGridLines(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  const horizontal = new Uint8Array(height);
  const vertical = new Uint8Array(width);

  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      if (luminance < 120) dark++;
    }
    if (dark >= width * 0.35) horizontal[y] = 1;
  }

  for (let x = 0; x < width; x++) {
    let dark = 0;
    for (let y = 0; y < height; y++) {
      const offset = (y * width + x) * 4;
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      if (luminance < 120) dark++;
    }
    if (dark >= height * 0.2) vertical[x] = 1;
  }

  const whiten = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  };

  for (let y = 0; y < height; y++) {
    if (!horizontal[y]) continue;
    for (let spread = -2; spread <= 2; spread++) {
      for (let x = 0; x < width; x++) whiten(x, y + spread);
    }
  }
  for (let x = 0; x < width; x++) {
    if (!vertical[x]) continue;
    for (let spread = -2; spread <= 2; spread++) {
      for (let y = 0; y < height; y++) whiten(x + spread, y);
    }
  }

  ctx.putImageData(image, 0, 0);
}

/** Renders each PDF page to a canvas and OCRs it with Tesseract.js (Lithuanian), returning word-level positioned tokens. */
export async function ocrPdfPages(file: File, onProgress?: (progress: OcrProgress) => void): Promise<PositionedToken[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer, ...PDFJS_DOCUMENT_OPTIONS }).promise;

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('lit');

  const pagesTokens: PositionedToken[][] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      onProgress?.({ page: pageNum, totalPages: doc.numPages, stage: 'render' });
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-context-unavailable');
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      removeTableGridLines(ctx, canvas.width, canvas.height);

      onProgress?.({ page: pageNum, totalPages: doc.numPages, stage: 'ocr' });
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const tokens: PositionedToken[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const text = word.text.trim();
              if (!text) continue;
              tokens.push({ text, x: word.bbox.x0, y: word.bbox.y0, x2: word.bbox.x1 });
            }
          }
        }
      }
      pagesTokens.push(tokens);
    }
  } finally {
    await worker.terminate();
  }

  return pagesTokens;
}
