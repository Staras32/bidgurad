'use client';

import { useState, useRef, type ClipboardEvent } from 'react';
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
  FileSpreadsheet,
} from 'lucide-react';

import { uid } from '@/lib/uid';
import { storage } from '@/lib/storage';
import { parseEuNumber } from '@/lib/numberParser';
import { findHeaderRow, guessAllColumns, parseCsvText, buildItemsFromColumns, norm, type Row } from '@/lib/importParser';
import type { Bid, BidItem, Analysis, FlagFeedback, SavedProject, PendingImport, ImportTemplate } from '@/lib/types';

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

function riskTier(score: number) {
  if (score >= 75) return { label: 'SAUGUS', className: 'tier-safe', Icon: ShieldCheck };
  if (score >= 45) return { label: 'VERTA PATIKRINTI', className: 'tier-mid', Icon: AlertCircle };
  return { label: 'RIZIKINGA', className: 'tier-high', Icon: ShieldAlert };
}

const FLAG_LABELS: Record<string, string> = {
  price_outlier: 'Kainos išskirtis',
  scope_gap: 'Apimties spraga',
  risky_language: 'Rizikinga formuluotė',
  unique_exclusion: 'Unikali išimtis',
};

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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
    <div className="bg-wrap min-h-screen w-full pb-24">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Text:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .bg-wrap {
          --paper: #ECEAE2;
          --paper-raised: #F7F6F1;
          --ink: #1E2A35;
          --ink-soft: #4C5A66;
          --line: #C9C6B8;
          --blueprint: #2F5C82;
          --blueprint-dark: #21455F;
          --hazard: #C9601C;
          --hazard-dark: #A64A12;
          --danger: #A63B2E;
          --danger-bg: #F3E2DD;
          --mid-bg: #F3EAD8;
          --safe: #3E6B52;
          --safe-bg: #E1E9E2;
          background: var(--paper);
          color: var(--ink);
          font-family: 'IBM Plex Sans', sans-serif;
        }
        .bg-display { font-family: 'Big Shoulders Text', sans-serif; text-transform: uppercase; letter-spacing: 0.03em; }
        .bg-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .bg-hairline { border-color: var(--line); }
        .bg-card { background: var(--paper-raised); border: 1px solid var(--line); }
        .bg-header {
          background: var(--blueprint);
          background-image:
            linear-gradient(var(--blueprint), var(--blueprint)),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 24px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 24px);
        }
        .hazard-edge {
          border-left: 6px solid transparent;
          background-image: repeating-linear-gradient(135deg, var(--hazard) 0px, var(--hazard) 8px, var(--ink) 8px, var(--ink) 16px);
        }
        .tier-safe { background: var(--safe-bg); color: var(--safe); border: 1px solid var(--safe); }
        .tier-mid { background: var(--mid-bg); color: var(--hazard-dark); border: 1px solid var(--hazard); }
        .tier-high { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger); }
        .btn-primary { background: var(--hazard); color: white; transition: background 0.15s ease; }
        .btn-primary:hover:not(:disabled) { background: var(--hazard-dark); }
        .btn-primary:disabled { background: #B9B6A8; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--ink-soft); }
        .btn-ghost:hover { border-color: var(--ink-soft); color: var(--ink); }
        .bg-input { background: white; border: 1px solid var(--line); color: var(--ink); }
        .bg-input:focus { outline: 2px solid var(--blueprint); outline-offset: -1px; }
        ::placeholder { color: #A7A493; }
      `}</style>

      {/* Header */}
      <header className="bg-header text-white px-5 sm:px-10 py-8 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <p className="bg-mono text-xs tracking-widest text-white/70 mb-2">RIZIKOS AUDITAS · SUBRANGOVŲ PASIŪLYMAI</p>
          <h1 className="bg-display text-4xl sm:text-5xl font-extrabold leading-none">Kuris rangovas pigus tik popieriuje?</h1>
          <p className="mt-3 text-white/85 max-w-xl text-sm sm:text-base">
            Įkelk pasiūlymus. Po 30 sekundžių žinosi, kurį rinktis — ir ko tavo komanda pati nepastebėtų, kol nebūtų per vėlu.
          </p>
        </div>
      </header>

      <nav className="border-b bg-hairline bg-black/[0.02]">
        <div className="max-w-5xl mx-auto px-5 sm:px-10 flex gap-1">
          {([
            { key: 'analyze', label: 'Nauja analizė' },
            { key: 'projects', label: 'Projektai', action: openProjects },
            { key: 'contractors', label: 'Rangovų istorija', action: openContractors },
          ] as { key: ViewMode; label: string; action?: () => void }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => (t.action ? t.action() : setView(t.key))}
              className="bg-mono text-xs px-4 py-3 border-b-2 transition-colors"
              style={{
                borderColor: view === t.key ? 'var(--hazard)' : 'transparent',
                color: view === t.key ? 'var(--ink)' : 'var(--ink-soft)',
                fontWeight: view === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 sm:px-10 mt-8 space-y-6">
        {view === 'analyze' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={loadSample} className="btn-ghost bg-mono text-xs px-4 py-2 rounded-sm flex items-center gap-2">
                <Sparkles size={14} /> Įkelti pavyzdį
              </button>
              <button onClick={resetAll} className="btn-ghost bg-mono text-xs px-4 py-2 rounded-sm">
                Išvalyti
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {bids.map((bid, idx) => (
                <div key={bid.id} className="bg-card rounded-sm p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <p className="bg-mono text-[11px] text-[var(--ink-soft)] mb-1">PASIŪLYMAS {String(idx + 1).padStart(2, '0')}</p>
                      <input
                        className="bg-input rounded-sm px-3 py-2 w-full text-sm font-medium"
                        placeholder="Subrangovo pavadinimas"
                        value={bid.name}
                        onChange={(e) => updateBid(bid.id, 'name', e.target.value)}
                      />
                    </div>
                    {bids.length > 2 && (
                      <button onClick={() => removeBid(bid.id)} className="text-[var(--ink-soft)] hover:text-[var(--danger)] mt-6" aria-label="Šalinti pasiūlymą">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 mb-3">
                    {bid.items.map((item) => (
                      <div key={item.id} className="flex gap-2">
                        <input
                          className="bg-input rounded-sm px-2 py-1.5 text-sm flex-1 min-w-0"
                          placeholder="Darbų aprašymas"
                          value={item.desc}
                          onChange={(e) => updateItem(bid.id, item.id, 'desc', e.target.value)}
                        />
                        <input
                          className="bg-input bg-mono rounded-sm px-2 py-1.5 text-sm w-24"
                          placeholder="€"
                          inputMode="decimal"
                          value={item.price}
                          onChange={(e) => updateItem(bid.id, item.id, 'price', e.target.value.replace(/[^0-9.]/g, ''))}
                        />
                        <button onClick={() => removeItem(bid.id, item.id)} className="text-[var(--ink-soft)] hover:text-[var(--danger)] px-1" aria-label="Šalinti eilutę">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => addItem(bid.id)} className="bg-mono text-xs text-[var(--blueprint)] hover:text-[var(--blueprint-dark)] flex items-center gap-1 self-start">
                      <Plus size={13} /> Pridėti eilutę
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[bid.id]?.click()}
                      className="bg-mono text-xs text-[var(--hazard-dark)] hover:text-[var(--hazard)] flex items-center gap-1"
                    >
                      <FileSpreadsheet size={13} /> Failas
                    </button>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[bid.id] = el;
                      }}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(bid.id, e.target.files?.[0])}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                    />
                  </div>

                  <textarea
                    className="bg-input rounded-sm px-2 py-1.5 text-[11px] w-full h-10 resize-none mb-3"
                    placeholder="📋 Pažymėk lentelę Excel'yje → Ctrl+C → spausk čia → Ctrl+V"
                    value=""
                    onChange={() => {}}
                    onPaste={(e) => handlePasteImport(bid.id, e)}
                  />

                  {pendingImport?.bidId === bid.id && (
                    <div className="rounded-sm p-3 mb-3 border-2" style={{ borderColor: 'var(--blueprint)', background: '#EAF1F6' }}>
                      <p className="bg-mono text-[11px] text-[var(--blueprint-dark)] mb-2 font-semibold">PATIKRINK STULPELIUS</p>

                      {!pendingImport.headerFound && (
                        <p className="text-xs mb-2 px-2 py-1.5 rounded-sm" style={{ background: 'var(--mid-bg)', color: 'var(--hazard-dark)' }}>
                          Antraštės eilutė neaptikta automatiškai — pasirink stulpelius rankiniu būdu.
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {([
                          ['descCol', 'Aprašymas *'],
                          ['priceCol', 'Kaina *'],
                          ['qtyCol', 'Kiekis (nebūtina)'],
                          ['unitCol', 'Mato vnt. (nebūtina)'],
                        ] as [keyof ImportTemplate, string][]).map(([field, label]) => (
                          <div key={field}>
                            <label className="text-[11px] text-[var(--ink-soft)] block mb-1">{label}</label>
                            <select
                              className="bg-input rounded-sm px-2 py-1.5 text-xs w-full"
                              value={pendingImport[field]}
                              onChange={(e) =>
                                setPendingImport((p) => (p ? ({ ...p, [field]: Number(e.target.value) } as PendingImport) : p))
                              }
                            >
                              <option value={-1}>{field === 'descCol' || field === 'priceCol' ? '— pasirink —' : '—'}</option>
                              {pendingImport.headers.map((h, idx) => (
                                <option key={idx} value={idx}>
                                  {h || `Stulpelis ${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>

                      {pendingImport.descCol >= 0 && pendingImport.priceCol >= 0 && (
                        <div className="mb-2 bg-white/70 rounded-sm p-2 overflow-x-auto">
                          <p className="bg-mono text-[10px] text-[var(--ink-soft)] mb-1.5">
                            RASTA {pendingImport.rows.length} EILUTĖS (rodomos pirmos 5)
                          </p>
                          <table className="text-[11px] w-full">
                            <thead>
                              <tr className="text-[var(--ink-soft)]">
                                <th className="text-left pr-3 pb-1">Aprašymas</th>
                                {pendingImport.qtyCol >= 0 && <th className="text-left pr-3 pb-1">Kiekis</th>}
                                {pendingImport.unitCol >= 0 && <th className="text-left pr-3 pb-1">Vnt</th>}
                                <th className="text-left pb-1">Kaina</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingImport.rows.slice(0, 5).map((r, i) => {
                                const p = parseEuNumber(r[pendingImport.priceCol]);
                                return (
                                  <tr key={i}>
                                    <td className="pr-3 py-0.5 truncate max-w-[160px]">{String(r[pendingImport.descCol] ?? '—')}</td>
                                    {pendingImport.qtyCol >= 0 && <td className="pr-3 py-0.5">{String(r[pendingImport.qtyCol] ?? '—')}</td>}
                                    {pendingImport.unitCol >= 0 && <td className="pr-3 py-0.5">{String(r[pendingImport.unitCol] ?? '—')}</td>}
                                    <td className="py-0.5" style={{ color: isNaN(p) ? 'var(--danger)' : 'inherit' }}>
                                      {isNaN(p) ? 'neatpažinta' : `€${p}`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={confirmImport} className="btn-primary bg-mono text-[11px] px-3 py-1.5 rounded-sm">
                          Patvirtinti importą
                        </button>
                        <button onClick={cancelImport} className="btn-ghost bg-mono text-[11px] px-3 py-1.5 rounded-sm">
                          Atšaukti
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto">
                    <p className="bg-mono text-[11px] text-[var(--ink-soft)] mb-1">IŠIMTYS / KVALIFIKACIJOS</p>
                    <textarea
                      className="bg-input rounded-sm px-3 py-2 w-full text-sm h-20 resize-none"
                      placeholder="Kas neįtraukta, kokios sąlygos, prielaidos..."
                      value={bid.exclusions}
                      onChange={(e) => updateBid(bid.id, 'exclusions', e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={addBid}
                className="rounded-sm border border-dashed bg-hairline flex flex-col items-center justify-center gap-2 py-10 text-[var(--ink-soft)] hover:text-[var(--blueprint)] hover:border-[var(--blueprint)] transition-colors"
              >
                <Plus size={22} />
                <span className="bg-mono text-xs">Pridėti pasiūlymą</span>
              </button>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button onClick={runAnalysis} disabled={!canAnalyze} className="btn-primary bg-display text-lg tracking-wide px-8 py-3 rounded-sm flex items-center gap-3">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}
                {loading ? 'ANALIZUOJAMA...' : 'ANALIZUOTI RIZIKĄ'}
              </button>
              {!canAnalyze && !loading && (
                <p className="text-xs text-[var(--ink-soft)]">Užpildyk bent 2 pasiūlymus (pavadinimą + bent po vieną eilutę su kaina).</p>
              )}
            </div>

            {error && (
              <div className="bg-card border-l-4 border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)] rounded-sm">
                {error}
              </div>
            )}

            {analysis && (
              <div className="space-y-8 pt-6 border-t bg-hairline">
                <div className="bg-card rounded-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="bg-mono text-[11px] text-[var(--ink-soft)] mb-2">IŠVADA</p>
                      <p className="text-base leading-relaxed max-w-2xl">{analysis.santrauka}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        className="bg-input rounded-sm px-3 py-2 text-sm w-44"
                        placeholder="Objekto pavadinimas"
                        value={projectLabel}
                        onChange={(e) => setProjectLabel(e.target.value)}
                      />
                      <button onClick={saveCurrentProject} disabled={savingProject} className="btn-primary bg-mono text-xs px-4 py-2.5 rounded-sm whitespace-nowrap">
                        {savingProject ? 'Saugoma...' : savedNotice ? 'Išsaugota ✓' : 'Išsaugoti projektą'}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="bg-display text-2xl font-bold mb-4">Kuris pasiūlymas rizikingiausias</h2>
                  <div className="space-y-3">
                    {sortedScores.map((s) => {
                      const tier = riskTier(s.balas);
                      const Icon = tier.Icon;
                      const bidFlags = (analysis.flags || []).filter((f) => f.bidId === s.bidId);
                      return (
                        <div key={s.bidId} className={`bg-card rounded-sm overflow-hidden ${s.balas < 45 ? 'hazard-edge' : ''}`}>
                          <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
                            <div className="flex items-center gap-4 min-w-0 sm:w-64 shrink-0">
                              <div className={`bg-display text-4xl font-extrabold w-16 h-16 flex items-center justify-center rounded-sm ${tier.className}`}>
                                {s.balas}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{nameOf(s.bidId)}</p>
                                <p className="text-[11px] bg-mono tracking-wide text-[var(--ink-soft)] flex items-center gap-1 mt-1">
                                  <Icon size={12} /> {tier.label}
                                </p>
                                <div className="mt-1.5 h-1 w-32 bg-black/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${s.balas}%`,
                                      background: s.balas >= 75 ? 'var(--safe)' : s.balas >= 45 ? 'var(--hazard)' : 'var(--danger)',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--ink-soft)]">{s.pagrindimas}</p>
                              {bidFlags.length > 0 && <p className="bg-mono text-[11px] text-[var(--ink-soft)] mt-1.5">{bidFlags.length} vėliavėlė(s) žemiau</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="bg-display text-2xl font-bold mb-4">Kas rasta</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(analysis.flags || []).map((f, i) => {
                      const key = flagKey(f);
                      const fb = flagFeedback[key];
                      const color = f.sunkumas === 'high' ? 'var(--danger)' : f.sunkumas === 'medium' ? 'var(--hazard)' : 'var(--safe)';
                      return (
                        <div key={i} className="bg-card rounded-sm p-3.5 border-l-4" style={{ borderLeftColor: color }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="bg-mono text-[10px] tracking-wide text-[var(--ink-soft)]">{FLAG_LABELS[f.tipas] || f.tipas}</span>
                            <AlertTriangle size={13} style={{ color }} />
                          </div>
                          <p className="text-xs font-medium text-[var(--ink-soft)] mb-1">{nameOf(f.bidId)}</p>
                          <p className="text-sm mb-2.5">{f.aprasymas}</p>

                          <div className="flex items-center gap-2 pt-2 border-t bg-hairline">
                            <button
                              onClick={() => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'agree' } }))}
                              className="bg-mono text-[10px] px-2.5 py-1 rounded-sm border"
                              style={{
                                borderColor: fb?.decision === 'agree' ? 'var(--safe)' : 'var(--line)',
                                background: fb?.decision === 'agree' ? 'var(--safe-bg)' : 'transparent',
                                color: fb?.decision === 'agree' ? 'var(--safe)' : 'var(--ink-soft)',
                              }}
                            >
                              Sutinku
                            </button>
                            <button
                              onClick={() => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], decision: 'false_positive' } }))}
                              className="bg-mono text-[10px] px-2.5 py-1 rounded-sm border"
                              style={{
                                borderColor: fb?.decision === 'false_positive' ? 'var(--danger)' : 'var(--line)',
                                background: fb?.decision === 'false_positive' ? 'var(--danger-bg)' : 'transparent',
                                color: fb?.decision === 'false_positive' ? 'var(--danger)' : 'var(--ink-soft)',
                              }}
                            >
                              Klaidingas perspėjimas
                            </button>
                          </div>
                          {fb?.decision && (
                            <input
                              className="bg-input rounded-sm px-2.5 py-1.5 text-xs w-full mt-2"
                              placeholder="Komentaras (nebūtina)..."
                              value={fb.comment || ''}
                              onChange={(e) => setFlagFeedback((s) => ({ ...s, [key]: { ...s[key], comment: e.target.value } }))}
                            />
                          )}
                        </div>
                      );
                    })}
                    {(!analysis.flags || analysis.flags.length === 0) && (
                      <p className="text-sm text-[var(--ink-soft)] col-span-2">Rimtų anomalijų nerasta.</p>
                    )}
                  </div>
                </div>

                <div>
                  <button onClick={() => setExpandedMatrix((v) => !v)} className="bg-display text-2xl font-bold mb-4 flex items-center gap-2 w-full text-left">
                    Apimties lentelė {expandedMatrix ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  {expandedMatrix && (
                    <div className="bg-card rounded-sm overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-hairline">
                            <th className="text-left p-3 bg-mono text-[11px] text-[var(--ink-soft)]">KATEGORIJA</th>
                            {bids.map((b) => (
                              <th key={b.id} className="text-left p-3 bg-mono text-[11px] text-[var(--ink-soft)]">
                                {b.name || '—'}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(analysis.scopeMatrix || []).map((row, i) => (
                            <tr key={i} className="border-b bg-hairline last:border-0">
                              <td className="p-3 font-medium">{row.kategorija}</td>
                              {bids.map((b) => {
                                const cell = (row.eilutes || []).find((e) => e.bidId === b.id);
                                const missing = !cell || cell.yra === false;
                                return (
                                  <td key={b.id} className={`p-3 bg-mono ${missing ? 'text-[var(--danger)]' : ''}`}>
                                    {missing ? 'NĖRA' : `€${Number(cell?.kaina).toLocaleString('lt-LT')}`}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'projects' && (
          <div className="space-y-3">
            <h2 className="bg-display text-2xl font-bold">Išsaugoti projektai</h2>
            {savedProjects.length === 0 && (
              <p className="bg-card rounded-sm p-6 text-sm text-[var(--ink-soft)]">
                Kol kas nieko neišsaugota. Padaryk analizę skiltyje „Nauja analizė" ir paspausk „Išsaugoti projektą".
              </p>
            )}
            {savedProjects.map((p) => {
              const scores = p.analysis?.bidScores || [];
              const riskiest = scores.length ? [...scores].sort((a, b) => a.balas - b.balas)[0] : null;
              return (
                <div key={p.id} className="bg-card rounded-sm p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">{p.label}</p>
                    <p className="bg-mono text-[11px] text-[var(--ink-soft)] mt-1">
                      {new Date(p.savedAt).toLocaleDateString('lt-LT')} · {p.bids?.length || 0} pasiūlymai
                      {riskiest && ` · rizikingiausias: ${p.bids?.find((b) => b.id === riskiest.bidId)?.name || '—'} (${riskiest.balas})`}
                    </p>
                  </div>
                  <button onClick={() => deleteProject(p.id)} className="text-[var(--ink-soft)] hover:text-[var(--danger)]" aria-label="Šalinti projektą">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {view === 'contractors' && (
          <div className="space-y-3">
            <h2 className="bg-display text-2xl font-bold">Rangovų istorija</h2>
            <p className="text-sm text-[var(--ink-soft)] max-w-xl">
              Suvesta iš visų išsaugotų projektų. Kuo daugiau projektų pereina per sistemą, tuo tiksliau matosi, kuris rangovas realiai patikimas.
            </p>
            {contractorStats.length === 0 && (
              <p className="bg-card rounded-sm p-6 text-sm text-[var(--ink-soft)]">Kol kas nėra pakankamai duomenų. Istorija kaupiasi su kiekvienu išsaugotu projektu.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contractorStats.map((c) => {
                const tier = riskTier(c.avg);
                return (
                  <div key={c.name} className="bg-card rounded-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm truncate pr-2">{c.name}</p>
                      <span className={`bg-mono text-sm font-semibold px-2 py-0.5 rounded-sm ${tier.className}`}>{c.avg}</span>
                    </div>
                    <div className="flex gap-4 bg-mono text-[11px] text-[var(--ink-soft)]">
                      <span>{c.projects} projektai</span>
                      <span>vid. balas {c.avg}</span>
                      {c.highRisk > 0 && <span style={{ color: 'var(--danger)' }}>{c.highRisk}× rizikinga</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
