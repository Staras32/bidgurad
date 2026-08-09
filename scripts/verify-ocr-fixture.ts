import { createWorker } from 'tesseract.js';
import { extractBoqTable, type PositionedToken } from '../lib/boq/reconstructTable';

async function main() {
  const worker = await createWorker('lit');
  try {
  const { data } = await worker.recognize('tests/fixtures/boq-ocr-source.png', {}, { blocks: true });
  const tokens: PositionedToken[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const text = word.text.trim();
          if (text) tokens.push({ text, x: word.bbox.x0, y: word.bbox.y0, x2: word.bbox.x1 });
        }
      }
    }
  }
  const result = extractBoqTable([tokens], 18);
  console.log(JSON.stringify({ rows: result.rows, excluded: result.excluded }, null, 2));
  if (result.rows.length !== 4) process.exitCode = 1;
  } finally {
    await worker.terminate();
  }
}

void main();
