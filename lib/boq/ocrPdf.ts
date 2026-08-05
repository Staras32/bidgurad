import type { PositionedToken } from './reconstructTable';

export interface OcrProgress {
  page: number;
  totalPages: number;
  stage: 'render' | 'ocr';
}

/** Renders each PDF page to a canvas and OCRs it with Tesseract.js (Lithuanian), returning word-level positioned tokens. */
export async function ocrPdfPages(file: File, onProgress?: (progress: OcrProgress) => void): Promise<PositionedToken[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

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
