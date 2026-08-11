import { extractBoqTable, type PositionedToken } from '../lib/boq/reconstructTable';

const tokens: PositionedToken[] = [];

function token(text: string, x: number, y: number): void {
  tokens.push({ text, x, y, x2: x + Math.max(24, text.length * 8) });
}

for (const [index, description, unit, quantity] of [
  ['1', 'Asfalto dangos frezavimas', 'm²', '120'],
  ['2', 'Skaldos pagrindo įrengimas', 'm³', '35'],
  ['3', 'Kelio bortų montavimas', 'm', '84'],
] as const) {
  const y = 100 + Number(index) * 45;
  token(index, 80, y);
  token(description, 210, y);
  token(unit, 820, y);
  token(quantity, 930, y);
  token('12,50', 1050, y);
  token('1500,00', 1170, y);
}

const result = extractBoqTable([tokens], 10);
if (result.rows.length !== 3) {
  throw new Error(`Tikėtasi 3 pozicijų, gauta ${result.rows.length}: ${JSON.stringify(result, null, 2)}`);
}
if (result.rows.some((row) => !row.unit || row.quantity === null || row.name.includes('12,50'))) {
  throw new Error(`Neteisingai atkurti stulpeliai: ${JSON.stringify(result.rows, null, 2)}`);
}

console.log(JSON.stringify(result.rows, null, 2));
