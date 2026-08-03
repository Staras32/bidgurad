'use client';

import { useState, type ClipboardEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
      { id: uid(), desc: 'Elektros instaliacija, gyvenamosios patalpos', price: '18400' },
      { id: uid(), desc: 'Skydinės montavimas ir prijungimas', price: '3200' },
      { id: uid(), desc: 'Apšvietimo prietaisų montavimas', price: '2100' },
    ],
  },
  {
    id: uid(),
    name: 'MB Voltas Baltic',
    exclusions: 'Apimtis gali keistis pagal faktinę situaciją objekte. Kaina preliminari.',
    items: [
      { id: uid(), desc: 'Pilna elektros instaliacija namui', price: '9800' },
      { id: uid(), desc: 'Skydas + prijungimas', price: '3100' },
      { id: uid(), desc: 'Šviestuvų montavimas', price: '1950' },
    ],
  },
  {
    id: uid(),
    name: 'UAB Srovė ir Ko',
    exclusions: 'Neįtraukta: leidimų derinimas su tinklų operatoriumi, medžiagos virš standartinės komplektacijos.',
    items: [
      { id: uid(), desc: 'El. instaliacijos darbai (visos patalpos)', price: '19200' },
      { id: uid(), desc: 'Elektros skydo įrengimas', price: '3400' },
      { id: uid(), desc: 'Apšvietimo sistema', price: '2300' },
      { id: uid(), desc: 'Laikinas statybinis elektros tiekimas', price: '1100' },
    ],
  },
];

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

const FLAG_LABELS: Record<string, string> = {
  price_outlier: 'Kainos išskirtis',
  scope_gap: 'Apimties spraga',
  risky_language: 'Rizikinga formuluotė',
  unique_exclusion: 'Unikali išimtis',
};

const SEVERITY_CARD_VARIANT: Record<Severity, CardVariant> = { high: 'danger', medium: 'warning', low: 'success' };
const SEVERITY_ICON_CLASS: Record<Severity, string> = {
  high: 'text-danger-500',
  medium: 'text-warning-500',
  low: 'text-success-500',
};

const selectClass =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 transition-colors duration-150 ease-out hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500';

type ViewMode = 'analyze' | 'projects' | 'contractors';

export default function BidGuard() {
  const [view, setView] = useState<ViewMode>('analyze');
  const [bids, setBids] = useState<Bid[]>(() => [emptyBid(), emptyBid()]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedMatrix, setExpandedMatrix] = useState(false);
  const [projectLabel, setProjectLabel] = useState('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [flagFeedback, setFlagFeedback] = useState<FlagFeedback>({});
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  // ---------- Pasiūlymų / eilučių valdymas ----------

  const addBid = () => setBids((b) => [...b, emptyBid()]);
  const removeBid = (id: string) => setBids((b) => (b.length > 2 ? b.filter((x) => x.id !== id) : b));
  const loadSample = () => {
    setBids(SAMPLE);
    setAnalysis(null);
    setError('');
  };
  const resetAll = () => {
    setBids([emptyBid(), emptyBid()]);
    setAnalysis(null);
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
    !loading;

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

  const nameOf = (bidId: string) => bids.find((b) => b.id === bidId)?.name || bidId;
  const flagKey = (f: { bidId: string; tipas: string; aprasymas: string }) =>
    `${f.bidId}::${f.tipas}::${f.aprasymas}`;

  const sortedScores = analysis?.bidScores ? [...analysis.bidScores].sort((a, b) => a.balas - b.balas) : [];

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
    if (!analysis) return;
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
    <div className="min-h-screen w-full bg-background pb-24">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-10">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-600">
            Rizikos auditas · Subrangovų pasiūlymai
          </p>
          <Heading level={1}>Kuris rangovas pigus tik popieriuje?</Heading>
          <Text muted className="mt-3 max-w-xl">
            Įkelk pasiūlymus. Po 30 sekundžių žinosi, kurį rinktis — ir ko tavo komanda pati nepastebėtų, kol
            nebūtų per vėlu.
          </Text>
        </div>
      </header>

      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl gap-1 px-5 sm:px-10">
          {([
            { key: 'analyze', label: 'Nauja analizė' },
            { key: 'projects', label: 'Projektai', action: openProjects },
            { key: 'contractors', label: 'Rangovų istorija', action: openContractors },
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

      <main className="mx-auto max-w-5xl space-y-6 px-5 pt-8 sm:px-10">
        {view === 'analyze' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={loadSample}>
                <Sparkles size={14} /> Įkelti pavyzdį
              </Button>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                Išvalyti
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bids.map((bid, idx) => (
                <Card key={bid.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Pasiūlymas {String(idx + 1).padStart(2, '0')}
                        </p>
                        <Input
                          placeholder="Subrangovo pavadinimas"
                          value={bid.name}
                          onChange={(e) => updateBid(bid.id, 'name', e.target.value)}
                        />
                      </div>
                      {bids.length > 2 && (
                        <button
                          onClick={() => removeBid(bid.id)}
                          className="mt-6 shrink-0 rounded-md p-1 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-danger-600"
                          aria-label="Šalinti pasiūlymą"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="mb-3 space-y-2">
                      {bid.items.map((item) => (
                        <div key={item.id} className="flex gap-2">
                          <Input
                            className="flex-1 min-w-0"
                            placeholder="Darbų aprašymas"
                            value={item.desc}
                            onChange={(e) => updateItem(bid.id, item.id, 'desc', e.target.value)}
                          />
                          <Input
                            className="w-24 shrink-0 font-mono tabular-nums"
                            placeholder="€"
                            inputMode="decimal"
                            value={item.price}
                            onChange={(e) => updateItem(bid.id, item.id, 'price', e.target.value.replace(/[^0-9.]/g, ''))}
                          />
                          <button
                            onClick={() => removeItem(bid.id, item.id)}
                            className="shrink-0 rounded-md px-1 text-gray-400 transition-colors duration-150 ease-out hover:text-danger-600"
                            aria-label="Šalinti eilutę"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addItem(bid.id)}
                      className="mb-3 flex items-center gap-1 self-start text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <Plus size={13} /> Pridėti eilutę
                    </button>

                    <FileUpload
                      accept=".csv,.xlsx,.xls"
                      onFilesSelected={(files) => handleFileUpload(bid.id, files[0])}
                      className="mb-3 py-4"
                    />

                    <Textarea
                      className="mb-3 h-10 resize-none text-xs"
                      placeholder="📋 Pažymėk lentelę Excel'yje → Ctrl+C → spausk čia → Ctrl+V"
                      value=""
                      onChange={() => {}}
                      onPaste={(e) => handlePasteImport(bid.id, e)}
                    />

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

                    <div className="mt-auto">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Išimtys / kvalifikacijos
                      </p>
                      <Textarea
                        className="h-20 resize-none"
                        placeholder="Kas neįtraukta, kokios sąlygos, prielaidos..."
                        value={bid.exclusions}
                        onChange={(e) => updateBid(bid.id, 'exclusions', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <button
                onClick={addBid}
                className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 text-gray-500 transition-colors duration-150 ease-out hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600"
              >
                <Plus size={22} />
                <span className="text-xs font-medium">Pridėti pasiūlymą</span>
              </button>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button variant="primary" size="lg" onClick={runAnalysis} disabled={!canAnalyze} isLoading={loading}>
                {!loading && <ShieldAlert size={20} />}
                {loading ? 'Analizuojama...' : 'Analizuoti riziką'}
              </Button>
              {!canAnalyze && !loading && (
                <Text size="small" muted>
                  Užpildyk bent 2 pasiūlymus (pavadinimą + bent po vieną eilutę su kaina).
                </Text>
              )}
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            {analysis && (
              <div className="space-y-8 border-t border-gray-100 pt-6">
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Išvada</p>
                      <p className="max-w-2xl text-base leading-relaxed text-gray-900">{analysis.santrauka}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        className="w-44"
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

                <div>
                  <Heading level={2} className="mb-4">
                    Kuris pasiūlymas rizikingiausias
                  </Heading>
                  <div className="space-y-3">
                    {sortedScores.map((s) => {
                      const tier = riskTier(s.balas);
                      const Icon = tier.Icon;
                      const bidFlags = (analysis.flags || []).filter((f) => f.bidId === s.bidId);
                      return (
                        <Card key={s.bidId} variant={s.balas < 45 ? 'danger' : 'default'}>
                          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
                            <div className="flex min-w-0 shrink-0 items-center gap-4 sm:w-64">
                              <div
                                className={cn(
                                  'flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-3xl font-bold tabular-nums',
                                  tier.tileClassName
                                )}
                              >
                                {s.balas}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">{nameOf(s.bidId)}</p>
                                <Badge variant={tier.variant} className="mt-1">
                                  <Icon size={12} /> {tier.label}
                                </Badge>
                                <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-gray-100">
                                  <div className={cn('h-full rounded-full', tier.barClassName)} style={{ width: `${s.balas}%` }} />
                                </div>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <Text muted>{s.pagrindimas}</Text>
                              {bidFlags.length > 0 && (
                                <Text size="caption" muted className="mt-1.5">
                                  {bidFlags.length} vėliavėlė(s) žemiau
                                </Text>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Heading level={2} className="mb-4">
                    Kas rasta
                  </Heading>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(analysis.flags || []).map((f, i) => {
                      const key = flagKey(f);
                      const fb = flagFeedback[key];
                      return (
                        <Card key={i} variant={SEVERITY_CARD_VARIANT[f.sunkumas]}>
                          <CardContent>
                            <div className="mb-1.5 flex items-center justify-between">
                              <Badge variant="neutral">{FLAG_LABELS[f.tipas] || f.tipas}</Badge>
                              <AlertTriangle size={13} className={SEVERITY_ICON_CLASS[f.sunkumas]} />
                            </div>
                            <p className="mb-1 text-xs font-medium text-gray-500">{nameOf(f.bidId)}</p>
                            <p className="mb-2.5 text-sm text-gray-900">{f.aprasymas}</p>

                            <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                              <button
                                onClick={() => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'agree' } }))}
                                className={cn(
                                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ease-out',
                                  fb?.decision === 'agree'
                                    ? 'border-success-200 bg-success-50 text-success-700'
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                )}
                              >
                                Sutinku
                              </button>
                              <button
                                onClick={() =>
                                  setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'false_positive' } }))
                                }
                                className={cn(
                                  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ease-out',
                                  fb?.decision === 'false_positive'
                                    ? 'border-danger-200 bg-danger-50 text-danger-700'
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                )}
                              >
                                Klaidingas perspėjimas
                              </button>
                            </div>
                            {fb?.decision && (
                              <Input
                                className="mt-2"
                                placeholder="Komentaras (nebūtina)..."
                                value={fb.comment || ''}
                                onChange={(e) => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], comment: e.target.value } }))}
                              />
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {(!analysis.flags || analysis.flags.length === 0) && (
                      <div className="sm:col-span-2">
                        <EmptyState title="Rimtų anomalijų nerasta" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setExpandedMatrix((v) => !v)}
                    className="mb-4 flex w-full items-center gap-2 text-left text-xl font-semibold text-gray-900"
                  >
                    Apimties lentelė {expandedMatrix ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {expandedMatrix && (
                    <Table>
                      <TableHeader>
                        <TableRow hover={false}>
                          <TableHeadCell>Kategorija</TableHeadCell>
                          {bids.map((b) => (
                            <TableHeadCell key={b.id}>{b.name || '—'}</TableHeadCell>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(analysis.scopeMatrix || []).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-gray-900">{row.kategorija}</TableCell>
                            {bids.map((b) => {
                              const cell = (row.eilutes || []).find((e) => e.bidId === b.id);
                              const missing = !cell || cell.yra === false;
                              return (
                                <TableCell key={b.id} className={cn('font-mono tabular-nums', missing && 'text-danger-600')}>
                                  {missing ? 'NĖRA' : `€${Number(cell?.kaina).toLocaleString('lt-LT')}`}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                description={'Padaryk analizę skiltyje „Nauja analizė" ir paspausk „Išsaugoti projektą".'}
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
    </div>
  );
}
