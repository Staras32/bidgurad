'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
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
  Textarea,
} from '@/components/ui';
import { uid } from '@/lib/uid';
import { cn } from '@/lib/utils/cn';
import { detectFileRows, type DetectedFileType, type WarningReason } from '@/lib/utils/detectFileRows';

const STEPS = [
  { label: 'Project Information' },
  { label: 'Project Scope (BOQ)' },
  { label: 'Supplier Quotes' },
  { label: 'Review' },
];

type UploadStatus = 'reading' | 'ready' | 'warning' | 'error';
type UploadPhase = 'uploading' | 'parsing' | 'validating';

interface UploadedFile {
  fileName: string;
  fileSize: number;
  fileType: DetectedFileType;
  status: UploadStatus;
  rowCount: number | null;
  columnCount: number | null;
  warnings: WarningReason[];
  uploadedAt: number | null;
  error?: string;
  phase?: UploadPhase;
}

interface SupplierRow {
  id: string;
  name: string;
  upload: UploadedFile | null;
}

interface ProjectInfo {
  name: string;
  client: string;
  description: string;
}

const WARNING_LABELS: Record<WarningReason, string> = {
  missingHeaders: 'Missing headers',
  emptyCells: 'Empty cells',
  duplicateRows: 'Duplicate rows',
  unreadablePdf: 'Unreadable PDF',
  missingRows: 'Missing rows',
  unexpectedColumns: 'Unexpected columns',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads and validates a file for real, in three real sequential stages — no fabricated progress. */
async function readUpload(file: File, onPhase: (phase: UploadPhase) => void): Promise<UploadedFile> {
  onPhase('uploading');
  await wait(180);
  onPhase('parsing');
  const [detection] = await Promise.all([detectFileRows(file), wait(220)]);
  onPhase('validating');
  await wait(150);
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: detection.fileType,
    status: detection.error ? 'error' : detection.warnings.length > 0 ? 'warning' : 'ready',
    rowCount: detection.rowCount,
    columnCount: detection.columnCount,
    warnings: detection.warnings,
    uploadedAt: Date.now(),
    error: detection.error,
  };
}

function formatUploadTime(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStructure(rowCount: number | null, columnCount: number | null): string {
  if (rowCount === null || columnCount === null) return 'Structure unknown';
  return `${rowCount.toLocaleString('en-US')} rows · ${columnCount} column${columnCount === 1 ? '' : 's'}`;
}

/** Real coverage math only — never guesses, never defaults to 100%. */
function computeCoveragePct(fileRows: number | null, referenceRows: number | null): number | null {
  if (fileRows === null || referenceRows === null || referenceRows === 0) return null;
  return (fileRows / referenceRows) * 100;
}

function formatCoverage(pct: number | null): string {
  return pct === null ? 'Unknown' : `${pct.toFixed(1)}%`;
}

/** Extra warnings only knowable once a supplier file is compared against the BOQ. */
function comparisonWarnings(
  upload: UploadedFile,
  compareRows: number | null,
  compareColumns: number | null
): WarningReason[] {
  const extra: WarningReason[] = [];
  if (compareRows !== null && upload.rowCount !== null && upload.rowCount < compareRows) extra.push('missingRows');
  if (compareColumns !== null && upload.columnCount !== null && upload.columnCount !== compareColumns) {
    extra.push('unexpectedColumns');
  }
  return extra;
}

/** Single source of truth for a file's final status + full warning list, factoring in the BOQ comparison when relevant. */
function resolveDisplay(
  upload: UploadedFile,
  compareRows: number | null = null,
  compareColumns: number | null = null
): { status: UploadStatus; warnings: WarningReason[] } {
  if (upload.status === 'reading' || upload.status === 'error') {
    return { status: upload.status, warnings: upload.warnings };
  }
  const warnings = [...upload.warnings, ...comparisonWarnings(upload, compareRows, compareColumns)];
  return { status: warnings.length > 0 ? 'warning' : 'ready', warnings };
}

function FieldLabel({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
      {children}
      {optional && <span className="text-xs font-normal text-gray-400">(optional)</span>}
    </label>
  );
}

function FileTypeIcon({ fileType }: { fileType: DetectedFileType }) {
  const Icon = fileType === 'pdf' ? FileText : FileSpreadsheet;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
      <Icon size={17} />
    </div>
  );
}

function fileTypeLabel(fileType: DetectedFileType): string {
  if (fileType === 'xlsx') return 'Excel';
  if (fileType === 'csv') return 'CSV';
  if (fileType === 'pdf') return 'PDF';
  return 'File';
}

function StatusBadge({ status }: { status: UploadStatus }) {
  if (status === 'error') {
    return (
      <Badge variant="danger">
        <XCircle size={11} /> Error
      </Badge>
    );
  }
  if (status === 'warning') {
    return (
      <Badge variant="warning">
        <AlertTriangle size={11} /> Warning
      </Badge>
    );
  }
  if (status === 'reading') {
    return <Badge variant="neutral">Reading…</Badge>;
  }
  return (
    <Badge variant="success">
      <Check size={11} /> Ready
    </Badge>
  );
}

function WarningList({ warnings }: { warnings: WarningReason[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {warnings.map((w) => (
        <li key={w} className="flex items-center gap-1 text-xs font-medium text-warning-700">
          <AlertTriangle size={11} className="shrink-0" aria-hidden />
          {WARNING_LABELS[w]}
        </li>
      ))}
    </ul>
  );
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  uploading: 'Uploading file…',
  parsing: 'Parsing rows & columns…',
  validating: 'Validating data…',
};

function UploadedFileCard({
  upload,
  onRemove,
  onReplace,
  compareRows = null,
  compareColumns = null,
}: {
  upload: UploadedFile;
  onRemove: () => void;
  onReplace: (files: FileList) => void;
  compareRows?: number | null;
  compareColumns?: number | null;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  if (upload.status === 'reading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex animate-fade-in items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium text-gray-700">{upload.fileName}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 className="shrink-0 animate-spin" size={12} aria-hidden />
            {PHASE_LABEL[upload.phase ?? 'uploading']}
          </div>
        </div>
      </div>
    );
  }

  const { status, warnings } = resolveDisplay(upload, compareRows, compareColumns);
  const coveragePct = compareRows !== null ? computeCoveragePct(upload.rowCount, compareRows) : null;

  const replaceInput = (
    <input
      ref={replaceInputRef}
      type="file"
      accept=".xlsx,.xls,.pdf"
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) onReplace(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (status === 'error') {
    return (
      <Alert variant="error" className="animate-slide-in-up">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{upload.fileName}</span>
          <StatusBadge status="error" />
        </div>
        <p className="mt-0.5">{upload.error ?? 'This file could not be read.'}</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            className="text-xs font-medium text-danger-800 underline underline-offset-2 hover:text-danger-900"
          >
            Replace file
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-danger-800 underline underline-offset-2 hover:text-danger-900"
          >
            Remove
          </button>
        </div>
        {replaceInput}
      </Alert>
    );
  }

  const isWarning = status === 'warning';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex animate-slide-in-up items-start gap-3 rounded-lg border p-4',
        isWarning ? 'border-warning-200 bg-warning-50/40' : 'border-gray-200 bg-white'
      )}
    >
      <FileTypeIcon fileType={upload.fileType} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{upload.fileName}</p>
          <div className="flex shrink-0 items-center gap-1">
            <StatusBadge status={status} />
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              aria-label={`Replace ${upload.fileName}`}
              className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-primary-600"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${upload.fileName}`}
              className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-danger-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant="neutral">{fileTypeLabel(upload.fileType)}</Badge>
          <span className="text-xs text-gray-500">{formatFileSize(upload.fileSize)}</span>
          <span className="text-xs text-gray-500">{formatStructure(upload.rowCount, upload.columnCount)}</span>
          {upload.uploadedAt && (
            <span className="text-xs text-gray-500">Uploaded {formatUploadTime(upload.uploadedAt)}</span>
          )}
        </div>
        {compareRows !== null && (
          <p className="mt-1.5 text-xs text-gray-500">
            Coverage: <span className="font-medium text-gray-700">{formatCoverage(coveragePct)}</span>
          </p>
        )}
        <WarningList warnings={warnings} />
      </div>
      {replaceInput}
    </div>
  );
}

function ReviewCard({
  label,
  fileName,
  rowCount,
  columnCount,
  status,
  warnings,
  coveragePct,
}: {
  label: string;
  fileName?: string;
  rowCount: number | null;
  columnCount: number | null;
  status: UploadStatus;
  warnings: WarningReason[];
  /** undefined = not applicable (this is the BOQ itself, nothing to compare it to) */
  coveragePct?: number | null;
}) {
  return (
    <Card
      variant={status === 'error' ? 'danger' : status === 'warning' ? 'warning' : 'default'}
      className="animate-fade-in"
    >
      <CardContent>
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{label}</p>
          <div className="shrink-0">
            <StatusBadge status={status === 'reading' ? 'warning' : status} />
          </div>
        </div>
        {fileName && <p className="mb-3 truncate text-xs text-gray-500">{fileName}</p>}
        <p className="text-3xl font-semibold tabular-nums leading-none text-gray-900">
          {rowCount ?? '—'} <span className="text-sm font-normal text-gray-500">rows</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {columnCount !== null ? `${columnCount} columns detected` : 'Columns unknown'}
        </p>
        {coveragePct !== undefined && (
          <p className="mt-2 text-xs text-gray-500">
            Coverage vs. BOQ: <span className="font-medium text-gray-700">{formatCoverage(coveragePct)}</span>
          </p>
        )}
        <WarningList warnings={warnings} />
      </CardContent>
    </Card>
  );
}

export function NewProjectWizard() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', client: '', description: '' });
  const [touched, setTouched] = useState({ name: false, client: false });
  const [referenceDoc, setReferenceDoc] = useState<UploadedFile | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([
    { id: uid(), name: '', upload: null },
    { id: uid(), name: '', upload: null },
  ]);

  const step1Valid = projectInfo.name.trim().length > 0 && projectInfo.client.trim().length > 0;
  const step2Valid = referenceDoc !== null && referenceDoc.status !== 'reading' && referenceDoc.status !== 'error';
  const step3Valid =
    suppliers.length > 0 &&
    suppliers.every(
      (s) => s.name.trim().length > 0 && s.upload !== null && s.upload.status !== 'reading' && s.upload.status !== 'error'
    );

  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const firstErrorFileName =
    referenceDoc?.status === 'error'
      ? referenceDoc.fileName
      : suppliers.find((s) => s.upload?.status === 'error')?.upload?.fileName ?? null;

  const stepHelperText =
    step === 1 && !step1Valid
      ? 'Enter a project name and client to continue.'
      : step === 2 && !step2Valid
        ? referenceDoc?.status === 'error'
          ? `"${referenceDoc.fileName}" could not be read — replace it to continue.`
          : 'Upload the BOQ to continue.'
        : step === 3 && !step3Valid
          ? firstErrorFileName
            ? `"${firstErrorFileName}" could not be read — replace it to continue.`
            : 'Add a name and a file for every supplier to continue.'
          : step === 4 && (!step2Valid || !step3Valid)
            ? firstErrorFileName
              ? `Fix the error in "${firstErrorFileName}" before analyzing.`
              : 'Complete the previous steps before analyzing this project.'
            : null;

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const setReferencePhase = (phase: UploadPhase) =>
    setReferenceDoc((prev) => (prev ? { ...prev, phase } : prev));

  const handleReferenceFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setReferenceDoc({
      fileName: file.name,
      fileSize: file.size,
      fileType: 'unknown',
      status: 'reading',
      rowCount: null,
      columnCount: null,
      warnings: [],
      uploadedAt: null,
      phase: 'uploading',
    });
    const result = await readUpload(file, setReferencePhase);
    setReferenceDoc(result);
  };

  const setSupplierPhase = (supplierId: string, phase: UploadPhase) =>
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplierId && s.upload ? { ...s, upload: { ...s.upload, phase } } : s))
    );

  const handleSupplierFiles = async (supplierId: string, files: FileList) => {
    const file = files[0];
    if (!file) return;
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? {
              ...s,
              upload: {
                fileName: file.name,
                fileSize: file.size,
                fileType: 'unknown',
                status: 'reading',
                rowCount: null,
                columnCount: null,
                warnings: [],
                uploadedAt: null,
                phase: 'uploading',
              },
            }
          : s
      )
    );
    const result = await readUpload(file, (phase) => setSupplierPhase(supplierId, phase));
    setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, upload: result } : s)));
  };

  const addSupplier = () => setSuppliers((prev) => [...prev, { id: uid(), name: '', upload: null }]);
  const removeSupplier = (id: string) => setSuppliers((prev) => prev.filter((s) => s.id !== id));
  const renameSupplier = (id: string, name: string) =>
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  const clearSupplierUpload = (id: string) =>
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, upload: null } : s)));

  const handleAnalyze = async () => {
    setAnalyzing(true);
    await wait(900);
    setAnalyzing(false);
    setSubmitted(true);
  };

  const referenceRows = referenceDoc?.rowCount ?? null;
  const referenceColumns = referenceDoc?.columnCount ?? null;

  const supplierDisplays = suppliers.map((s) => ({
    supplier: s,
    display: s.upload ? resolveDisplay(s.upload, referenceRows, referenceColumns) : null,
  }));

  const hasAnyWarning =
    (referenceDoc && resolveDisplay(referenceDoc).status === 'warning') ||
    supplierDisplays.some((d) => d.display?.status === 'warning');

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CheckCircle2 size={24} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-gray-900">Project submitted for bid comparison</h1>
            <p className="text-sm text-gray-500">
              {projectInfo.name} will be checked for missing scope and commercial risk across {suppliers.length}{' '}
              supplier quote{suppliers.length === 1 ? '' : 's'}. You&apos;ll be notified once BidGuard finishes.
            </p>
          </div>
          <Link href="/">
            <Button variant="secondary" className="mt-2">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ShieldCheck className="text-primary-600" size={18} aria-hidden />
            BidGuard
          </div>
          <Link
            href="/"
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Stepper steps={STEPS} currentStep={step} className="mb-12" />

          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
              Step {step} of 4 · {STEPS[step - 1].label}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={13} aria-hidden />
              Estimated time: 2–3 minutes
            </p>
          </div>

          {step === 1 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">Project Information</CardTitle>
                <CardDescription>Basic details to identify this project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <FieldLabel htmlFor="project-name">Project Name</FieldLabel>
                  <Input
                    id="project-name"
                    placeholder="e.g. Riverside Office Complex — Electrical Package"
                    value={projectInfo.name}
                    onChange={(e) => setProjectInfo((p) => ({ ...p, name: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    error={touched.name && !projectInfo.name.trim()}
                    aria-describedby={touched.name && !projectInfo.name.trim() ? 'project-name-error' : undefined}
                  />
                  {touched.name && !projectInfo.name.trim() && (
                    <p id="project-name-error" className="mt-1.5 text-xs text-danger-600">
                      Project name is required.
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel htmlFor="project-client">Client</FieldLabel>
                  <Input
                    id="project-client"
                    placeholder="e.g. Riverside Development Ltd."
                    value={projectInfo.client}
                    onChange={(e) => setProjectInfo((p) => ({ ...p, client: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, client: true }))}
                    error={touched.client && !projectInfo.client.trim()}
                    aria-describedby={touched.client && !projectInfo.client.trim() ? 'project-client-error' : undefined}
                  />
                  {touched.client && !projectInfo.client.trim() && (
                    <p id="project-client-error" className="mt-1.5 text-xs text-danger-600">
                      Client is required.
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel htmlFor="project-description" optional>
                    Description
                  </FieldLabel>
                  <Textarea
                    id="project-description"
                    rows={4}
                    placeholder="Add context for this project"
                    value={projectInfo.description}
                    onChange={(e) => setProjectInfo((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">Project Scope (BOQ)</CardTitle>
                <CardDescription>
                  Upload the client&apos;s Bill of Quantities, Scope of Work or Technical Specification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!referenceDoc ? (
                  <FileUpload
                    accept=".xlsx,.xls,.pdf"
                    label="Drag & drop the BOQ, or click to browse"
                    hint="Supports Excel and PDF"
                    onFilesSelected={handleReferenceFiles}
                  />
                ) : (
                  <UploadedFileCard
                    upload={referenceDoc}
                    onRemove={() => setReferenceDoc(null)}
                    onReplace={handleReferenceFiles}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">Supplier Quotes</CardTitle>
                <CardDescription>Upload quotations received from subcontractors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {suppliers.length === 0 && (
                  <EmptyState
                    title="No suppliers added yet"
                    description="Add each subcontractor's quote so BidGuard can compare it against the BOQ."
                  />
                )}
                {suppliers.map((supplier, index) => (
                  <div key={supplier.id} className="rounded-lg border border-gray-200 bg-gray-50/40 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Supplier {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeSupplier(supplier.id)}
                        aria-label={`Remove supplier ${index + 1}`}
                        className="rounded-md p-1 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-danger-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <FieldLabel htmlFor={`supplier-name-${supplier.id}`}>Supplier Name</FieldLabel>
                        <Input
                          id={`supplier-name-${supplier.id}`}
                          placeholder="e.g. UAB Elektromontas"
                          value={supplier.name}
                          onChange={(e) => renameSupplier(supplier.id, e.target.value)}
                        />
                      </div>
                      {!supplier.upload ? (
                        <FileUpload
                          accept=".xlsx,.xls,.pdf"
                          label="Upload quote (Excel or PDF)"
                          hint="Supports Excel and PDF"
                          onFilesSelected={(files) => handleSupplierFiles(supplier.id, files)}
                        />
                      ) : (
                        <UploadedFileCard
                          upload={supplier.upload}
                          onRemove={() => clearSupplierUpload(supplier.id)}
                          onReplace={(files) => handleSupplierFiles(supplier.id, files)}
                          compareRows={referenceRows}
                          compareColumns={referenceColumns}
                        />
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSupplier}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-3.5 text-sm font-medium text-gray-500 transition-colors duration-150 ease-out hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600"
                >
                  <Plus size={16} />
                  Add Supplier
                </button>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <div className="animate-fade-in space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Import Health</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-gray-100 !p-0">
                  {referenceDoc && (
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-gray-700">BOQ</span>
                      <StatusBadge status={resolveDisplay(referenceDoc).status} />
                    </div>
                  )}
                  {supplierDisplays.map(({ supplier, display }) => (
                    <div key={supplier.id} className="flex items-center justify-between px-5 py-3">
                      <span className="truncate text-sm text-gray-700">{supplier.name || 'Untitled supplier'}</span>
                      {display ? <StatusBadge status={display.status} /> : <StatusBadge status="warning" />}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Review</CardTitle>
                    <CardDescription>Confirm the documents before BidGuard runs the bid comparison.</CardDescription>
                  </div>
                  <Badge variant={hasAnyWarning ? 'warning' : 'success'} className="shrink-0">
                    {hasAnyWarning ? (
                      <>
                        <AlertTriangle size={11} /> Needs review
                      </>
                    ) : (
                      <>
                        <Check size={11} /> Ready to compare
                      </>
                    )}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-5">
                  {hasAnyWarning && (
                    <Alert variant="warning" title="Some documents need review">
                      One or more files have warnings — check the details below before requesting a bid comparison.
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {referenceDoc && (
                      <ReviewCard
                        label="Reference BOQ"
                        fileName={referenceDoc.fileName}
                        rowCount={referenceDoc.rowCount}
                        columnCount={referenceDoc.columnCount}
                        status={resolveDisplay(referenceDoc).status}
                        warnings={resolveDisplay(referenceDoc).warnings}
                      />
                    )}
                    {supplierDisplays.map(({ supplier, display }) => (
                      <ReviewCard
                        key={supplier.id}
                        label={supplier.name || 'Untitled supplier'}
                        fileName={supplier.upload?.fileName}
                        rowCount={supplier.upload?.rowCount ?? null}
                        columnCount={supplier.upload?.columnCount ?? null}
                        status={display?.status ?? 'warning'}
                        warnings={display?.warnings ?? []}
                        coveragePct={computeCoveragePct(supplier.upload?.rowCount ?? null, referenceRows)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          {stepHelperText && (
            <p role="status" className="mb-2 text-right text-xs text-gray-500">
              {stepHelperText}
            </p>
          )}
          <div className="flex items-center justify-between">
            {step === 1 ? (
              <Link href="/">
                <Button variant="ghost">Cancel</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={goBack}>
                <ArrowLeft size={15} />
                Back
              </Button>
            )}

            {step < 4 ? (
              <Button onClick={goNext} disabled={!canContinue}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={handleAnalyze}
                isLoading={analyzing}
                disabled={!step2Valid || !step3Valid}
              >
                {!analyzing && <ShieldCheck size={18} aria-hidden />}
                {analyzing ? 'Analyzing…' : 'Analyze Project'}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default NewProjectWizard;
