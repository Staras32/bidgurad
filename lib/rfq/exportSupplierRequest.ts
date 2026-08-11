import * as XLSX from 'xlsx';
import type { BoqRow, WorkPackage } from '@/lib/boq/types';
import { selectedPackageNames } from './supplierRequest';

interface ExportDetails {
  projectName: string;
  rows: BoqRow[];
  packages: WorkPackage[];
}

function safeFileName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'tiekejo-uzklausa';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function packageNameForRow(row: BoqRow, packages: WorkPackage[]): string {
  return packages.find((pkg) => pkg.id === row.packageId)?.name ?? '';
}

export function exportSupplierRequestExcel(details: ExportDetails) {
  const packageNames = selectedPackageNames(details.rows, details.packages);
  const generatedAt = new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const data = [
    ['Projektas', details.projectName],
    ['Darbų paketai', packageNames.join(', ')],
    ['Pozicijų skaičius', details.rows.length],
    ['Parengta', generatedAt],
    [],
    ['Poz. Nr.', 'Darbų pavadinimas', 'Mato vnt.', 'Kiekis', 'Pastabos', 'Nuoroda į TS', 'Darbų paketas'],
    ...details.rows.map((row) => [
      row.positionNumber ?? '',
      row.name,
      row.unit ?? '',
      row.quantity ?? '',
      row.notes ?? '',
      row.sourceReference ?? '',
      packageNameForRow(row, details.packages),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 13 },
    { wch: 58 },
    { wch: 12 },
    { wch: 14 },
    { wch: 34 },
    { wch: 20 },
    { wch: 30 },
  ];
  worksheet['!freeze'] = { xSplit: 0, ySplit: 6 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tiekėjo užklausa');
  XLSX.writeFile(workbook, `${safeFileName(details.projectName)}-tiekejo-uzklausa.xlsx`);
}

function splitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function buildImagePdf(images: Uint8Array[], imageWidth: number, imageHeight: number): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const addObject = (number: number, body: string | Uint8Array, streamPrefix?: string) => {
    offsets[number] = length;
    append(`${number} 0 obj\n`);
    if (streamPrefix !== undefined) {
      append(`${streamPrefix}\nstream\n`);
      append(body);
      append('\nendstream\n');
    } else append(body);
    append('\nendobj\n');
  };

  append('%PDF-1.4\n%âãÏÓ\n');
  const pageObjects = images.map((_, index) => 3 + index * 3);
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, `<< /Type /Pages /Kids [${pageObjects.map((number) => `${number} 0 R`).join(' ')}] /Count ${images.length} >>`);

  images.forEach((image, index) => {
    const pageNumber = pageObjects[index];
    const imageNumber = pageNumber + 1;
    const contentNumber = pageNumber + 2;
    const resourceName = `Im${index + 1}`;
    addObject(
      pageNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /${resourceName} ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`
    );
    addObject(
      imageNumber,
      image,
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>`
    );
    const content = `q\n595.28 0 0 841.89 0 0 cm\n/${resourceName} Do\nQ`;
    addObject(contentNumber, encoder.encode(content), `<< /Length ${encoder.encode(content).length} >>`);
  });

  const xrefOffset = length;
  const objectCount = 2 + images.length * 3;
  append(`xref\n0 ${objectCount + 1}\n`);
  append('0000000000 65535 f \n');
  for (let number = 1; number <= objectCount; number += 1) {
    append(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const pdf = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, cursor);
    cursor += chunk.length;
  }
  return pdf;
}

export function exportSupplierRequestPdf(details: ExportDetails) {
  const width = 1240;
  const height = 1754;
  const margin = 72;
  const rowGap = 12;
  const packageNames = selectedPackageNames(details.rows, details.packages);
  const pages: Uint8Array[] = [];
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const initialContext = canvas.getContext('2d');
  if (!initialContext) throw new Error('Naršyklė negali parengti PDF dokumento.');
  let context: CanvasRenderingContext2D = initialContext;
  let y = 0;
  let pageNumber = 1;

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const nextContext = canvas.getContext('2d');
    if (!nextContext) throw new Error('Naršyklė negali parengti PDF dokumento.');
    context = nextContext;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111827';
    context.font = '700 34px Arial, sans-serif';
    context.fillText('Kainos pasiūlymo užklausa', margin, 92);
    context.fillStyle = '#6b7280';
    context.font = '400 18px Arial, sans-serif';
    context.fillText(`Projektas: ${details.projectName}`, margin, 132);
    context.fillText(`Darbų paketai: ${packageNames.join(', ')}`, margin, 162);
    context.fillText(`Pasirinkta pozicijų: ${details.rows.length}`, margin, 192);
    context.fillText(`Puslapis ${pageNumber}`, width - margin - 110, 92);
    context.fillStyle = '#f3f4f6';
    context.fillRect(margin, 224, width - margin * 2, 48);
    context.fillStyle = '#374151';
    context.font = '700 17px Arial, sans-serif';
    context.fillText('Poz. Nr.', margin + 12, 255);
    context.fillText('Darbų pavadinimas', margin + 150, 255);
    context.fillText('Vnt.', width - margin - 240, 255);
    context.fillText('Kiekis', width - margin - 130, 255);
    y = 292;
  };

  const finishPage = () => {
    pages.push(base64ToBytes(canvas.toDataURL('image/jpeg', 0.88)));
    pageNumber += 1;
  };

  startPage();
  for (const row of details.rows) {
    context.font = '400 18px Arial, sans-serif';
    const descriptionLines = splitText(context, row.name, width - margin * 2 - 410);
    const rowHeight = Math.max(46, descriptionLines.length * 24 + 18);
    if (y + rowHeight > height - 90) {
      finishPage();
      startPage();
    }
    context.strokeStyle = '#e5e7eb';
    context.beginPath();
    context.moveTo(margin, y + rowHeight);
    context.lineTo(width - margin, y + rowHeight);
    context.stroke();
    context.fillStyle = '#4b5563';
    context.font = '400 17px Arial, sans-serif';
    context.fillText(row.positionNumber ?? '—', margin + 12, y + 29);
    context.fillStyle = '#111827';
    context.font = '400 18px Arial, sans-serif';
    descriptionLines.forEach((line, lineIndex) => context.fillText(line, margin + 150, y + 29 + lineIndex * 24));
    context.fillStyle = '#4b5563';
    context.fillText(row.unit ?? '—', width - margin - 240, y + 29);
    context.fillText(row.quantity === null ? '—' : String(row.quantity), width - margin - 130, y + 29);
    y += rowHeight + rowGap;
  }
  finishPage();

  const pdf = buildImagePdf(pages, width, height);
  const pdfBuffer = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(pdfBuffer).set(pdf);
  downloadBlob(new Blob([pdfBuffer], { type: 'application/pdf' }), `${safeFileName(details.projectName)}-tiekejo-uzklausa.pdf`);
}
