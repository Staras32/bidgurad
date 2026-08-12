import type { BoqRow } from '@/lib/boq/types';
import type { SupplierRequestItem } from './types';

export interface ScopeIssue {
  rowId: string;
  positionNumber: string | null;
  name: string;
  missing: Array<'positionNumber' | 'unit' | 'quantity'>;
}

export interface ScopeValidationResult {
  valid: boolean;
  issues: ScopeIssue[];
}

export function validateRequestScope(rows: BoqRow[]): ScopeValidationResult {
  const issues = rows.flatMap((row) => {
    const missing: ScopeIssue['missing'] = [];
    if (!row.positionNumber?.trim()) missing.push('positionNumber');
    if (!row.unit?.trim()) missing.push('unit');
    if (row.quantity === null || !Number.isFinite(row.quantity)) missing.push('quantity');
    return missing.length > 0
      ? [{ rowId: row.id, positionNumber: row.positionNumber, name: row.name, missing }]
      : [];
  });
  return { valid: issues.length === 0, issues };
}

function itemKey(item: Pick<SupplierRequestItem, 'source_row_id' | 'position_number' | 'name'>): string {
  const position = item.position_number?.trim().toLocaleLowerCase('lt-LT');
  if (position) return `position:${position}`;
  if (item.source_row_id) return `source:${item.source_row_id}`;
  return `name:${item.name.trim().toLocaleLowerCase('lt-LT')}`;
}

function rowKey(row: BoqRow): string {
  const position = row.positionNumber?.trim().toLocaleLowerCase('lt-LT');
  if (position) return `position:${position}`;
  if (row.id) return `source:${row.id}`;
  return `name:${row.name.trim().toLocaleLowerCase('lt-LT')}`;
}

export interface QuantityChange {
  positionNumber: string | null;
  name: string;
  previousQuantity: number | null;
  currentQuantity: number | null;
  unit: string | null;
}

export interface ScopeVersionDiff {
  added: BoqRow[];
  removed: SupplierRequestItem[];
  quantityChanged: QuantityChange[];
  unchanged: number;
}

export interface StoredScopeVersionDiff {
  added: SupplierRequestItem[];
  removed: SupplierRequestItem[];
  quantityChanged: QuantityChange[];
  unchanged: number;
}

export function compareScopeVersion(previous: SupplierRequestItem[], current: BoqRow[]): ScopeVersionDiff {
  const previousByKey = new Map(previous.map((item) => [itemKey(item), item]));
  const currentByKey = new Map(current.map((row) => [rowKey(row), row]));
  const added = current.filter((row) => !previousByKey.has(rowKey(row)));
  const removed = previous.filter((item) => !currentByKey.has(itemKey(item)));
  const quantityChanged: QuantityChange[] = [];
  let unchanged = 0;

  for (const row of current) {
    const old = previousByKey.get(rowKey(row));
    if (!old) continue;
    if (old.quantity !== row.quantity) {
      quantityChanged.push({
        positionNumber: row.positionNumber,
        name: row.name,
        previousQuantity: old.quantity,
        currentQuantity: row.quantity,
        unit: row.unit,
      });
    } else unchanged += 1;
  }

  return { added, removed, quantityChanged, unchanged };
}

export function compareStoredScopeVersions(
  previous: SupplierRequestItem[],
  current: SupplierRequestItem[]
): StoredScopeVersionDiff {
  const previousByKey = new Map(previous.map((item) => [itemKey(item), item]));
  const currentByKey = new Map(current.map((item) => [itemKey(item), item]));
  const added = current.filter((item) => !previousByKey.has(itemKey(item)));
  const removed = previous.filter((item) => !currentByKey.has(itemKey(item)));
  const quantityChanged: QuantityChange[] = [];
  let unchanged = 0;

  for (const item of current) {
    const old = previousByKey.get(itemKey(item));
    if (!old) continue;
    if (old.quantity !== item.quantity) {
      quantityChanged.push({
        positionNumber: item.position_number,
        name: item.name,
        previousQuantity: old.quantity,
        currentQuantity: item.quantity,
        unit: item.unit,
      });
    } else unchanged += 1;
  }

  return { added, removed, quantityChanged, unchanged };
}
