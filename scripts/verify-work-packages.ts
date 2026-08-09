import assert from 'node:assert/strict';
import type { BoqRow, WorkPackage } from '../lib/boq/types';
import {
  isPackageNameAvailable,
  makeUniquePackageName,
  mergeWorkPackages,
  moveRowsToPackage,
  removeEmptyPackage,
  splitRowsIntoPackage,
} from '../lib/boq/workPackageOperations';

const packages: WorkPackage[] = [
  { id: 'earth', name: 'Žemės darbai', source: 'classified' },
  { id: 'concrete', name: 'Betonavimas', source: 'classified' },
];
const rows: BoqRow[] = [
  { id: 'r1', positionNumber: '1.1', name: 'Kasimas', unit: 'm3', quantity: 10, notes: null, rawSection: null, sourceReference: null, packageId: 'earth' },
  { id: 'r2', positionNumber: '2.1', name: 'Betonas', unit: 'm3', quantity: 5, notes: null, rawSection: null, sourceReference: null, packageId: 'concrete' },
];

assert.equal(isPackageNameAvailable(packages, '  žemės   DARBAI '), false);
assert.equal(isPackageNameAvailable(packages, 'Armatūra'), true);
assert.equal(makeUniquePackageName(packages, 'Žemės darbai'), 'Žemės darbai 2');

const moved = moveRowsToPackage(rows, ['r1'], 'concrete');
assert.equal(moved.find((row) => row.id === 'r1')?.packageId, 'concrete');
assert.equal(rows.find((row) => row.id === 'r1')?.packageId, 'earth', 'operation must remain immutable');

const merged = mergeWorkPackages(packages, rows, ['concrete', 'earth']);
assert.deepEqual(merged.packages.map((pkg) => pkg.id), ['earth']);
assert.ok(merged.rows.every((row) => row.packageId === 'earth'));

const split = splitRowsIntoPackage(packages, rows, ['r1'], { id: 'new', name: 'Sklypo paruošimas', source: 'custom' });
assert.equal(split.rows.find((row) => row.id === 'r1')?.packageId, 'new');
assert.equal(split.packages.at(-1)?.id, 'new');

assert.equal(removeEmptyPackage(packages, rows, 'earth').length, 2, 'non-empty package cannot be removed');
assert.deepEqual(removeEmptyPackage(packages, moved, 'earth').map((pkg) => pkg.id), ['concrete']);

console.log('Work package operation checks passed');
