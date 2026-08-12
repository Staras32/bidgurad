import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBoqFile } from '../lib/boq/parseBoq';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(name: string, expectedRows: number, expectedMethod?: 'text' | 'ocr') {
  const target = path.join(root, 'tests', 'fixtures', name);
  const bytes = await readFile(target);
  const file = new File([bytes], name);
  const result = await parseBoqFile(file);

  assert.equal(result.error, undefined, `${name}: ${result.error}`);
  assert.equal(result.rows.length, expectedRows, `${name}: netikėtas pozicijų skaičius`);
  if (expectedMethod) assert.equal(result.pdfExtractionMethod, expectedMethod, `${name}: netinkamas PDF metodas`);
  assert.ok(result.rows.every((row) => row.positionNumber && row.name && row.unit && row.quantity !== null));
  return result;
}

async function main() {
  await fixture('boq-deterministic-smoke.xlsx', 6);
  await fixture('boq-text-layer-smoke.pdf', 4, 'text');

  const realExcelPath = process.env.BIDGUARD_REAL_EXCEL_FIXTURE;
  if (realExcelPath) {
    const bytes = await readFile(realExcelPath);
    const name = path.basename(realExcelPath);
    const result = await parseBoqFile(new File([bytes], name));
    assert.equal(result.error, undefined, `${name}: ${result.error}`);
    assert.ok(result.rows.length > 0, `${name}: nerasta nė viena pozicija`);
    console.log(`Realus Excel failas: ${result.rows.length} pozicijų`);
  }

  const realPdfPath = process.env.BIDGUARD_REAL_PDF_FIXTURE;
  if (realPdfPath) {
    const bytes = await readFile(realPdfPath);
    const name = path.basename(realPdfPath);
    const result = await parseBoqFile(new File([bytes], name));
    assert.equal(result.error, undefined, `${name}: ${result.error}`);
    assert.ok(result.rows.length > 0, `${name}: nerasta nė viena pozicija`);
    assert.equal(result.pdfExtractionMethod, 'text', `${name}: realus vektorinis PDF turi būti skaitomas be OCR`);
    console.log(`Realus PDF failas: ${result.rows.length} pozicijų, metodas ${result.pdfExtractionMethod}`);
  }

  console.log('Excel ir tekstinio PDF parserio regresiniai testai sėkmingi');
}

void main();
