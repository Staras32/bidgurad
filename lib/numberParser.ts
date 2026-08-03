/**
 * Patikimai apdoroja tiek europietišką ("1.500,50"), tiek amerikietišką
 * ("1,500.50") skaičių formatą, taip pat paprastą "1500,50" ar "1500.50".
 */
export function parseEuNumber(raw: unknown): number {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return raw;

  let s = String(raw).trim().replace(/[^\d.,-]/g, '');
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // "1.500,50" -> taškas tūkstančių skirtukas, kablelis dešimtainis
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // "1,500.50" -> kablelis tūkstančių skirtukas
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }

  return parseFloat(s);
}
