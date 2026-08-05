import type { BoqRow, WorkPackage } from './types';

export const OTHER_PACKAGE_NAME = 'Kiti darbai';

/**
 * Darbų paketų atpažinimo žodynas. Raktažodžiai tikrinami prieš normalizuotą (mažosiomis
 * raidėmis) pozicijos pavadinimo tekstą. Tvarka svarbi — pirmas atitikimas laimi, todėl
 * siauresnės/specifiškesnės kategorijos (pvz. "Nuotekos") eina prieš bendresnes.
 */
export const PACKAGE_KEYWORDS: { name: string; keywords: string[] }[] = [
  {
    name: 'Žemės darbai',
    keywords: ['žemės darb', 'iškasim', 'kasimo darb', 'grunto', 'sklypo parengim', 'užpylim', 'iškasa'],
  },
  { name: 'Pamatai', keywords: ['pamat', 'rostverk'] },
  { name: 'Betonavimas', keywords: ['betonavim', 'betono', 'betonin', 'gelžbetoni'] },
  { name: 'Armatūra', keywords: ['armatūr', 'armavim'] },
  { name: 'Mūras', keywords: ['mūras', 'mūrijim', 'mūrini', 'blokeli', 'plyt'] },
  { name: 'Stogas', keywords: ['stog', 'čerp', 'skard'] },
  { name: 'Langai', keywords: ['langas', 'langai', 'langų', 'lango'] },
  { name: 'Durys', keywords: ['durys', 'durų', 'durims'] },
  { name: 'Nuotekos', keywords: ['nuoteko', 'kanalizacij'] },
  { name: 'Vandentiekis', keywords: ['vandentiek', 'vandens tiekim'] },
  {
    name: 'Elektra',
    keywords: ['elektr', 'kabeli', 'skydin', 'apšvietim', 'instaliacij', 'jungikl', 'lizd'],
  },
  { name: 'Asfaltas', keywords: ['asfalt'] },
  { name: 'Šaligatviai', keywords: ['šaligatv', 'trinkel'] },
  { name: 'Keliai', keywords: ['kelio', 'kelias', 'keliai', 'privažiavim'] },
  { name: 'Apželdinimas', keywords: ['apželdinim', 'veja', 'medži', 'krūm', 'sodinim'] },
  { name: 'Gerbūvis', keywords: ['gerbūvi', 'aptvėrim', 'tvora', 'tvoros'] },
];

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function classifyRowToPackageName(name: string): string {
  const normalized = normalize(name);
  for (const pkg of PACKAGE_KEYWORDS) {
    if (pkg.keywords.some((k) => normalized.includes(k))) return pkg.name;
  }
  return OTHER_PACKAGE_NAME;
}

export interface BuildPackagesResult {
  packages: WorkPackage[];
  rows: BoqRow[];
  /** true = grouped by the file's own Section column; false = grouped by classifying position text. */
  usedFileSections: boolean;
}

/**
 * Groups freshly-parsed rows into work packages. Prefers the file's own section values when a
 * real majority of rows actually have one; otherwise classifies every row from its own text —
 * never invents a section that isn't backed by either the file or a keyword match.
 */
export function buildWorkPackages(
  parsedRows: Omit<BoqRow, 'packageId'>[],
  idFactory: () => string
): BuildPackagesResult {
  const withSection = parsedRows.filter((r) => r.rawSection && r.rawSection.trim().length > 0);
  const usedFileSections = parsedRows.length > 0 && withSection.length / parsedRows.length >= 0.5;

  const packageByName = new Map<string, WorkPackage>();
  const rows: BoqRow[] = [];

  for (const row of parsedRows) {
    const packageName = usedFileSections
      ? row.rawSection && row.rawSection.trim() ? row.rawSection.trim() : OTHER_PACKAGE_NAME
      : classifyRowToPackageName(row.name);

    let pkg = packageByName.get(packageName);
    if (!pkg) {
      pkg = { id: idFactory(), name: packageName, source: usedFileSections ? 'section' : 'classified' };
      packageByName.set(packageName, pkg);
    }
    rows.push({ ...row, packageId: pkg.id });
  }

  return { packages: [...packageByName.values()], rows, usedFileSections };
}
