'use client';

import { useState, type ClipboardEvent } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FolderOpen,
  Layers3,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Award,
  Copy,
  Download,
  FileWarning,
  Flag as FlagIcon,
  Mail,
  MessageCircle,
  Printer,
  Quote,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from 'lucide-react';

import {
  Alert,
  Badge,
  type BadgeVariant,
  Button,
  Card,
  type CardVariant,
  CardContent,
  EmptyState,
  FileUpload,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHeadCell,
  TableHeader,
  TableRow,
  Text,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { uid } from '@/lib/uid';
import { storage } from '@/lib/storage';
import { parseEuNumber } from '@/lib/numberParser';
import { findHeaderRow, guessAllColumns, parseCsvText, buildItemsFromColumns, norm, type Row } from '@/lib/importParser';
import type {
  Bid,
  BidItem,
  Analysis,
  FlagFeedback,
  FlagFeedbackEntry,
  FlagType,
  SavedProject,
  PendingImport,
  ImportTemplate,
  Severity,
} from '@/lib/types';

const emptyBid = (): Bid => ({
  id: uid(),
  name: '',
  items: [{ id: uid(), desc: '', price: '' }],
  exclusions: '',
});

const SAMPLE: Bid[] = [
  {
    id: uid(),
    name: 'UAB Elektromontas',
    exclusions:
      'Neįtraukta: laikinas elektros tiekimas statybos metu, leidimų gavimas, darbas savaitgaliais be papildomo susitarimo.',
    items: [
      { id: uid(), desc: 'Elektros instaliacija, gyvenamosios patalpos', price: '180000' },
      { id: uid(), desc: 'Skydinės montavimas ir prijungimas', price: '42000' },
      { id: uid(), desc: 'Apšvietimo prietaisų montavimas', price: '26400' },
    ],
  },
  {
    id: uid(),
    name: 'MB Voltas Baltic',
    exclusions: 'Apimtis gali keistis pagal faktinę situaciją objekte. Kaina preliminari.',
    items: [
      { id: uid(), desc: 'Pilna elektros instaliacija namui', price: '175000' },
      { id: uid(), desc: 'Skydas + prijungimas', price: '40000' },
      { id: uid(), desc: 'Šviestuvų montavimas', price: '25650' },
    ],
  },
  {
    id: uid(),
    name: 'UAB Srovė ir Ko',
    exclusions: 'Neįtraukta: leidimų derinimas su tinklų operatoriumi, medžiagos virš standartinės komplektacijos.',
    items: [
      { id: uid(), desc: 'El. instaliacijos darbai (visos patalpos)', price: '182000' },
      { id: uid(), desc: 'Elektros skydo įrengimas', price: '43000' },
      { id: uid(), desc: 'Apšvietimo sistema', price: '28700' },
      { id: uid(), desc: 'Laikinas statybinis elektros tiekimas', price: '6000' },
    ],
  },
];

function createSampleAnalysis(): Analysis {
  const [supplierA, supplierB, supplierC] = SAMPLE;
  const categories = [
    'Darbų zonos paruošimas',
    'Trasos nužymėjimas',
    'Grunto kasimas',
    'Smėlio pagrindo įrengimas',
    'Skaldos sluoksnio įrengimas',
    'Vamzdyno klojimas',
    'Vamzdyno bandymai',
    'Šulinių montavimas',
    'Elektros kabelių klojimas',
    'Valdymo spintos montavimas',
    'Asfalto dangos įrengimas',
    'Bortų įrengimas',
    'Teritorijos sutvarkymas',
    'Dokumentacijos parengimas',
  ];

  return {
    scopeMatrix: categories.map((kategorija, index) => ({
      kategorija,
      eilutes: [
        { bidId: supplierA.id, yra: true, kaina: null, originalus_aprasymas: kategorija },
        {
          bidId: supplierB.id,
          yra: index !== 6,
          kaina: null,
          originalus_aprasymas: index === 6 ? null : kategorija,
        },
        { bidId: supplierC.id, yra: true, kaina: null, originalus_aprasymas: kategorija },
      ],
    })),
    bidScores: [
      { bidId: supplierA.id, balas: 86, pagrindimas: 'Pilniausia darbų apimtis ir aiškiausios komercinės sąlygos. Kaina nėra mažiausia, tačiau pasiūlyme aptikta mažiausiai neapibrėžtumo.' },
      { bidId: supplierB.id, balas: 48, pagrindimas: 'Mažiausia kaina, tačiau trūksta dalies apimties ir pasiūlyme paliktos preliminarios kainodaros sąlygos.' },
      { bidId: supplierC.id, balas: 72, pagrindimas: 'Apimtis pilna, tačiau keli įkainiai reikšmingai skiriasi nuo kitų pasiūlymų ir turėtų būti patikslinti.' },
    ],
    flags: [
      { bidId: supplierB.id, tipas: 'scope_gap', sunkumas: 'high', aprasymas: 'Pasiūlyme nerasta vamzdyno bandymų ir rezultatų įforminimo apimtis.' },
      { bidId: supplierB.id, tipas: 'risky_language', sunkumas: 'high', aprasymas: 'Nurodyta, kad galutinė kaina gali keistis pagal faktinę situaciją objekte.' },
      { bidId: supplierC.id, tipas: 'price_outlier', sunkumas: 'medium', aprasymas: 'Asfalto dangos įkainis apie 22 % didesnis už kitų tiekėjų pasiūlymus.' },
      { bidId: supplierB.id, tipas: 'unique_exclusion', sunkumas: 'medium', aprasymas: 'Leidimų ir derinimo darbai išskirti iš bendros pasiūlymo kainos.' },
      { bidId: supplierA.id, tipas: 'unique_exclusion', sunkumas: 'low', aprasymas: 'Darbas savaitgaliais galimas tik pagal atskirą susitarimą.' },
    ],
    santrauka: 'UAB Elektromontas rekomenduojamas dėl pilnos apimties ir aiškiausių sąlygų. MB Voltas Baltic pateikė mažiausią kainą, tačiau prieš sprendimą būtina patikslinti trūkstamą apimtį ir preliminarios kainos sąlygą.',
  };
}

function riskTier(score: number): { label: string; variant: BadgeVariant; tileClassName: string; barClassName: string; Icon: typeof ShieldCheck } {
  if (score >= 75) {
    return {
      label: 'SAUGUS',
      variant: 'success',
      tileClassName: 'border-success-200 bg-success-50 text-success-700',
      barClassName: 'bg-success-500',
      Icon: ShieldCheck,
    };
  }
  if (score >= 45) {
    return {
      label: 'VERTA PATIKRINTI',
      variant: 'warning',
      tileClassName: 'border-warning-200 bg-warning-50 text-warning-700',
      barClassName: 'bg-warning-500',
      Icon: AlertCircle,
    };
  }
  return {
    label: 'RIZIKINGA',
    variant: 'danger',
    tileClassName: 'border-danger-200 bg-danger-50 text-danger-700',
    barClassName: 'bg-danger-500',
    Icon: ShieldAlert,
  };
}

const FLAG_TITLES: Record<FlagType, string> = {
  price_outlier: 'Kainos išskirtis',
  scope_gap: 'Apimties spraga',
  risky_language: 'Rizikinga formuluotė',
  unique_exclusion: 'Unikali išimtis',
};

const RECOMMENDATION_BY_TYPE: Record<FlagType, string> = {
  scope_gap:
    'Paprašyk rangovo patvirtinti ir įkainoti šią apimties dalį prieš skiriant darbus, arba aiškiai ją išbrauk iš visų pasiūlymų sąžiningam palyginimui.',
  price_outlier: 'Prieš remiantis bendra kaina, patikrink šios eilutės apimtį ir kainodaros prielaidas su rangovu.',
  risky_language: 'Paprašyk rangovo raštu pašalinti arba patikslinti šią sąlygą prieš pasirašant sutartį.',
  unique_exclusion: 'Patikrink, ar ši išimtis yra standartinė praktika, ar būdinga tik šiam pasiūlymui, ir įvertink jos poveikį bendrai kainai.',
};

const SEVERITY_LABEL: Record<Severity, string> = { high: 'Aukšta', medium: 'Vidutinė', low: 'Žema' };
const SEVERITY_CARD_VARIANT: Record<Severity, CardVariant> = { high: 'danger', medium: 'warning', low: 'success' };
const SEVERITY_BADGE_VARIANT: Record<Severity, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' };

type DetailTabKey = 'missingScope' | 'priceAnomalies' | 'riskyWording' | 'qualificationIssues' | 'duplicateItems' | 'generalComments';

const DETAIL_TABS: { key: DetailTabKey; label: string; icon: typeof AlertTriangle }[] = [
  { key: 'missingScope', label: 'Trūkstama apimtis', icon: AlertTriangle },
  { key: 'priceAnomalies', label: 'Kainų anomalijos', icon: TrendingUp },
  { key: 'riskyWording', label: 'Rizikingos formuluotės', icon: Quote },
  { key: 'qualificationIssues', label: 'Kvalifikacijos išlygos', icon: FileWarning },
  { key: 'duplicateItems', label: 'Pasikartojančios eilutės', icon: Copy },
  { key: 'generalComments', label: 'Bendri komentarai', icon: MessageCircle },
];

const TAB_TO_FLAG_TYPE: Partial<Record<DetailTabKey, FlagType>> = {
  missingScope: 'scope_gap',
  priceAnomalies: 'price_outlier',
  riskyWording: 'risky_language',
  qualificationIssues: 'unique_exclusion',
};

const EMPTY_TAB_MESSAGE: Partial<Record<DetailTabKey, string>> = {
  missingScope: 'Trūkstamos apimties nerasta',
  priceAnomalies: 'Kainų anomalijų nerasta',
  riskyWording: 'Rizikingų formuluočių nerasta',
  qualificationIssues: 'Kvalifikacijos išlygų nerasta',
};

interface DuplicateItem {
  desc: string;
  count: number;
}

function findDuplicateItems(bid: Bid): DuplicateItem[] {
  const counts = new Map<string, DuplicateItem>();
  for (const item of bid.items) {
    const key = item.desc.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { desc: item.desc.trim(), count: 1 });
  }
  return [...counts.values()].filter((d) => d.count > 1);
}

const selectClass =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 transition-colors duration-150 ease-out hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500';

function RiskItemCard({
  title,
  severity,
  reason,
  recommendation,
  feedback,
  onAgree,
  onFalsePositive,
  onComment,
}: {
  title: string;
  severity: Severity;
  reason: string;
  recommendation: string;
  feedback?: FlagFeedbackEntry;
  onAgree?: () => void;
  onFalsePositive?: () => void;
  onComment?: (value: string) => void;
}) {
  return (
    <Card variant={SEVERITY_CARD_VARIANT[severity]}>
      <CardContent>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <Badge variant={SEVERITY_BADGE_VARIANT[severity]}>{SEVERITY_LABEL[severity]}</Badge>
        </div>
        <p className="text-sm text-gray-700">{reason}</p>
        <div className="mt-2.5 rounded-md bg-white/70 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Rekomendacija</p>
          <p className="mt-0.5 text-xs text-gray-700">{recommendation}</p>
        </div>
        {onAgree && onFalsePositive && (
          <>
            <div className="mt-2.5 flex items-center gap-2 border-t border-gray-100 pt-2.5">
              <button
                onClick={onAgree}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ease-out',
                  feedback?.decision === 'agree'
                    ? 'border-success-200 bg-success-50 text-success-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                Sutinku
              </button>
              <button
                onClick={onFalsePositive}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ease-out',
                  feedback?.decision === 'false_positive'
                    ? 'border-danger-200 bg-danger-50 text-danger-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                Klaidingas perspėjimas
              </button>
            </div>
            {feedback?.decision && onComment && (
              <Input
                className="mt-2"
                placeholder="Komentaras (nebūtina)..."
                value={feedback.comment || ''}
                onChange={(e) => onComment(e.target.value)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type ViewMode = 'analyze' | 'projects' | 'contractors';

export default function BidGuard() {
  const [view, setView] = useState<ViewMode>('analyze');
  const [bids, setBids] = useState<Bid[]>(() => [emptyBid(), emptyBid()]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTabKey>('missingScope');
  const [projectLabel, setProjectLabel] = useState('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [flagFeedback, setFlagFeedback] = useState<FlagFeedback>({});
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isSamplePreview, setIsSamplePreview] = useState(false);
  const [uploadedFileNames, setUploadedFileNames] = useState<Record<string, string>>({});

  // ---------- Pasiūlymų / eilučių valdymas ----------

  const addBid = () => setBids((b) => [...b, emptyBid()]);
  const removeBid = (id: string) => setBids((b) => (b.length > 2 ? b.filter((x) => x.id !== id) : b));
  const loadSample = () => {
    setBids(SAMPLE);
    setAnalysis(createSampleAnalysis());
    setIsSamplePreview(true);
    setError('');
    setFlagFeedback({});
    setTimeout(() => document.getElementById('comparison-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const resetAll = () => {
    setBids([emptyBid(), emptyBid()]);
    setAnalysis(null);
    setIsSamplePreview(false);
    setUploadedFileNames({});
    setError('');
  };
  const returnToInputs = () => {
    if (isSamplePreview) {
      resetAll();
      return;
    }
    setAnalysis(null);
    setSelectedBidId(null);
    setError('');
  };

  const updateBid = (id: string, field: 'name' | 'exclusions', value: string) =>
    setBids((b) => b.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const addItem = (bidId: string) =>
    setBids((b) =>
      b.map((x) => (x.id === bidId ? { ...x, items: [...x.items, { id: uid(), desc: '', price: '' }] } : x))
    );

  const removeItem = (bidId: string, itemId: string) =>
    setBids((b) =>
      b.map((x) => (x.id === bidId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x))
    );

  const updateItem = (bidId: string, itemId: string, field: keyof BidItem, value: string) =>
    setBids((b) =>
      b.map((x) =>
        x.id === bidId
          ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)) }
          : x
      )
    );

  // ---------- Excel / CSV / įklijavimo importas ----------

  const processRows = (bidId: string, allRows: Row[]) => {
    if (!allRows || allRows.length === 0) {
      setError('Nerasta duomenų.');
      return;
    }

    const headerIdx = findHeaderRow(allRows);
    const headerFound = headerIdx !== -1;
    const rawHeaders = allRows[headerFound ? headerIdx : 0].map((h) => String(h ?? '').trim());
    const headers = headerFound ? rawHeaders : rawHeaders.map((_, idx) => `Stulpelis ${String.fromCharCode(65 + idx)}`);
    const dataRows = allRows
      .slice(headerFound ? headerIdx + 1 : 0)
      .filter((r) => r.some((c) => c !== undefined && c !== ''));

    if (dataRows.length === 0) {
      setError('Nepavyko rasti duomenų eilučių.');
      return;
    }

    const sig = headers.map(norm).join('|') + (headerFound ? '' : '::be-antrastes');
    let guess: ImportTemplate = headerFound
      ? guessAllColumns(headers)
      : { descCol: -1, priceCol: -1, qtyCol: -1, unitCol: -1 };
    let fromTemplate = false;

    const remembered = storage.get('import-template:' + sig);
    if (remembered) {
      try {
        const t = JSON.parse(remembered) as ImportTemplate;
        if (Number.isInteger(t.descCol) && Number.isInteger(t.priceCol)) {
          guess = t;
          fromTemplate = true;
        }
      } catch {
        /* šablonas sugadintas, ignoruojam */
      }
    }

    if (fromTemplate && guess.descCol >= 0 && guess.priceCol >= 0) {
      const result = buildItemsFromColumns(dataRows, guess);
      if (result.error) {
        setError(result.error + ' (įsimintas šablonas nebetinka — pataisyk stulpelius rankiniu būdu.)');
        setPendingImport({ bidId, headers, rows: dataRows, sig, headerFound, ...guess });
      } else if (result.items) {
        setBids((b) => b.map((x) => (x.id === bidId ? { ...x, items: result.items! } : x)));
        setError('');
      }
      return;
    }

    setPendingImport({ bidId, headers, rows: dataRows, sig, headerFound, ...guess });
    setError('');
  };

  const handleFileUpload = (bidId: string, file?: File) => {
    if (!file) return;
    setUploadedFileNames((current) => ({ ...current, [bidId]: file.name }));
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) throw new Error('Tuščias failo turinys.');
        let allRows: Row[];
        if (isCsv) {
          allRows = parseCsvText(String(result));
        } else {
          const wb = XLSX.read(result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true }) as Row[];
        }
        processRows(bidId, allRows);
      } catch {
        setError('Nepavyko nuskaityti failo. Patikrink, ar tai .xlsx, .xls arba .csv.');
      }
    };
    if (isCsv) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  };

  const handlePasteImport = (bidId: string, e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') || '';
    if (!text.trim()) {
      setError('Iškarpinėje nerasta teksto.');
      return;
    }
    const allRows: Row[] = text
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((line) => line.split('\t').map((c) => c.trim()));
    processRows(bidId, allRows);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const { bidId, rows, descCol, priceCol, qtyCol, unitCol, sig } = pendingImport;
    const result = buildItemsFromColumns(rows, { descCol, priceCol, qtyCol, unitCol });
    if (result.error || !result.items) {
      setError(result.error || 'Importas nepavyko.');
      return;
    }
    setBids((b) => b.map((x) => (x.id === bidId ? { ...x, items: result.items! } : x)));
    storage.set('import-template:' + sig, JSON.stringify({ descCol, priceCol, qtyCol, unitCol }));
    setPendingImport(null);
    setError('');
  };

  const cancelImport = () => setPendingImport(null);

  // ---------- AI analizė ----------

  const canAnalyze =
    bids.length >= 2 &&
    bids.every((b) => b.name.trim() && b.items.some((i) => i.desc.trim() && Number(i.price) > 0)) &&
    !isSamplePreview &&
    !loading;
  const readyBidCount = bids.filter(
    (bid) => bid.name.trim() && bid.items.some((item) => item.desc.trim() && Number(item.price) > 0)
  ).length;
  const comparisonStep = analysis ? 3 : readyBidCount >= 2 ? 2 : 1;

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    setFlagFeedback({});
    try {
      const payload = bids.map((b) => ({
        bidId: b.id,
        subrangovas: b.name,
        eilutes: b.items
          .filter((i) => i.desc.trim() && Number(i.price) > 0)
          .map((i) => ({ aprasymas: i.desc, kaina: Number(i.price) })),
        israsymai_ir_kvalifikacijos: b.exclusions || '(nenurodyta)',
      }));

      const response = await fetch('/api/analyze-bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bids: payload }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'API klaida');
      }
      const parsed = (await response.json()) as Analysis;
      setAnalysis(parsed);
    } catch {
      setError('Analizė nepavyko. Patikrink duomenis ir bandyk dar kartą.');
    } finally {
      setLoading(false);
    }
  };

  const flagKey = (f: { bidId: string; tipas: string; aprasymas: string }) =>
    `${f.bidId}::${f.tipas}::${f.aprasymas}`;

  // ---------- Results Screen: derived comparison data ----------

  const totalPriceForBid = (bid: Bid) => bid.items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

  const coverageForBid = (bidId: string) => {
    const rows = analysis?.scopeMatrix || [];
    if (rows.length === 0) return { pct: null, missing: 0, total: 0 };
    const missing = rows.filter((r) => {
      const cell = (r.eilutes || []).find((e) => e.bidId === bidId);
      return !cell || cell.yra === false;
    }).length;
    return { pct: Math.round(((rows.length - missing) / rows.length) * 100), missing, total: rows.length };
  };

  const commercialStatus = (bidId: string): { label: string; variant: BadgeVariant } => {
    const bidFlags = (analysis?.flags || []).filter((f) => f.bidId === bidId);
    if (bidFlags.some((f) => f.sunkumas === 'high')) return { label: 'Aukšta rizika', variant: 'danger' };
    if (bidFlags.some((f) => f.sunkumas === 'medium')) return { label: 'Verta patikrinti', variant: 'warning' };
    return { label: 'Žema rizika', variant: 'success' };
  };

  const comparisonRows = analysis
    ? bids
        .map((bid) => ({ bid, score: analysis.bidScores.find((s) => s.bidId === bid.id) ?? null }))
        .sort((a, b) => (b.score?.balas ?? -1) - (a.score?.balas ?? -1))
    : [];

  const recommended = comparisonRows[0] ?? null;
  const riskiest =
    comparisonRows.length > 0
      ? [...comparisonRows].sort((a, b) => (a.score?.balas ?? 999) - (b.score?.balas ?? 999))[0]
      : null;
  const recommendedTier = recommended?.score ? riskTier(recommended.score.balas) : null;

  const scopeGapCount = (analysis?.flags || []).filter((f) => f.tipas === 'scope_gap').length;
  const priceOutlierCount = (analysis?.flags || []).filter((f) => f.tipas === 'price_outlier').length;
  const highRiskFlagCount = (analysis?.flags || []).filter((f) => f.sunkumas === 'high').length;
  const reviewedComparisonPoints = (analysis?.scopeMatrix?.length || 0) * bids.length;
  const positiveTotals = comparisonRows.map(({ bid }) => totalPriceForBid(bid)).filter((total) => total > 0);
  const lowestTotal = positiveTotals.length ? Math.min(...positiveTotals) : 0;
  const priorityFlags = [...(analysis?.flags || [])]
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.sunkumas] - { high: 0, medium: 1, low: 2 }[b.sunkumas]))
    .slice(0, 3);

  const selectedBid = selectedBidId ? bids.find((b) => b.id === selectedBidId) || null : null;
  const selectedScore = selectedBidId ? analysis?.bidScores.find((s) => s.bidId === selectedBidId) || null : null;
  const selectedFlags = selectedBidId ? (analysis?.flags || []).filter((f) => f.bidId === selectedBidId) : [];

  const openSupplierDetail = (bidId: string) => {
    setSelectedBidId(bidId);
    setDetailTab('missingScope');
  };

  const handleExportExcel = () => {
    if (!analysis || isSamplePreview) return;
    const rows = bids.map((b) => {
      const score = analysis.bidScores.find((s) => s.bidId === b.id);
      const cov = coverageForBid(b.id);
      const status = commercialStatus(b.id);
      return {
        Rangovas: b.name || '—',
        'Bendra kaina (€)': totalPriceForBid(b),
        'Apimtis %': cov.pct,
        'Aptiktos eilutės': b.items.length,
        'Rizikos balas': score?.balas ?? '',
        'Trūkstami punktai': cov.missing,
        'Komercinis statusas': status.label,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Palyginimas');
    XLSX.writeFile(wb, `bidguard-palyginimas-${Date.now()}.xlsx`);
  };

  const handleGeneratePdf = () => {
    if (!isSamplePreview) window.print();
  };

  const handleGenerateClarificationEmail = (bidId: string) => {
    if (isSamplePreview) return;
    const bid = bids.find((b) => b.id === bidId);
    if (!bid || !analysis) return;
    const bidFlags = analysis.flags.filter((f) => f.bidId === bidId);
    const subject = `Prašome patikslinti — ${bid.name || 'Rangovas'}`;
    const lines = [
      'Laba diena,',
      '',
      'Peržiūrėję jūsų pasiūlymą, norėtume patikslinti šiuos punktus prieš tęsdami:',
      '',
      ...(bidFlags.length > 0
        ? bidFlags.map((f, i) => `${i + 1}. [${FLAG_TITLES[f.tipas]}] ${f.aprasymas}`)
        : ['Papildomų klausimų nėra — ačiū už išsamų pasiūlymą.']),
      '',
      'Ar galėtumėte patvirtinti ar patikslinti aukščiau nurodytus punktus artimiausiu metu?',
      '',
      'Ačiū,',
    ];
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  };

  const renderDetailTabContent = () => {
    if (!selectedBid) return null;

    if (detailTab === 'duplicateItems') {
      const dupes = findDuplicateItems(selectedBid);
      if (dupes.length === 0) return <EmptyState title="Pasikartojančių eilučių nerasta" />;
      return (
        <div className="space-y-3">
          {dupes.map((d, i) => (
            <RiskItemCard
              key={i}
              title="Pasikartojanti eilutė"
              severity="medium"
              reason={`„${d.desc}" pasikartoja ${d.count} kartus šiame pasiūlyme.`}
              recommendation="Patikrink su rangovu, ar tai sąmoninga (pvz. atskiri etapai), ar dubliuota eilutė, ir prireikus pakoreguok bendrą kainą."
            />
          ))}
        </div>
      );
    }

    if (detailTab === 'generalComments') {
      const assessment = selectedScore?.pagrindimas?.trim();
      const notes = selectedBid.exclusions?.trim();
      if (!assessment && !notes) return <EmptyState title="Papildomų komentarų šiam rangovui nėra" />;
      return (
        <div className="space-y-3">
          {assessment && (
            <Card>
              <CardContent>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Bendras įvertinimas</p>
                <p className="text-sm text-gray-700">{assessment}</p>
              </CardContent>
            </Card>
          )}
          {notes && (
            <Card>
              <CardContent>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Rangovo pateiktos pastabos</p>
                <p className="text-sm text-gray-700">{notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    const flagType = TAB_TO_FLAG_TYPE[detailTab];
    const items = flagType ? selectedFlags.filter((f) => f.tipas === flagType) : [];
    if (items.length === 0) {
      return <EmptyState title={EMPTY_TAB_MESSAGE[detailTab] || 'Nieko nerasta'} />;
    }
    return (
      <div className="space-y-3">
        {items.map((f, i) => {
          const key = flagKey(f);
          const fb = flagFeedback[key];
          return (
            <RiskItemCard
              key={i}
              title={FLAG_TITLES[f.tipas]}
              severity={f.sunkumas}
              reason={f.aprasymas}
              recommendation={RECOMMENDATION_BY_TYPE[f.tipas]}
              feedback={fb}
              onAgree={() => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'agree' } }))}
              onFalsePositive={() => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'false_positive' } }))}
              onComment={(v) => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], comment: v } }))}
            />
          );
        })}
      </div>
    );
  };

  // ---------- Projektų / rangovų istorija ----------

  const loadProjects = () => {
    const keys = storage.listKeys('project:');
    const items: SavedProject[] = [];
    for (const k of keys) {
      const raw = storage.get(k);
      if (!raw) continue;
      try {
        items.push(JSON.parse(raw) as SavedProject);
      } catch {
        /* praleidžiam pažeistą įrašą */
      }
    }
    items.sort((a, b) => b.savedAt - a.savedAt);
    setSavedProjects(items);
    setProjectsLoaded(true);
  };

  const saveCurrentProject = () => {
    if (!analysis || isSamplePreview) return;
    setSavingProject(true);
    try {
      const project: SavedProject = {
        id: uid(),
        label: projectLabel.trim() || `Projektas ${new Date().toLocaleDateString('lt-LT')}`,
        savedAt: Date.now(),
        bids: bids.map((b) => ({ id: b.id, name: b.name, exclusions: b.exclusions, items: b.items })),
        analysis,
        flagFeedback,
      };
      storage.set('project:' + project.id, JSON.stringify(project));
      setSavedNotice(true);
      setProjectLabel('');
      setTimeout(() => setSavedNotice(false), 2500);
      if (projectsLoaded) loadProjects();
    } catch {
      setError('Nepavyko išsaugoti projekto.');
    } finally {
      setSavingProject(false);
    }
  };

  const deleteProject = (id: string) => {
    storage.delete('project:' + id);
    setSavedProjects((p) => p.filter((x) => x.id !== id));
  };

  const openProjects = () => {
    setView('projects');
    if (!projectsLoaded) loadProjects();
  };

  const openContractors = () => {
    setView('contractors');
    if (!projectsLoaded) loadProjects();
  };

  const contractorStats = (() => {
    const byName: Record<string, { name: string; projects: number; scores: number[]; highRisk: number }> = {};
    for (const proj of savedProjects) {
      for (const score of proj.analysis?.bidScores || []) {
        const bidMeta = proj.bids?.find((b) => b.id === score.bidId);
        const key = (bidMeta?.name || '').trim().toLowerCase();
        if (!key || !bidMeta) continue;
        if (!byName[key]) byName[key] = { name: bidMeta.name, projects: 0, scores: [], highRisk: 0 };
        byName[key].projects += 1;
        byName[key].scores.push(score.balas);
        if (score.balas < 45) byName[key].highRisk += 1;
      }
    }
    return Object.values(byName)
      .map((c) => ({ ...c, avg: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length) }))
      .sort((a, b) => b.projects - a.projects);
  })();

  // ---------- UI ----------

  return (
    <div className="min-h-screen w-full bg-gray-50 pb-24">
      <header className="border-b border-gray-200/80 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
              <ShieldCheck size={18} aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">BidGuard</span>
            <span className="hidden rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">
              Pasiūlymų valdymas
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/new-project" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900">
              <ArrowLeft size={14} aria-hidden /> <span className="hidden sm:inline">Grįžti į sąmatą</span><span className="sm:hidden">Grįžti</span>
            </Link>
            <Link href="/projects" className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50">
              <FolderOpen size={14} aria-hidden /> <span className="hidden sm:inline">Mano projektai</span><span className="sm:hidden">Projektai</span>
            </Link>
          </div>
        </div>
      </header>

      <nav className="border-b border-gray-200 bg-white print:hidden" aria-label="Pasiūlymų darbo erdvė">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 sm:px-8">
          {([
            { key: 'analyze', label: 'Pasiūlymų palyginimas' },
            { key: 'projects', label: 'Išsaugoti palyginimai', action: openProjects },
            { key: 'contractors', label: 'Rangovų suvestinė', action: openContractors },
          ] as { key: ViewMode; label: string; action?: () => void }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => (t.action ? t.action() : setView(t.key))}
              className={cn(
                'border-b-2 px-4 py-3 text-xs font-medium transition-colors duration-150 ease-out',
                view === t.key
                  ? 'border-primary-600 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-6 px-5 pt-8 sm:px-8 sm:pt-10">
        {view === 'analyze' && (
          <>
            <section className="grid gap-7 border-b border-gray-200 pb-8 lg:grid-cols-[1fr_430px] lg:items-end print:hidden">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">Komercinis pasiūlymų vertinimas</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-gray-950 sm:text-4xl">Palyginkite rangovų pasiūlymus</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                  Įkelkite bent du pasiūlymus. Matysite ne tik bendrą kainą, bet ir trūkstamą apimtį, kainų išskirtis bei sąlygas, kurias verta patikslinti.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-gray-500">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" aria-hidden /> Excel ir CSV</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" aria-hidden /> Apimties palyginimas</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" aria-hidden /> Rizikų prioritetai</span>
                </div>
              </div>
              <Stepper
                steps={[{ label: 'Įkelti pasiūlymus' }, { label: 'Patikrinti duomenis' }, { label: 'Palyginti' }]}
                currentStep={comparisonStep}
                clickableSteps={analysis ? [1, 3] : []}
                onStepClick={(step) => {
                  if (step === 1) returnToInputs();
                  if (step === 3) document.getElementById('comparison-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Badge variant={readyBidCount >= 2 ? 'success' : 'neutral'}>{readyBidCount} paruošti pasiūlymai</Badge>
                {analysis && !isSamplePreview && <Badge variant="info">Palyginimas paruoštas</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={loadSample}>
                  <Sparkles size={14} /> Peržiūrėti pavyzdį
                </Button>
                {(readyBidCount > 0 || analysis) && <Button variant="ghost" size="sm" onClick={resetAll}>Išvalyti</Button>}
              </div>
            </div>

            {!analysis && (
              <Card className="overflow-hidden print:hidden">
                <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
                  <div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><UploadCloud size={19} aria-hidden /></span>
                    <h2 className="mt-4 text-lg font-semibold text-gray-900">Pradėkite nuo gautų failų</h2>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">Kiekvienam rangovui įkelkite atskirą Excel arba CSV pasiūlymą. Aptiktus stulpelius galėsite patikrinti prieš palyginimą.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {[
                      { icon: FileSpreadsheet, label: 'Įkelti', text: 'Failai ir kainos' },
                      { icon: Layers3, label: 'Patikrinti', text: 'Apimtis ir eilutės' },
                      { icon: Building2, label: 'Palyginti', text: 'Sprendimas ir rizikos' },
                    ].map(({ icon: Icon, label, text }, index) => (
                      <div key={label} className="relative rounded-lg border border-gray-200 bg-gray-50 px-2 py-4">
                        <Icon size={17} className="mx-auto text-primary-600" aria-hidden />
                        <p className="mt-2 font-semibold text-gray-800">{index + 1}. {label}</p>
                        <p className="mt-1 hidden text-[11px] text-gray-400 sm:block">{text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis && !isSamplePreview && (
              <div className="flex justify-end print:hidden">
                <Button variant="secondary" size="sm" onClick={returnToInputs}><ArrowLeft size={14} /> Redaguoti pasiūlymus</Button>
              </div>
            )}

            {isSamplePreview && (
              <Alert variant="info" title="Pavyzdinis palyginimas · duomenys netikri">
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span>Ši peržiūra skirta tik parodyti, kaip atrodys rezultatai. Jos negalima išsaugoti, siųsti ar eksportuoti.</span>
                  <Button variant="secondary" size="sm" onClick={resetAll}>Pradėti su savo duomenimis</Button>
                </span>
              </Alert>
            )}

            <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2 print:hidden', (isSamplePreview || analysis) && 'hidden')}>
              {bids.map((bid, idx) => (
                <Card key={bid.id} className="flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm ring-1 ring-gray-200"><Building2 size={16} aria-hidden /></span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">Rangovo pasiūlymas {String(idx + 1).padStart(2, '0')}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">Atskiras rangovo failas ir sąlygos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {bid.name.trim() && bid.items.some((item) => item.desc.trim() && Number(item.price) > 0) && <Badge variant="success">Paruoštas</Badge>}
                      {bids.length > 2 && (
                        <button
                          onClick={() => removeBid(bid.id)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                          aria-label="Šalinti pasiūlymą"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">Rangovo pavadinimas</label>
                      <div>
                        <Input
                          placeholder="Pavyzdžiui, UAB Rangovas"
                          value={bid.name}
                          onChange={(e) => updateBid(bid.id, 'name', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUpload
                      accept=".csv,.xlsx,.xls"
                      onFilesSelected={(files) => handleFileUpload(bid.id, files[0])}
                      label={uploadedFileNames[bid.id] ? 'Pakeisti pasiūlymo failą' : 'Įkelti pasiūlymo failą'}
                      hint="Excel (.xlsx, .xls) arba CSV"
                      className="mb-3 py-6"
                    />

                    {uploadedFileNames[bid.id] && (
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50/60 px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-success-800"><FileSpreadsheet size={15} className="shrink-0" aria-hidden /><span className="truncate">{uploadedFileNames[bid.id]}</span></span>
                        <Badge variant="success">{bid.items.filter((item) => item.desc.trim()).length} eil.</Badge>
                      </div>
                    )}

                    <details className="group mt-auto border-t border-gray-100 pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900">
                        Rankinis pildymas ir komercinės sąlygos
                        <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="mt-3 space-y-3">
                        <Textarea
                          className="h-12 resize-none text-xs"
                          placeholder="Arba įklijuokite lentelę iš Excel (Ctrl+V)"
                          value=""
                          onChange={() => {}}
                          onPaste={(e) => handlePasteImport(bid.id, e)}
                        />
                        <div className="space-y-2">
                          {bid.items.map((item) => (
                            <div key={item.id} className="flex gap-2">
                              <Input className="min-w-0 flex-1" placeholder="Darbų aprašymas" value={item.desc} onChange={(e) => updateItem(bid.id, item.id, 'desc', e.target.value)} />
                              <Input className="w-24 shrink-0 font-mono tabular-nums" placeholder="€" inputMode="decimal" value={item.price} onChange={(e) => updateItem(bid.id, item.id, 'price', e.target.value.replace(/[^0-9.]/g, ''))} />
                              <button onClick={() => removeItem(bid.id, item.id)} className="shrink-0 rounded-md px-1 text-gray-400 transition-colors hover:text-danger-600" aria-label="Šalinti eilutę"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => addItem(bid.id)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"><Plus size={13} /> Pridėti eilutę</button>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-400">Išimtys ir komercinės sąlygos</label>
                          <Textarea className="h-20 resize-none" placeholder="Kas neįtraukta, kokios sąlygos ar prielaidos..." value={bid.exclusions} onChange={(e) => updateBid(bid.id, 'exclusions', e.target.value)} />
                        </div>
                      </div>
                    </details>

                    {pendingImport?.bidId === bid.id && (
                      <Card variant="selected" className="mb-3">
                        <CardContent className="space-y-2.5">
                          <p className="text-xs font-semibold text-primary-700">Patikrink stulpelius</p>

                          {!pendingImport.headerFound && (
                            <Alert variant="warning">
                              Antraštės eilutė neaptikta automatiškai — pasirink stulpelius rankiniu būdu.
                            </Alert>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            {([
                              ['descCol', 'Aprašymas *'],
                              ['priceCol', 'Kaina *'],
                              ['qtyCol', 'Kiekis (nebūtina)'],
                              ['unitCol', 'Mato vnt. (nebūtina)'],
                            ] as [keyof ImportTemplate, string][]).map(([field, label]) => (
                              <div key={field}>
                                <label className="mb-1 block text-[11px] text-gray-500">{label}</label>
                                <select
                                  className={selectClass}
                                  value={pendingImport[field]}
                                  onChange={(e) =>
                                    setPendingImport((p) => (p ? ({ ...p, [field]: Number(e.target.value) } as PendingImport) : p))
                                  }
                                >
                                  <option value={-1}>{field === 'descCol' || field === 'priceCol' ? '— pasirink —' : '—'}</option>
                                  {pendingImport.headers.map((h, hIdx) => (
                                    <option key={hIdx} value={hIdx}>
                                      {h || `Stulpelis ${hIdx + 1}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>

                          {pendingImport.descCol >= 0 && pendingImport.priceCol >= 0 && (
                            <div>
                              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                Rasta {pendingImport.rows.length} eilutės (rodomos pirmos 5)
                              </p>
                              <Table>
                                <TableHeader>
                                  <TableRow hover={false}>
                                    <TableHeadCell>Aprašymas</TableHeadCell>
                                    {pendingImport.qtyCol >= 0 && <TableHeadCell>Kiekis</TableHeadCell>}
                                    {pendingImport.unitCol >= 0 && <TableHeadCell>Vnt</TableHeadCell>}
                                    <TableHeadCell>Kaina</TableHeadCell>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pendingImport.rows.slice(0, 5).map((r, i) => {
                                    const p = parseEuNumber(r[pendingImport.priceCol]);
                                    return (
                                      <TableRow key={i}>
                                        <TableCell className="max-w-[160px] truncate">
                                          {String(r[pendingImport.descCol] ?? '—')}
                                        </TableCell>
                                        {pendingImport.qtyCol >= 0 && (
                                          <TableCell>{String(r[pendingImport.qtyCol] ?? '—')}</TableCell>
                                        )}
                                        {pendingImport.unitCol >= 0 && (
                                          <TableCell>{String(r[pendingImport.unitCol] ?? '—')}</TableCell>
                                        )}
                                        <TableCell className={cn('font-mono tabular-nums', isNaN(p) && 'text-danger-600')}>
                                          {isNaN(p) ? 'neatpažinta' : `€${p}`}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button variant="primary" size="sm" onClick={confirmImport}>
                              Patvirtinti importą
                            </Button>
                            <Button variant="secondary" size="sm" onClick={cancelImport}>
                              Atšaukti
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  </CardContent>
                </Card>
              ))}

              <button
                onClick={addBid}
                className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white text-gray-500 transition-all duration-150 ease-out hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600 lg:col-span-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50"><Plus size={18} /></span>
                <span className="text-sm font-medium">Pridėti dar vieną rangovą</span>
              </button>
            </div>

            <div className={cn('flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden', (analysis || isSamplePreview) && 'hidden')}>
              <div>
                <p className="text-sm font-semibold text-gray-900">{readyBidCount >= 2 ? 'Pasiūlymai paruošti palyginimui' : 'Reikia bent dviejų pasiūlymų'}</p>
                <Text size="small" muted className="mt-1">{readyBidCount} iš {bids.length} rangovų turi pavadinimą ir kainos duomenis.</Text>
              </div>
              <div className="flex items-center gap-3">
                {!isSamplePreview && (
                <Button variant="primary" size="lg" onClick={runAnalysis} disabled={!canAnalyze} isLoading={loading}>
                  {!loading && <ShieldAlert size={20} />}
                  {loading ? 'Palyginama...' : 'Palyginti pasiūlymus'}
                </Button>
                )}
              </div>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            {analysis && (
              <div id="comparison-results" className="scroll-mt-6 space-y-8 border-t border-gray-100 pt-8">
                <div>
                  <div className="mb-4">
                    <Heading level={2}>Sprendimo santrauka</Heading>
                    <Text muted className="mt-1">
                      Rekomendacija vertina kainą, apimties pilnumą, išimtis ir komercines sąlygas.
                    </Text>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
                    <Card variant="success" className="overflow-hidden">
                      <CardContent className="p-6 sm:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-success-700">
                              <Award size={15} aria-hidden /> Rekomenduojamas rangovas
                            </p>
                            <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
                              {recommended?.bid.name || '—'}
                            </p>
                          </div>
                          {recommended?.score && recommendedTier && (
                            <Badge variant={recommendedTier.variant} className="px-3 py-1 text-sm">
                              {recommended.score.balas}/100
                            </Badge>
                          )}
                        </div>
                        <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-700">
                          {recommended?.score?.pagrindimas || analysis.santrauka}
                        </p>
                        {recommended && (
                          <button
                            type="button"
                            onClick={() => openSupplierDetail(recommended.bid.id)}
                            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-success-700 transition-colors hover:text-success-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500/40"
                          >
                            Peržiūrėti vertinimą <ArrowRight size={15} aria-hidden />
                          </button>
                        )}
                      </CardContent>
                    </Card>

                    <Card variant={riskiest?.bid.id === recommended?.bid.id ? 'warning' : 'danger'}>
                      <CardContent className="p-6">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-danger-700">
                          <ShieldAlert size={15} aria-hidden /> Daugiausia dėmesio reikia
                        </p>
                        <p className="mt-3 text-xl font-semibold text-gray-950">{riskiest?.bid.name || '—'}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Vertinimas {riskiest?.score?.balas ?? '—'}/100
                        </p>
                        {riskiest?.score?.pagrindimas && (
                          <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-700">{riskiest.score.pagrindimas}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="mt-4">
                    <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0">
                      {[
                        { label: 'Trūkstama apimtis', value: scopeGapCount, icon: AlertTriangle },
                        { label: 'Kainų išskirtys', value: priceOutlierCount, icon: TrendingUp },
                        { label: 'Aukštos rizikos signalai', value: highRiskFlagCount, icon: FlagIcon },
                        { label: 'Patikrinti palyginimo taškai', value: reviewedComparisonPoints, icon: ShieldCheck },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="p-4 sm:p-5">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                            <Icon size={12} aria-hidden /> {label}
                          </p>
                          <p className="mt-2 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Alert variant="info" title="Bendra išvada">
                  {analysis.santrauka}
                </Alert>

                {priorityFlags.length > 0 && (
                  <div className="print:hidden">
                    <div className="mb-4 flex items-end justify-between gap-4">
                      <div>
                        <Heading level={2}>Ką patikrinti pirmiausia</Heading>
                        <Text muted className="mt-1">Svarbiausi klausimai prieš priimant komercinį sprendimą.</Text>
                      </div>
                      <Badge variant={highRiskFlagCount > 0 ? 'danger' : 'warning'}>{priorityFlags.length} prioritetai</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {priorityFlags.map((flag, index) => {
                        const supplier = bids.find((bid) => bid.id === flag.bidId);
                        return (
                          <button
                            key={`${flag.bidId}-${flag.tipas}-${index}`}
                            type="button"
                            onClick={() => openSupplierDetail(flag.bidId)}
                            className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <Badge variant={SEVERITY_BADGE_VARIANT[flag.sunkumas]}>{SEVERITY_LABEL[flag.sunkumas]}</Badge>
                              <ArrowRight size={15} className="text-gray-400" aria-hidden />
                            </span>
                            <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              {supplier?.name || 'Rangovas'} · {FLAG_TITLES[flag.tipas]}
                            </span>
                            <span className="mt-2 block line-clamp-3 text-sm leading-5 text-gray-700">{flag.aprasymas}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isSamplePreview && (
                  <Card className="print:hidden">
                    <CardContent className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Išsaugoti palyginimą</p>
                        <p className="mt-1 max-w-lg text-xs leading-5 text-gray-500">
                          Suteik objektui aiškų pavadinimą, kad komanda vėliau lengvai rastų šį sprendimą.
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        <Input
                          className="min-w-0 flex-1 sm:w-56"
                          placeholder="Objekto pavadinimas"
                          value={projectLabel}
                          onChange={(e) => setProjectLabel(e.target.value)}
                        />
                        <Button variant="primary" size="sm" onClick={saveCurrentProject} isLoading={savingProject} className="whitespace-nowrap">
                          {savedNotice ? 'Išsaugota ✓' : 'Išsaugoti projektą'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <div className="mb-4">
                    <Heading level={2}>Rangovų palyginimas</Heading>
                    <Text muted className="mt-1">Rangovai surikiuoti pagal vertinimą. Mažiausia kaina nebūtinai reiškia mažiausią riziką.</Text>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow hover={false}>
                        <TableHeadCell className="w-12">Vieta</TableHeadCell>
                        <TableHeadCell>Rangovas</TableHeadCell>
                        <TableHeadCell>Bendra kaina</TableHeadCell>
                        <TableHeadCell>Apimtis</TableHeadCell>
                        <TableHeadCell>Rizikos balas</TableHeadCell>
                        <TableHeadCell>Trūksta</TableHeadCell>
                        <TableHeadCell>Komercinis statusas</TableHeadCell>
                        <TableHeadCell><span className="sr-only">Veiksmas</span></TableHeadCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonRows.map(({ bid, score }, index) => {
                        const cov = coverageForBid(bid.id);
                        const status = commercialStatus(bid.id);
                        const isRecommended = recommended?.bid.id === bid.id;
                        const total = totalPriceForBid(bid);
                        const priceDelta = lowestTotal > 0 ? ((total - lowestTotal) / lowestTotal) * 100 : 0;
                        return (
                          <TableRow
                            key={bid.id}
                            className={cn(isRecommended && 'bg-success-50/40')}
                          >
                            <TableCell className="font-mono text-xs tabular-nums text-gray-400">{index + 1}</TableCell>
                            <TableCell className="font-medium text-gray-900">
                              <span className="flex items-center gap-2">
                                {bid.name || '—'}
                                {isRecommended && (
                                  <Badge variant="success">
                                    <Award size={10} /> Rekomenduojama
                                  </Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="block font-mono tabular-nums text-gray-900">€{total.toLocaleString('lt-LT')}</span>
                              <span className="mt-0.5 block text-[11px] text-gray-400">
                                {priceDelta <= 0.05 ? 'Mažiausia kaina' : `+${priceDelta.toFixed(1)} % nuo mažiausios`}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono tabular-nums">{cov.pct === null ? 'Nežinoma' : `${cov.pct}%`}</span>
                              <span className="mt-0.5 block text-[11px] text-gray-400">{bid.items.length} eil.</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono tabular-nums text-gray-900">{score?.balas ?? '—'}/100</span>
                              <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                                <span
                                  className={cn('block h-full rounded-full', score ? riskTier(score.balas).barClassName : 'bg-gray-300')}
                                  style={{ width: `${Math.max(0, Math.min(100, score?.balas ?? 0))}%` }}
                                />
                              </span>
                            </TableCell>
                            <TableCell className="font-mono tabular-nums">{cov.missing}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="print:hidden">
                              <button
                                type="button"
                                onClick={() => openSupplierDetail(bid.id)}
                                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                                aria-label={`Peržiūrėti rangovo ${bid.name || 'pasiūlymą'} detales`}
                              >
                                Peržiūrėti <ArrowRight size={13} aria-hidden />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-6 print:hidden">
                  {recommended && !isSamplePreview && (
                    <Button variant="primary" onClick={() => handleGenerateClarificationEmail(recommended.bid.id)}>
                      <Mail size={15} /> Paruošti patikslinimo laišką
                    </Button>
                  )}
                  {isSamplePreview ? (
                    <Button variant="primary" onClick={resetAll}>Pradėti palyginimą su savo pasiūlymais</Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={handleGeneratePdf}>
                        <Printer size={15} /> Generuoti palyginimo PDF
                      </Button>
                      <Button variant="secondary" onClick={handleExportExcel}>
                        <Download size={15} /> Eksportuoti į Excel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'projects' && (
          <div className="space-y-3">
            <Heading level={2}>Išsaugoti projektai</Heading>
            {savedProjects.length === 0 && (
              <EmptyState
                title="Kol kas nieko neišsaugota"
                description="Palyginkite rangovų pasiūlymus ir rezultatų suvestinėje paspauskite „Išsaugoti projektą“."
              />
            )}
            {savedProjects.map((p) => {
              const scores = p.analysis?.bidScores || [];
              const riskiest = scores.length ? [...scores].sort((a, b) => a.balas - b.balas)[0] : null;
              return (
                <Card key={p.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                      <Text size="caption" muted className="mt-1">
                        {new Date(p.savedAt).toLocaleDateString('lt-LT')} · {p.bids?.length || 0} pasiūlymai
                        {riskiest && ` · rizikingiausias: ${p.bids?.find((b) => b.id === riskiest.bidId)?.name || '—'} (${riskiest.balas})`}
                      </Text>
                    </div>
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="rounded-md p-1 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-danger-600"
                      aria-label="Šalinti projektą"
                    >
                      <Trash2 size={16} />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {view === 'contractors' && (
          <div className="space-y-3">
            <Heading level={2}>Rangovų istorija</Heading>
            <Text muted className="max-w-xl">
              Suvesta iš visų išsaugotų projektų. Kuo daugiau projektų pereina per sistemą, tuo tiksliau matosi,
              kuris rangovas realiai patikimas.
            </Text>
            {contractorStats.length === 0 && (
              <EmptyState
                title="Kol kas nėra pakankamai duomenų"
                description="Istorija kaupiasi su kiekvienu išsaugotu projektu."
              />
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contractorStats.map((c) => {
                const tier = riskTier(c.avg);
                return (
                  <Card key={c.name}>
                    <CardContent>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="truncate pr-2 text-sm font-semibold text-gray-900">{c.name}</p>
                        <Badge variant={tier.variant} className="font-mono tabular-nums">
                          {c.avg}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-[11px] text-gray-500">
                        <span>{c.projects} projektai</span>
                        <span>vid. balas {c.avg}</span>
                        {c.highRisk > 0 && <span className="text-danger-600">{c.highRisk}× rizikinga</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Modal open={!!selectedBid} onClose={() => setSelectedBidId(null)} size="lg">
        {selectedBid && (
          <>
            <ModalHeader onClose={() => setSelectedBidId(null)}>
              <ModalTitle>{selectedBid.name || 'Rangovas'}</ModalTitle>
              {selectedScore && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={riskTier(selectedScore.balas).variant}>
                    {selectedScore.balas}/100 · {riskTier(selectedScore.balas).label}
                  </Badge>
                </div>
              )}
            </ModalHeader>

            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-5 pt-3">
              {DETAIL_TABS.map((t) => {
                const Icon = t.icon;
                const active = detailTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors duration-150 ease-out',
                      active
                        ? 'border-primary-600 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    )}
                  >
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            <ModalBody className="max-h-[55vh] overflow-y-auto">{renderDetailTabContent()}</ModalBody>

            <ModalFooter>
              {isSamplePreview ? (
                <Text size="small" muted>Pavyzdžio laiško siųsti negalima.</Text>
              ) : (
                <Button variant="primary" onClick={() => handleGenerateClarificationEmail(selectedBid.id)}>
                  <Mail size={15} /> Generuoti patikslinimo laišką
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
