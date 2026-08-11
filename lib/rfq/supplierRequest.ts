import type { BoqRow, WorkPackage } from '@/lib/boq/types';

export interface SupplierRequestDetails {
  projectName: string;
  supplierName: string;
  responseDeadline: string;
  rows: BoqRow[];
  packages: WorkPackage[];
}

export function selectedPackageNames(rows: BoqRow[], packages: WorkPackage[]): string[] {
  const selectedIds = new Set(rows.map((row) => row.packageId));
  return packages.filter((pkg) => selectedIds.has(pkg.id)).map((pkg) => pkg.name);
}

export function formatLithuanianDate(value: string): string {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatPositionCount(count: number): string {
  const form = new Intl.PluralRules('lt-LT').select(count);
  const word = form === 'one' ? 'pozicija' : form === 'few' ? 'pozicijos' : 'pozicijų';
  return `${count.toLocaleString('lt-LT')} sąmatos ${word}`;
}

export function personalizeSupplierEmail(body: string, recipientName: string): string {
  const name = recipientName.trim();
  if (!name) return body;
  const lines = body.split('\n');
  if (lines[0]?.startsWith('Sveiki')) lines[0] = `Sveiki, ${name},`;
  return lines.join('\n');
}

export function buildSupplierEmail(details: SupplierRequestDetails): { subject: string; body: string } {
  const packageNames = selectedPackageNames(details.rows, details.packages);
  const scopeName = packageNames.join(', ') || 'pasirinkta darbų apimtis';
  const greeting = details.supplierName.trim() ? `Sveiki, ${details.supplierName.trim()},` : 'Sveiki,';
  const deadline = formatLithuanianDate(details.responseDeadline);

  const subject = `Kainos pasiūlymo užklausa – ${details.projectName} – ${scopeName}`;
  const body = [
    greeting,
    '',
    `Kviečiame pateikti kainos pasiūlymą projektui „${details.projectName}“.`,
    '',
    'Prašoma darbų apimtis:',
    ...packageNames.map((name) => `• ${name}`),
    `• ${formatPositionCount(details.rows.length)}`,
    '',
    'Detali darbų apimtis ir kiekiai pateikti pridedamame faile.',
    '',
    'Prašome pasiūlyme atskirai nurodyti:',
    '• bendrą kainą be PVM;',
    '• darbų atlikimo terminą;',
    '• pasiūlymo galiojimo laiką;',
    '• aiškiai neįtrauktus darbus ir medžiagas.',
    '',
    deadline ? `Pasiūlymą prašome pateikti iki ${deadline}.` : 'Pasiūlymo pateikimo terminą suderinsime atskirai.',
    '',
    'Kilus klausimų, prašome juos pateikti atsakant į šį laišką.',
    '',
    'Pagarbiai',
  ].join('\n');

  return { subject, body };
}
