'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CircleAlert,
  Check,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  GripVertical,
  Layers3,
  Pencil,
  Plus,
  Save,
  ScanSearch,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  UserRound,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FileUpload,
  Input,
  Skeleton,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHeadCell,
  TableHeader,
  TableRow,
  Text,
} from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { uid } from '@/lib/uid';
import { storage } from '@/lib/storage';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { parseBoqFile, type OcrProgress } from '@/lib/boq/parseBoq';
import { buildWorkPackages, OTHER_PACKAGE_NAME } from '@/lib/boq/classify';
import type { BoqFileType, BoqRow, ExcludedBoqLine, WorkPackage } from '@/lib/boq/types';
import {
  isPackageNameAvailable,
  makeUniquePackageName,
  mergeWorkPackages,
  moveRowsToPackage,
  removeEmptyPackage,
  splitRowsIntoPackage,
} from '@/lib/boq/workPackageOperations';
import { SupplierRequestModal } from '@/components/features/SupplierRequestModal';
import { SupplierRequestHistory } from '@/components/features/SupplierRequestHistory';

type ImportStatus = 'idle' | 'reading' | 'review' | 'ready' | 'error';

const selectClass =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 transition-colors duration-150 ease-out hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500';

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameWithoutExtension(name: string): string {
  return (name.replace(/\.[^.]+$/, '').trim() || 'Naujas sąmatos projektas').slice(0, 120);
}

export function BoqImport() {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileType, setFileType] = useState<BoqFileType>('unknown');
  const [headerFound, setHeaderFound] = useState(true);
  const [usedFileSections, setUsedFileSections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfExtractionMethod, setPdfExtractionMethod] = useState<'text' | 'ocr' | undefined>(undefined);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);

  const [pendingRows, setPendingRows] = useState<Omit<BoqRow, 'packageId'>[]>([]);
  const [removedRows, setRemovedRows] = useState<Omit<BoqRow, 'packageId'>[]>([]);
  const [excludedLines, setExcludedLines] = useState<ExcludedBoqLine[]>([]);

  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [rows, setRows] = useState<BoqRow[]>([]);
  const [packageHistory, setPackageHistory] = useState<{ packages: WorkPackage[]; rows: BoqRow[]; label: string }[]>([]);
  const [packageNameError, setPackageNameError] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [dragOverPackageId, setDragOverPackageId] = useState<string | null>(null);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [newPackageDraft, setNewPackageDraft] = useState<string | null>(null);
  const [supplierRequestOpen, setSupplierRequestOpen] = useState(false);
  const [supplierRequestRefreshKey, setSupplierRequestRefreshKey] = useState(0);
  const [supplierRequestSaved, setSupplierRequestSaved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [suggestedProjectName, setSuggestedProjectName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    const initialize = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserEmail(data.user?.email ?? null);

      const requestedProjectId = new URLSearchParams(window.location.search).get('project');
      if (!requestedProjectId || !data.user) return;
      const { data: project, error: loadError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', requestedProjectId)
        .single();
      if (!active) return;
      if (loadError || !project) {
        setSaveError('Nepavyko atidaryti projekto arba neturite prieigos.');
        return;
      }

      setProjectId(project.id);
      setProjectName(project.name);
      setFileName(project.source_file_name);
      setFileSize(project.source_file_size);
      setPackages(project.packages as WorkPackage[]);
      setRows(project.rows as BoqRow[]);
      setSelectedPackageId((project.packages as WorkPackage[])[0]?.id ?? null);
      setStatus('ready');
    };
    void initialize();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (active) setUserEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleFile = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    const fallbackProjectName = fileNameWithoutExtension(file.name);
    setFileName(file.name);
    setFileSize(file.size);
    setSuggestedProjectName(fallbackProjectName);
    setStatus('reading');
    setError(null);
    setOcrProgress(null);
    setRemovedRows([]);

    const result = await parseBoqFile(file, (progress) => setOcrProgress(progress));
    setFileType(result.fileType);
    setHeaderFound(result.headerFound);
    setPdfExtractionMethod(result.pdfExtractionMethod);
    setSuggestedProjectName(result.projectNameSuggestion ?? fallbackProjectName);

    if (result.error) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setPendingRows(result.rows);
    setExcludedLines(result.excluded);
    setStatus('review');
  };

  const confirmImport = () => {
    if (criticalIssueCount > 0) return;
    const built = buildWorkPackages(pendingRows, uid);
    setPackages(built.packages);
    setRows(built.rows);
    setUsedFileSections(built.usedFileSections);
    setSelectedPackageId(built.packages[0]?.id ?? null);
    setSelectedRowIds(new Set());
    setPackageHistory([]);
    setPackageNameError('');
    setProjectId(null);
    setProjectName(suggestedProjectName || fileNameWithoutExtension(fileName));
    setStatus('ready');
  };

  const startOver = () => {
    setStatus('idle');
    setFileName('');
    setError(null);
    setOcrProgress(null);
    setPdfExtractionMethod(undefined);
    setPendingRows([]);
    setRemovedRows([]);
    setExcludedLines([]);
    setPackages([]);
    setRows([]);
    setPackageHistory([]);
    setPackageNameError('');
    setSelectedPackageId(null);
    setMergeMode(false);
    setMergeSelection(new Set());
    setSelectedRowIds(new Set());
    setProjectId(null);
    setProjectName('');
    setSuggestedProjectName('');
  };

  const packageCount = (pkgId: string) => rows.filter((r) => r.packageId === pkgId).length;
  const visibleRows = selectedPackageId ? rows.filter((r) => r.packageId === selectedPackageId) : rows;
  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null;
  const selectedRequestRows = rows.filter((row) => selectedRowIds.has(row.id));

  const recordPackageChange = (label: string) => {
    setPackageHistory((previous) => [...previous.slice(-9), { packages, rows, label }]);
  };

  const undoPackageChange = () => {
    const snapshot = packageHistory[packageHistory.length - 1];
    if (!snapshot) return;
    setPackages(snapshot.packages);
    setRows(snapshot.rows);
    setPackageHistory((previous) => previous.slice(0, -1));
    setSelectedPackageId(snapshot.packages.some((pkg) => pkg.id === selectedPackageId) ? selectedPackageId : snapshot.packages[0]?.id ?? null);
    setSelectedRowIds(new Set());
    setMergeMode(false);
    setMergeSelection(new Set());
  };

  const duplicateRowIds = useMemo(() => {
    const rowsBySignature = new Map<string, string[]>();
    for (const row of pendingRows) {
      const signature = [row.positionNumber, row.name, row.unit, row.quantity]
        .map((value) => String(value ?? '').trim().toLocaleLowerCase('lt-LT'))
        .join('|');
      rowsBySignature.set(signature, [...(rowsBySignature.get(signature) ?? []), row.id]);
    }
    return new Set([...rowsBySignature.values()].filter((ids) => ids.length > 1).flat());
  }, [pendingRows]);

  const issuesForRow = (row: Omit<BoqRow, 'packageId'>): string[] => {
    const issues: string[] = [];
    if (!row.positionNumber?.trim()) issues.push('Trūksta pozicijos numerio');
    if (duplicateRowIds.has(row.id)) issues.push('Pasikartojanti sąmatos eilutė');
    if (!row.name.trim()) issues.push('Trūksta pavadinimo');
    if (!row.unit?.trim()) issues.push('Trūksta mato vieneto');
    if (row.quantity === null || !Number.isFinite(row.quantity)) issues.push('Trūksta kiekio');
    else if (row.quantity <= 0) issues.push('Kiekis turi būti didesnis už nulį');
    return issues;
  };

  const criticalIssueCount = pendingRows.reduce((count, row) => count + (issuesForRow(row).length > 0 ? 1 : 0), 0);

  const updatePendingRow = <K extends keyof Omit<BoqRow, 'packageId'>>(
    id: string,
    field: K,
    value: Omit<BoqRow, 'packageId'>[K]
  ) => setPendingRows((previous) => previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  const removePendingRow = (id: string) => {
    const row = pendingRows.find((candidate) => candidate.id === id);
    if (!row) return;
    setPendingRows((previous) => previous.filter((candidate) => candidate.id !== id));
    setRemovedRows((previous) => [...previous, row]);
  };

  const restoreLastRemovedRow = () => {
    const row = removedRows[removedRows.length - 1];
    if (!row) return;
    setPendingRows((previous) => [...previous, row]);
    setRemovedRows((previous) => previous.slice(0, -1));
  };

  const startRename = (pkg: WorkPackage) => {
    setRenamingId(pkg.id);
    setRenameValue(pkg.name);
    setPackageNameError('');
  };
  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (!isPackageNameAvailable(packages, trimmed, renamingId)) {
      setPackageNameError(trimmed ? 'Paketas tokiu pavadinimu jau yra.' : 'Įvesk paketo pavadinimą.');
      return;
    }
    if (trimmed) {
      recordPackageChange('Paketo pervadinimas');
      setPackages((prev) => prev.map((p) => (p.id === renamingId ? { ...p, name: trimmed, source: 'custom' } : p)));
    }
    setPackageNameError('');
    setRenamingId(null);
  };

  const createPackage = (name: string) => {
    const trimmed = name.trim();
    if (!isPackageNameAvailable(packages, trimmed)) {
      setPackageNameError(trimmed ? 'Paketas tokiu pavadinimu jau yra.' : 'Įvesk paketo pavadinimą.');
      return;
    }
    const newPkg: WorkPackage = { id: uid(), name: trimmed, source: 'custom' };
    recordPackageChange('Naujas paketas');
    setPackages((prev) => [...prev, newPkg]);
    setSelectedPackageId(newPkg.id);
    setNewPackageDraft(null);
    setPackageNameError('');
  };

  const toggleMergeSelect = (id: string) =>
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitMerge = () => {
    if (mergeSelection.size < 2) return;
    recordPackageChange('Paketų sujungimas');
    const result = mergeWorkPackages(packages, rows, mergeSelection);
    const targetId = result.packages.find((pkg) => mergeSelection.has(pkg.id))?.id ?? result.packages[0]?.id ?? null;
    setRows(result.rows);
    setPackages(result.packages);
    setSelectedPackageId(targetId);
    setMergeSelection(new Set());
    setMergeMode(false);
  };

  const toggleRowSelect = (id: string) =>
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const moveRowToPackage = (rowId: string, packageId: string) => {
    if (rows.find((row) => row.id === rowId)?.packageId === packageId) return;
    recordPackageChange('Pozicijos perkėlimas');
    setRows((previous) => moveRowsToPackage(previous, [rowId], packageId));
    setSelectedRowIds((previous) => {
      const next = new Set(previous);
      next.delete(rowId);
      return next;
    });
  };

  const toggleAllVisibleRows = () => {
    const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRowIds.has(row.id));
    setSelectedRowIds((previous) => {
      const next = new Set(previous);
      for (const row of visibleRows) {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  };

  const moveSelectedRowsToPackage = (packageId: string) => {
    if (selectedRowIds.size === 0 || !packageId) return;
    recordPackageChange('Kelių pozicijų perkėlimas');
    setRows((previous) => moveRowsToPackage(previous, selectedRowIds, packageId));
    setSelectedRowIds(new Set());
    setSelectedPackageId(packageId);
  };

  const splitSelectedRows = () => {
    if (!selectedPackage || selectedRowIds.size === 0) return;
    const newPkg: WorkPackage = { id: uid(), name: makeUniquePackageName(packages, `${selectedPackage.name} (dalis)`), source: 'custom' };
    recordPackageChange('Paketo padalijimas');
    const result = splitRowsIntoPackage(packages, rows, selectedRowIds, newPkg);
    setPackages(result.packages);
    setRows(result.rows);
    setSelectedRowIds(new Set());
    setSelectedPackageId(newPkg.id);
  };

  const deleteEmptyPackage = (packageId: string) => {
    const nextPackages = removeEmptyPackage(packages, rows, packageId);
    if (nextPackages === packages) return;
    recordPackageChange('Tuščio paketo pašalinimas');
    setPackages(nextPackages);
    setSelectedPackageId(nextPackages[0]?.id ?? null);
  };

  const saveWorkPackages = async () => {
    setSaving(true);
    setSaveError('');
    try {
      storage.set(
        'boq-work-packages:current',
        JSON.stringify({ savedAt: Date.now(), fileName, packages, rows })
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !userEmail) {
        setSavedNotice(true);
        if (isSupabaseConfigured()) router.push('/auth');
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/auth');
        return;
      }

      const payload = {
        owner_id: auth.user.id,
        name: projectName.trim() || fileName.replace(/\.[^.]+$/, '') || 'Sąmatos projektas',
        source_file_name: fileName,
        source_file_size: fileSize,
        packages,
        rows,
      };
      const query = projectId
        ? supabase.from('projects').update(payload).eq('id', projectId).select('id').single()
        : supabase.from('projects').insert(payload).select('id').single();
      const { data, error: cloudError } = await query;
      if (cloudError) throw cloudError;
      setProjectId(data.id);
      window.history.replaceState(null, '', `/?project=${data.id}`);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Nepavyko išsaugoti projekto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
              <ShieldCheck size={18} aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">BidGuard</span>
            <span className="hidden rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">
              Sąmatų valdymas
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-gray-400 md:inline">Sąmata yra pagrindinis tiesos šaltinis</span>
            <Link href="/supplier-quotes" className="text-xs font-medium text-gray-500 transition-colors hover:text-primary-600">
              Pasiūlymų analizė
            </Link>
            <Link
              href={userEmail ? '/projects' : '/auth'}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <UserRound size={14} /> {userEmail ? 'Mano projektai' : 'Prisijungti'}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          {status !== 'idle' && (
            <div className="mb-7 grid gap-6 border-b border-gray-200 pb-7 lg:grid-cols-[1fr_420px] lg:items-end">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">Projekto sąmatos paruošimas</p>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sąmatos importas</h1>
                <Text muted className="mt-2 max-w-2xl">Patikrink importuotas pozicijas prieš kurdamas darbų paketus.</Text>
              </div>
              <Stepper
                steps={[{ label: 'Įkelti sąmatą' }, { label: 'Patikrinti pozicijas' }, { label: 'Darbų paketai' }]}
                currentStep={status === 'review' ? 2 : status === 'ready' ? 3 : 1}
              />
            </div>
          )}

          {status === 'idle' && (
            <div className="animate-fade-in">
              <div className="grid items-center gap-10 py-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-10">
                <section>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700">
                    <FileCheck2 size={13} aria-hidden /> Patikimas sąmatos importas
                  </div>
                  <h1 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-gray-900 sm:text-5xl">
                    Nuo dokumento iki aiškių darbų paketų.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-gray-500">
                    Įkelk užsakovo sąmatą (darbų kiekių žiniaraštį). BidGuard ištrauks tikras pozicijas, atskirs dokumento šiukšles ir
                    leis tau patvirtinti rezultatą prieš formuojant užklausas rangovams.
                  </p>
                  <div className="mt-8 space-y-4">
                    {[
                      { icon: ScanSearch, title: 'Deterministic patikra', text: 'Pozicijos numeris, pavadinimas, vienetas ir kiekis tikrinami aiškiomis taisyklėmis.' },
                      { icon: FileSpreadsheet, title: 'Excel, PDF ir OCR', text: 'Skirtingi šaltiniai paverčiami į vienodą darbų pozicijų struktūrą.' },
                      { icon: Layers3, title: 'Kontrolė lieka tau', text: 'Prieš tęsiant matai priimtas bei atmestas eilutes ir pats tvarkai paketus.' },
                    ].map(({ icon: Icon, title, text }) => (
                      <div key={title} className="flex gap-3.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm ring-1 ring-gray-200"><Icon size={16} aria-hidden /></span>
                        <div><h2 className="text-sm font-semibold text-gray-900">{title}</h2><p className="mt-0.5 text-xs leading-5 text-gray-500">{text}</p></div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg shadow-gray-900/[0.06]">
                  <div className="border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white px-6 py-5 sm:px-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-600">1 žingsnis iš 3</p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">Įkelk užsakovo sąmatą</h2>
                    <p className="mt-1 text-xs text-gray-500">Originalus dokumentas nebus keičiamas.</p>
                  </div>
                  <div className="p-5 sm:p-8">
                    <FileUpload
                      accept=".xlsx,.xls,.pdf"
                      label="Vilkite sąmatos failą čia"
                      hint="arba spauskite ir pasirinkite iš kompiuterio"
                      onFilesSelected={handleFile}
                      className="min-h-[230px] rounded-xl bg-gray-50/70 px-8 py-12 hover:bg-primary-50/50"
                    />
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400">
                      <span>Excel · PDF su tekstu · skenuotas PDF</span>
                      <span className="flex items-center gap-1.5 text-success-700"><ShieldCheck size={13} /> Duomenys lieka tavo darbo sesijoje</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-8 rounded-xl border border-gray-200 bg-white px-5 py-4 sm:px-7">
                <Stepper
                  steps={[{ label: 'Įkelti sąmatą' }, { label: 'Patikrinti pozicijas' }, { label: 'Darbų paketai' }]}
                  currentStep={1}
                  className="mx-auto max-w-2xl"
                />
              </div>
            </div>
          )}

          {status === 'reading' && (
            <Card className="animate-fade-in">
              <CardContent>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-medium text-gray-700">{fileName}</p>
                    <p className="text-xs text-gray-400">
                      {ocrProgress
                        ? `OCR atpažinimas: ${ocrProgress.page}/${ocrProgress.totalPages} psl. (${ocrProgress.stage === 'render' ? 'ruošiama' : 'atpažįstama'})…`
                        : 'Ieškoma darbų pozicijų…'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'review' && (
            <div className="animate-fade-in space-y-4">
              <Alert variant="success" title={`Aptikta darbų pozicijų: ${pendingRows.length.toLocaleString('lt-LT')}`}>
                Importas dar nepatvirtintas. Peržiūrėk priimtas pozicijas ir atmestas dokumento eilutes — darbų paketai
                bus formuojami tik po tavo patvirtinimo.
              </Alert>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-success-700">Paruošta</p>
                  <p className="mt-1 text-xl font-semibold text-success-900">{(pendingRows.length - criticalIssueCount).toLocaleString('lt-LT')}</p>
                  <p className="text-xs text-success-700">pozicijos be klaidų</p>
                </div>
                <div className={cn('rounded-lg border px-4 py-3', criticalIssueCount > 0 ? 'border-warning-200 bg-warning-50' : 'border-gray-200 bg-white')}>
                  <p className={cn('text-[10px] font-semibold uppercase tracking-wide', criticalIssueCount > 0 ? 'text-warning-700' : 'text-gray-500')}>Reikia patikrinti</p>
                  <p className={cn('mt-1 text-xl font-semibold', criticalIssueCount > 0 ? 'text-warning-900' : 'text-gray-900')}>{criticalIssueCount.toLocaleString('lt-LT')}</p>
                  <p className={cn('text-xs', criticalIssueCount > 0 ? 'text-warning-700' : 'text-gray-500')}>kritinės eilutės</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Neįtraukta</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{(excludedLines.length + removedRows.length).toLocaleString('lt-LT')}</p>
                  <p className="text-xs text-gray-500">dokumento eilutės</p>
                </div>
              </div>

              {criticalIssueCount > 0 && (
                <Alert variant="warning" title="Prieš tęsiant reikia pataisyti pažymėtas eilutes">
                  Dublikuotos sąmatos eilutės, tušti laukai ir netinkami kiekiai pažymėti lentelėje. Paketai nebus kuriami, kol liks kritinių klaidų.
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Sąmatos peržiūra ir taisymas</CardTitle>
                      <CardDescription className="mt-1">Spustelėk lauką ir pataisyk parserio rezultatą. Pakeitimai bus naudojami darbų paketams.</CardDescription>
                    </div>
                    {removedRows.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={restoreLastRemovedRow}>
                        <Undo2 size={14} /> Atkurti paskutinę pašalintą
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="!p-0">
                  <div className="max-h-[28rem] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow hover={false}>
                          <TableHeadCell>Poz. Nr.</TableHeadCell>
                          <TableHeadCell>Pavadinimas</TableHeadCell>
                          <TableHeadCell>Vnt.</TableHeadCell>
                          <TableHeadCell>Kiekis</TableHeadCell>
                          <TableHeadCell>Šaltinis</TableHeadCell>
                          <TableHeadCell>Būsena</TableHeadCell>
                          <TableHeadCell className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRows.map((row) => {
                          const rowIssues = issuesForRow(row);
                          const hasIssues = rowIssues.length > 0;
                          return (
                            <TableRow key={row.id} className={cn(hasIssues && 'bg-warning-50/60')}>
                              <TableCell className="min-w-[110px]">
                                <Input
                                  value={row.positionNumber ?? ''}
                                  onChange={(event) => updatePendingRow(row.id, 'positionNumber', event.target.value || null)}
                                  aria-label={`Pozicijos numeris: ${row.name}`}
                                  className={cn('h-8 font-mono text-xs tabular-nums', hasIssues && (!row.positionNumber?.trim() || duplicateRowIds.has(row.id)) && 'border-warning-400')}
                                />
                              </TableCell>
                              <TableCell className="min-w-[300px]">
                                <Input
                                  value={row.name}
                                  onChange={(event) => updatePendingRow(row.id, 'name', event.target.value)}
                                  aria-label={`Pozicijos ${row.positionNumber ?? ''} pavadinimas`}
                                  className={cn('h-8 text-xs font-medium', !row.name.trim() && 'border-warning-400')}
                                />
                              </TableCell>
                              <TableCell className="min-w-[90px]">
                                <Input
                                  value={row.unit ?? ''}
                                  onChange={(event) => updatePendingRow(row.id, 'unit', event.target.value || null)}
                                  aria-label={`Pozicijos ${row.positionNumber ?? ''} mato vienetas`}
                                  className={cn('h-8 text-xs', !row.unit?.trim() && 'border-warning-400')}
                                />
                              </TableCell>
                              <TableCell className="min-w-[110px]">
                                <Input
                                  type="number"
                                  step="any"
                                  value={row.quantity ?? ''}
                                  onChange={(event) => updatePendingRow(row.id, 'quantity', event.target.value === '' ? null : Number(event.target.value))}
                                  aria-label={`Pozicijos ${row.positionNumber ?? ''} kiekis`}
                                  className={cn('h-8 font-mono text-xs tabular-nums', (row.quantity === null || row.quantity <= 0) && 'border-warning-400')}
                                />
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-gray-400">{row.sourceReference ?? '—'}</TableCell>
                              <TableCell className="min-w-[170px]">
                                {hasIssues ? (
                                  <div className="flex items-start gap-1.5 text-[11px] leading-4 text-warning-700"><CircleAlert size={13} className="mt-0.5 shrink-0" /><span>{rowIssues.join(' · ')}</span></div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success-700"><CheckCircle2 size={13} /> Paruošta</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => removePendingRow(row.id)}
                                  aria-label={`Pašalinti poziciją ${row.positionNumber ?? row.name}`}
                                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-400"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {excludedLines.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Neįtrauktos {excludedLines.length.toLocaleString('lt-LT')} dokumento eilutės</CardTitle>
                    <CardDescription>Šios eilutės neturėjo visų reikalingų darbų pozicijos laukų, todėl nebuvo importuotos.</CardDescription>
                  </CardHeader>
                  <CardContent className="!p-0">
                    <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
                      {excludedLines.map((line, idx) => (
                        <div key={idx} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                          <Badge variant="neutral" className="mt-0.5 shrink-0">
                            {line.reason}
                          </Badge>
                          <span className="min-w-0 flex-1 text-gray-600">
                            <span className="block break-words">{line.raw}</span>
                            {line.sourceReference && <span className="mt-0.5 block text-[11px] text-gray-400">{line.sourceReference}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" onClick={confirmImport} disabled={pendingRows.length === 0 || criticalIssueCount > 0}>
                  <CheckCircle2 size={18} aria-hidden />
                  {criticalIssueCount > 0 ? `Pataisyk eilutes (${criticalIssueCount})` : 'Patvirtinti importą'}
                </Button>
                <Button variant="secondary" size="lg" onClick={startOver}>
                  Importuoti kitą failą
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 animate-fade-in">
              <Alert variant="error" title={fileName}>
                {error}
              </Alert>
              <Button variant="secondary" size="sm" onClick={startOver}>
                Bandyti kitą failą
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <div className="animate-fade-in space-y-5 pb-28">
              {saveError && <Alert variant="error" title="Projekto saugojimas">{saveError}</Alert>}
              {supplierRequestSaved && (
                <Alert variant="success" title="Tiekėjų užklausa išsaugota">
                  Pasirinkta darbų apimtis ir atskiri gavėjai pridėti prie projekto istorijos.
                </Alert>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <Badge variant="neutral">{fileName}</Badge>
                  <span>{formatFileSize(fileSize)}</span>
                  <span>·</span>
                  <span>{rows.length.toLocaleString('lt-LT')} pozicijos</span>
                  <span>·</span>
                  <span>
                    {usedFileSections ? 'Sugrupuota pagal failo skyrius' : 'Sugrupuota automatiškai pagal pozicijų tekstą'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={startOver}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Importuoti kitą failą
                </button>
              </div>

              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block min-w-0 flex-1">
                    <span className="mb-1.5 block text-xs font-semibold text-gray-700">Projekto pavadinimas</span>
                    <Input
                      value={projectName}
                      onChange={(event) => {
                        setProjectName(event.target.value);
                        setSavedNotice(false);
                      }}
                      maxLength={120}
                      aria-label="Projekto pavadinimas"
                      placeholder="Pvz., Sembos gatvės kapitalinis remontas"
                      className="h-11 text-base font-medium"
                    />
                    <span className="mt-1.5 block text-xs text-gray-500">
                      {suggestedProjectName && suggestedProjectName !== fileNameWithoutExtension(fileName)
                        ? 'Pasiūlyta pagal sąmatos antraštę. Jei reikia, pavadinimą pakeiskite.'
                        : 'Įrašykite objektą arba užsakovą, kad projektą būtų lengva rasti.'}
                    </span>
                  </label>
                  <div className="shrink-0 text-xs text-gray-400 sm:pb-7">Iki 120 simbolių</div>
                </CardContent>
              </Card>

              {projectId && <SupplierRequestHistory projectId={projectId} refreshKey={supplierRequestRefreshKey} />}

              {!headerFound && fileType === 'xlsx' && (
                <Alert variant="warning" title="Antraštės eilutė neaptikta">
                  Nepavyko patikimai atpažinti stulpelių antraščių — pozicijos sudarytos iš pilno eilutės teksto.
                </Alert>
              )}
              {fileType === 'pdf' && pdfExtractionMethod === 'ocr' && (
                <Alert variant="warning" title="Duomenys atpažinti OCR būdu">
                  Šis PDF neturėjo pažymimo teksto sluoksnio (tekstas buvo konvertuotas į vektorinius kontūrus), todėl
                  pozicijos atpažintos optiniu būdu (OCR). Būtinai patikrink kiekius ir pavadinimus rankiniu būdu.
                </Alert>
              )}
              {fileType === 'pdf' && pdfExtractionMethod === 'text' && (
                <Alert variant="warning" title="Duomenys ištraukti iš PDF teksto">
                  PDF struktūra negarantuota — kiekis ir mato vienetas gali būti aptikti ne visose pozicijose.
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
                {/* Left: Work Packages */}
                <Card className="h-fit">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Darbų paketai</CardTitle>
                        <CardDescription>{packages.length} paketai · pasirink paketą ir tvarkyk jo pozicijas</CardDescription>
                      </div>
                      {packageHistory.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={undoPackageChange} title={packageHistory.at(-1)?.label}>
                          <Undo2 size={14} /> Atšaukti
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="!p-0">
                    <div className="divide-y divide-gray-100">
                      {packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            if (!mergeMode && renamingId !== pkg.id) {
                              setSelectedPackageId(pkg.id);
                              setSelectedRowIds(new Set());
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverPackageId(pkg.id);
                          }}
                          onDragLeave={() => setDragOverPackageId((id) => (id === pkg.id ? null : id))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const rowId = e.dataTransfer.getData('text/plain');
                            if (rowId) moveRowToPackage(rowId, pkg.id);
                            setDragOverPackageId(null);
                          }}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors duration-150 ease-out',
                            !mergeMode && selectedPackageId === pkg.id && 'bg-primary-50',
                            dragOverPackageId === pkg.id && 'bg-primary-50 ring-2 ring-inset ring-primary-400'
                          )}
                        >
                          {mergeMode && (
                            <input
                              type="checkbox"
                              checked={mergeSelection.has(pkg.id)}
                              onChange={() => toggleMergeSelect(pkg.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                              aria-label={`Pasirinkti ${pkg.name} sujungimui`}
                            />
                          )}
                          {renamingId === pkg.id ? (
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <>
                              <Check size={14} className="shrink-0 text-success-600" aria-hidden />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{pkg.name}</span>
                              <span className="shrink-0 text-xs text-gray-400">({packageCount(pkg.id)})</span>
                              {!mergeMode && (
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRename(pkg);
                                    }}
                                    aria-label={`Pervadinti ${pkg.name}`}
                                    className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  {packageCount(pkg.id) === 0 && packages.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEmptyPackage(pkg.id);
                                      }}
                                      aria-label={`Pašalinti tuščią paketą ${pkg.name}`}
                                      className="rounded p-1 text-gray-300 hover:bg-danger-50 hover:text-danger-600"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="p-3">
                      {newPackageDraft !== null ? (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            value={newPackageDraft}
                            onChange={(e) => setNewPackageDraft(e.target.value)}
                            placeholder="Naujo paketo pavadinimas"
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') createPackage(newPackageDraft);
                              if (e.key === 'Escape') setNewPackageDraft(null);
                            }}
                          />
                          <Button size="sm" onClick={() => createPackage(newPackageDraft)}>
                            Sukurti
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setNewPackageDraft('')}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2.5 text-xs font-medium text-gray-500 transition-colors duration-150 ease-out hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600"
                        >
                          <Plus size={14} />
                          Naujas paketas
                        </button>
                      )}
                      {packageNameError && <p className="mt-2 text-xs text-danger-600">{packageNameError}</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Right: rows of the selected package */}
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{selectedPackage?.name ?? OTHER_PACKAGE_NAME}</CardTitle>
                      <CardDescription>{visibleRows.length} pozicijos</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedRowIds.size > 0 && (
                        <>
                          <Button size="sm" onClick={() => setSupplierRequestOpen(true)}>
                            <Send size={14} aria-hidden />
                            Paruošti tiekėjo užklausą ({selectedRowIds.size})
                          </Button>
                          <select
                            className={selectClass}
                            value=""
                            onChange={(event) => moveSelectedRowsToPackage(event.target.value)}
                            aria-label={`Perkelti pasirinktas ${selectedRowIds.size} pozicijas`}
                          >
                            <option value="" disabled>Perkelti pasirinktas ({selectedRowIds.size})…</option>
                            {packages.filter((pkg) => pkg.id !== selectedPackageId).map((pkg) => (
                              <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                            ))}
                          </select>
                          <Button variant="secondary" size="sm" onClick={splitSelectedRows}>
                            Naujas paketas iš pasirinktų ({selectedRowIds.size})
                          </Button>
                        </>
                      )}
                      {selectedRowIds.size === 0 && visibleRows.length > 0 && (
                        <Button variant="secondary" size="sm" onClick={toggleAllVisibleRows}>
                          Pasirinkti visą paketą užklausai
                        </Button>
                      )}
                      {!mergeMode ? (
                        <Button variant="secondary" size="sm" onClick={() => setMergeMode(true)}>
                          Sujungti paketus
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMergeMode(false);
                              setMergeSelection(new Set());
                            }}
                          >
                            Atšaukti
                          </Button>
                          <Button size="sm" disabled={mergeSelection.size < 2} onClick={commitMerge}>
                            Sujungti ({mergeSelection.size})
                          </Button>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="!p-0">
                    {visibleRows.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          title="Šiame pakete pozicijų nėra"
                          description="Pertempk eilutes iš kito paketo (dešinėje esančios lentelės eilutę nuvilk ant paketo kairėje) arba pasirink „Perkelti į“ eilutėje."
                        />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow hover={false}>
                            <TableHeadCell className="w-8" />
                            <TableHeadCell className="w-8">
                              <input
                                type="checkbox"
                                checked={visibleRows.length > 0 && visibleRows.every((row) => selectedRowIds.has(row.id))}
                                onChange={toggleAllVisibleRows}
                                aria-label="Pasirinkti visas matomas pozicijas"
                              />
                            </TableHeadCell>
                            <TableHeadCell>Poz. Nr.</TableHeadCell>
                            <TableHeadCell>Pavadinimas</TableHeadCell>
                            <TableHeadCell>Vnt.</TableHeadCell>
                            <TableHeadCell>Kiekis</TableHeadCell>
                            <TableHeadCell>Pastabos</TableHeadCell>
                            <TableHeadCell>Perkelti į</TableHeadCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.map((row) => (
                            <TableRow
                              key={row.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', row.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                              <TableCell className="cursor-grab text-gray-300" aria-hidden>
                                <GripVertical size={14} />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedRowIds.has(row.id)}
                                  onChange={() => toggleRowSelect(row.id)}
                                  aria-label={`Pasirinkti eilutę: ${row.name}`}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs tabular-nums text-gray-500">
                                {row.positionNumber ?? '—'}
                              </TableCell>
                              <TableCell className="max-w-[280px]">{row.name}</TableCell>
                              <TableCell className="text-gray-600">{row.unit ?? '—'}</TableCell>
                              <TableCell className="font-mono tabular-nums">{row.quantity ?? '—'}</TableCell>
                              <TableCell className="max-w-[160px] truncate text-xs text-gray-500">
                                {row.notes ?? ''}
                              </TableCell>
                              <TableCell>
                                <select
                                  className={selectClass}
                                  value={row.packageId}
                                  onChange={(e) => moveRowToPackage(row.id, e.target.value)}
                                  aria-label={`Perkelti „${row.name}“ į kitą paketą`}
                                >
                                  {packages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      {status === 'ready' && (
        <footer className="sticky bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{projectName || fileNameWithoutExtension(fileName)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                <AlertTriangle size={13} className="shrink-0 text-gray-300" aria-hidden />
                {userEmail ? `Projektas saugomas paskyroje ${userEmail}` : 'Juodraštis saugomas šiame įrenginyje. Prisijunkite išsaugojimui debesyje.'}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button variant="primary" size="lg" onClick={saveWorkPackages} isLoading={saving} className="w-full sm:w-auto">
              {!saving && <Save size={18} aria-hidden />}
              {savedNotice ? 'Išsaugota ✓' : userEmail ? 'Išsaugoti projektą' : 'Prisijungti ir išsaugoti'}
              </Button>
            </div>
          </div>
        </footer>
      )}

      <SupplierRequestModal
        open={supplierRequestOpen && selectedRequestRows.length > 0}
        onClose={() => setSupplierRequestOpen(false)}
        onSaved={() => {
          setSupplierRequestSaved(true);
          setSupplierRequestRefreshKey((value) => value + 1);
          window.setTimeout(() => setSupplierRequestSaved(false), 4000);
        }}
        projectId={projectId}
        projectName={projectName || fileNameWithoutExtension(fileName)}
        rows={selectedRequestRows}
        packages={packages}
      />
    </div>
  );
}

export default BoqImport;
