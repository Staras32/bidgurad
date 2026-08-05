'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  GripVertical,
  ListChecks,
  Pencil,
  Plus,
  Save,
  X,
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
import { parseBoqFile } from '@/lib/boq/parseBoq';
import { buildWorkPackages, OTHER_PACKAGE_NAME } from '@/lib/boq/classify';
import type { BoqFileType, BoqRow, WorkPackage } from '@/lib/boq/types';

type ImportStatus = 'idle' | 'reading' | 'ready' | 'error';

const selectClass =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 transition-colors duration-150 ease-out hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500';

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BoqImport() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileType, setFileType] = useState<BoqFileType>('unknown');
  const [headerFound, setHeaderFound] = useState(true);
  const [usedFileSections, setUsedFileSections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [rows, setRows] = useState<BoqRow[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [dragOverPackageId, setDragOverPackageId] = useState<string | null>(null);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [newPackageDraft, setNewPackageDraft] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleFile = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setStatus('reading');
    setError(null);

    const result = await parseBoqFile(file);
    setFileType(result.fileType);
    setHeaderFound(result.headerFound);

    if (result.error) {
      setStatus('error');
      setError(result.error);
      return;
    }

    const built = buildWorkPackages(result.rows, uid);
    setPackages(built.packages);
    setRows(built.rows);
    setUsedFileSections(built.usedFileSections);
    setSelectedPackageId(built.packages[0]?.id ?? null);
    setSelectedRowIds(new Set());
    setStatus('ready');
  };

  const startOver = () => {
    setStatus('idle');
    setFileName('');
    setError(null);
    setPackages([]);
    setRows([]);
    setSelectedPackageId(null);
    setMergeMode(false);
    setMergeSelection(new Set());
    setSelectedRowIds(new Set());
  };

  const packageCount = (pkgId: string) => rows.filter((r) => r.packageId === pkgId).length;
  const visibleRows = selectedPackageId ? rows.filter((r) => r.packageId === selectedPackageId) : rows;
  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null;

  const startRename = (pkg: WorkPackage) => {
    setRenamingId(pkg.id);
    setRenameValue(pkg.name);
  };
  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      setPackages((prev) => prev.map((p) => (p.id === renamingId ? { ...p, name: trimmed, source: 'custom' } : p)));
    }
    setRenamingId(null);
  };

  const createPackage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNewPackageDraft(null);
      return;
    }
    const newPkg: WorkPackage = { id: uid(), name: trimmed, source: 'custom' };
    setPackages((prev) => [...prev, newPkg]);
    setSelectedPackageId(newPkg.id);
    setNewPackageDraft(null);
  };

  const toggleMergeSelect = (id: string) =>
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitMerge = () => {
    const ids = [...mergeSelection];
    if (ids.length < 2) return;
    const [targetId, ...rest] = ids;
    setRows((prev) => prev.map((r) => (rest.includes(r.packageId) ? { ...r, packageId: targetId } : r)));
    setPackages((prev) => prev.filter((p) => !rest.includes(p.id)));
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

  const moveRowToPackage = (rowId: string, packageId: string) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, packageId } : r)));

  const splitSelectedRows = () => {
    if (!selectedPackage || selectedRowIds.size === 0) return;
    const newPkg: WorkPackage = { id: uid(), name: `${selectedPackage.name} (dalis)`, source: 'custom' };
    setPackages((prev) => [...prev, newPkg]);
    setRows((prev) => prev.map((r) => (selectedRowIds.has(r.id) ? { ...r, packageId: newPkg.id } : r)));
    setSelectedRowIds(new Set());
    setSelectedPackageId(newPkg.id);
  };

  const saveWorkPackages = () => {
    setSaving(true);
    try {
      storage.set(
        'boq-work-packages:current',
        JSON.stringify({ savedAt: Date.now(), fileName, packages, rows })
      );
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ListChecks className="text-primary-600" size={18} aria-hidden />
            BidGuard
          </div>
          <Link
            href="/"
            aria-label="Uždaryti"
            className="rounded-md p-1.5 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary-600">Importuoti projekto BOQ</p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Darbų žiniaraščio importas</h1>
            <Text muted className="mt-2 max-w-2xl">
              Įkelk užsakovo darbų žiniaraštį (Excel arba PDF). Sistema automatiškai aptiks pozicijas ir sugrupuos jas į
              darbų paketus, kuriuos gali pervadinti, sujungti, padalinti ar sutvarkyti rankiniu būdu.
            </Text>
          </div>

          {status === 'idle' && (
            <Card className="animate-fade-in">
              <CardContent>
                <FileUpload
                  accept=".xlsx,.xls,.pdf"
                  label="Vilkite BOQ failą čia arba spauskite, kad pasirinktumėte"
                  hint="Palaikomi formatai: Excel ir PDF"
                  onFilesSelected={handleFile}
                />
              </CardContent>
            </Card>
          )}

          {status === 'reading' && (
            <Card className="animate-fade-in">
              <CardContent>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-medium text-gray-700">{fileName}</p>
                    <p className="text-xs text-gray-400">Skaitomos pozicijos ir aptinkami darbų paketai…</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

              {!headerFound && fileType === 'xlsx' && (
                <Alert variant="warning" title="Antraštės eilutė neaptikta">
                  Nepavyko patikimai atpažinti stulpelių antraščių — pozicijos sudarytos iš pilno eilutės teksto.
                </Alert>
              )}
              {fileType === 'pdf' && (
                <Alert variant="warning" title="Duomenys ištraukti iš PDF teksto">
                  PDF struktūra negarantuota — kiekis ir mato vienetas gali būti aptikti ne visose pozicijose.
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
                {/* Left: Work Packages */}
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="text-base">Darbų paketai</CardTitle>
                    <CardDescription>{packages.length} paketai</CardDescription>
                  </CardHeader>
                  <CardContent className="!p-0">
                    <div className="divide-y divide-gray-100">
                      {packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          onClick={() => !mergeMode && renamingId !== pkg.id && setSelectedPackageId(pkg.id)}
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startRename(pkg);
                                  }}
                                  aria-label={`Pervadinti ${pkg.name}`}
                                  className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                                >
                                  <Pencil size={12} />
                                </button>
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
                        <Button variant="secondary" size="sm" onClick={splitSelectedRows}>
                          Padalinti pasirinktas ({selectedRowIds.size})
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
                            <TableHeadCell className="w-8" />
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
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <AlertTriangle size={13} className="shrink-0 text-gray-300" aria-hidden />
              Kol kas išsaugoma tik šiame naršyklės profilyje.
            </div>
            <Button variant="primary" size="lg" onClick={saveWorkPackages} isLoading={saving} className="w-full sm:w-auto">
              {!saving && <Save size={18} aria-hidden />}
              {savedNotice ? 'Išsaugota ✓' : 'Išsaugoti darbų paketus'}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default BoqImport;
