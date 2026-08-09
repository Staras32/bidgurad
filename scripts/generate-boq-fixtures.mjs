import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const fixtureDirectory = path.resolve('tests/fixtures');
fs.mkdirSync(fixtureDirectory, { recursive: true });

const workbook = XLSX.utils.book_new();

const mainRows = [
  ['TVIRTINU', '', '', '', '2026-08-09'],
  ['Užsakovas', 'UAB „Techninis testas“'],
  ['Eil. Nr.', 'Darbų pavadinimas', 'Mato vnt.', 'Kiekis', 'Pastabos'],
  ['1.1', 'Statybvietės paruošimas', 'kompl.', '1', ''],
  ['1.2', 'Ašių nužymėjimas ir geodezija', 'kompl.', '1', ''],
  ['2.1', 'Grunto kasimas iki projektinės altitudės', 'm³', '485,5', ''],
  ['', 'Žemės darbai', '', '', 'skyriaus antraštė'],
  ['2.2', 'Smėlio pagrindo įrengimas ir tankinimas', 'm3', '216', ''],
  ['', 'Iš viso', '', '702,5', ''],
  ['', 'Atsakingas atstovas: Jonas Testas', '', '', ''],
];

const secondaryRows = [
  ['Poz. Nr.', 'Aprašymas', 'Vnt.', 'Kiekis'],
  ['3.1', 'Monolitiniai gelžbetonio pamatai C25/30', 'm³', '138'],
  ['3.2', 'Armatūros karkasų montavimas B500B', 't', '18,6'],
  ['', 'SUDERINTA', '', ''],
  ['', 'Puslapis 2', '', ''],
];

XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mainRows), 'Pagrindinis BOQ');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(secondaryRows), 'Konstrukcijos');
XLSX.writeFile(workbook, path.join(fixtureDirectory, 'boq-deterministic-smoke.xlsx'));

console.log('Generated tests/fixtures/boq-deterministic-smoke.xlsx (expected accepted rows: 6)');
