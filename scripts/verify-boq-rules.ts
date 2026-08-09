import assert from 'node:assert/strict';
import { classifyBoqCandidate } from '../lib/boq/boqRowRules';
import { parsePdfLineToCandidate } from '../lib/boq/parseBoq';

const accepted = classifyBoqCandidate({
  position: '12.3.104',
  name: 'Monolitiniai gelžbetonio pamatai',
  unit: 'm3',
  quantityRaw: '138,5',
});
assert.ok('accepted' in accepted);
if ('accepted' in accepted) assert.equal(accepted.accepted.quantity, 138.5);

for (const name of ['TVIRTINU', 'SUDERINTA', 'Atsakingas atstovas: Jonas', 'Iš viso']) {
  const result = classifyBoqCandidate({ position: '1.1', name, unit: 'vnt.', quantityRaw: '1' });
  assert.ok('rejected' in result, `${name} must be rejected`);
}

const duplicateSafeUnit = parsePdfLineToCandidate('1.1 Statybvietes paruosimas 1 kompl.');
assert.deepEqual(duplicateSafeUnit, {
  position: '1.1',
  name: 'Statybvietes paruosimas',
  unit: 'kompl.',
  quantityRaw: '1',
});

const pdfAccepted = duplicateSafeUnit && classifyBoqCandidate(duplicateSafeUnit);
assert.ok(pdfAccepted && 'accepted' in pdfAccepted);

console.log('BOQ deterministic rule checks passed');
