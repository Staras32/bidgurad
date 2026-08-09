import type { BoqRow, WorkPackage } from './types';

export interface WorkPackageState {
  packages: WorkPackage[];
  rows: BoqRow[];
}

export function normalizePackageName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('lt-LT');
}

export function isPackageNameAvailable(packages: WorkPackage[], name: string, exceptId?: string): boolean {
  const normalized = normalizePackageName(name);
  return normalized.length > 0 && !packages.some((pkg) => pkg.id !== exceptId && normalizePackageName(pkg.name) === normalized);
}

export function makeUniquePackageName(packages: WorkPackage[], baseName: string): string {
  const base = baseName.trim().replace(/\s+/g, ' ');
  if (isPackageNameAvailable(packages, base)) return base;
  let suffix = 2;
  while (!isPackageNameAvailable(packages, `${base} ${suffix}`)) suffix++;
  return `${base} ${suffix}`;
}

export function moveRowsToPackage(rows: BoqRow[], rowIds: Iterable<string>, packageId: string): BoqRow[] {
  const selected = new Set(rowIds);
  if (selected.size === 0) return rows;
  return rows.map((row) => (selected.has(row.id) ? { ...row, packageId } : row));
}

export function mergeWorkPackages(packages: WorkPackage[], rows: BoqRow[], packageIds: Iterable<string>): WorkPackageState {
  const selected = new Set(packageIds);
  const ordered = packages.filter((pkg) => selected.has(pkg.id));
  if (ordered.length < 2) return { packages, rows };
  const targetId = ordered[0].id;
  const removedIds = new Set(ordered.slice(1).map((pkg) => pkg.id));
  return {
    packages: packages.filter((pkg) => !removedIds.has(pkg.id)),
    rows: rows.map((row) => (removedIds.has(row.packageId) ? { ...row, packageId: targetId } : row)),
  };
}

export function splitRowsIntoPackage(
  packages: WorkPackage[],
  rows: BoqRow[],
  rowIds: Iterable<string>,
  newPackage: WorkPackage
): WorkPackageState {
  const selected = new Set(rowIds);
  if (selected.size === 0) return { packages, rows };
  return {
    packages: [...packages, newPackage],
    rows: moveRowsToPackage(rows, selected, newPackage.id),
  };
}

export function removeEmptyPackage(packages: WorkPackage[], rows: BoqRow[], packageId: string): WorkPackage[] {
  if (rows.some((row) => row.packageId === packageId)) return packages;
  return packages.filter((pkg) => pkg.id !== packageId);
}
