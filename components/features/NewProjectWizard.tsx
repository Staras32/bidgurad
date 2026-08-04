'use client';

import { useState, type ReactNode } from 'react';
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
  ShieldCheck,
  Sparkles,
  Trash2,
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
  Stepper,
  Textarea,
} from '@/components/ui';
import { uid } from '@/lib/uid';
import { cn } from '@/lib/utils/cn';
import { detectFileRows, type DetectedFileType } from '@/lib/utils/detectFileRows';

const STEPS = [
  { label: 'Project Information' },
  { label: 'Project Scope (BOQ)' },
  { label: 'Supplier Quotes' },
  { label: 'Review' },
];

type UploadStatus = 'reading' | 'success' | 'error';

interface UploadedFile {
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  fileType: DetectedFileType;
  rowCount: number | null;
  uploadedAt: number | null;
  error?: string;
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readUpload(file: File): Promise<UploadedFile> {
  const [detection] = await Promise.all([detectFileRows(file), wait(500)]);
  return {
    fileName: file.name,
    fileSize: file.size,
    status: detection.error ? 'error' : 'success',
    fileType: detection.fileType,
    rowCount: detection.rowCount,
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

type ResolvedStatus = 'ready' | 'warning';

/** Compares a successfully-read file's row count against a reference count (when one is known). */
function resolveFileStatus(upload: UploadedFile, compareRows?: number | null): ResolvedStatus {
  if (compareRows != null && upload.rowCount != null && upload.rowCount < compareRows) return 'warning';
  return 'ready';
}

function FileStatusBadge({ status }: { status: ResolvedStatus }) {
  if (status === 'warning') {
    return (
      <Badge variant="warning">
        <AlertTriangle size={11} /> Warning
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <Check size={11} /> Ready
    </Badge>
  );
}

function UploadedFileCard({
  upload,
  onRemove,
  compareRows = null,
}: {
  upload: UploadedFile;
  onRemove: () => void;
  compareRows?: number | null;
}) {
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
            Reading file…
          </div>
        </div>
      </div>
    );
  }

  if (upload.status === 'error') {
    return (
      <Alert variant="error" onClose={onRemove} className="animate-slide-in-up">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{upload.fileName}</span>
          <Badge variant="danger">Error</Badge>
        </div>
        <p className="mt-0.5">{upload.error ?? 'This file could not be read.'}</p>
      </Alert>
    );
  }

  const status = resolveFileStatus(upload, compareRows);
  const missing = status === 'warning' && compareRows != null && upload.rowCount != null ? compareRows - upload.rowCount : null;
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
            <FileStatusBadge status={status} />
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
          <span className="text-xs text-gray-500">
            {upload.rowCount !== null ? `${upload.rowCount.toLocaleString('en-US')} rows detected` : 'Rows confirmed during analysis'}
          </span>
          {upload.uploadedAt && (
            <span className="text-xs text-gray-500">Uploaded {formatUploadTime(upload.uploadedAt)}</span>
          )}
        </div>
        {missing != null && missing > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-warning-700">
            <AlertTriangle size={12} className="shrink-0" aria-hidden />
            Missing {missing} position{missing === 1 ? '' : 's'} compared to the BOQ.
          </p>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  label,
  fileName,
  rowCount,
  missing,
}: {
  label: string;
  fileName?: string;
  rowCount: number | null;
  missing: number | null;
}) {
  const isWarning = missing != null && missing > 0;
  return (
    <Card variant={isWarning ? 'warning' : 'default'} className="animate-fade-in">
      <CardContent>
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{label}</p>
          <div className="shrink-0">
            {isWarning ? (
              <Badge variant="warning">
                <AlertTriangle size={11} /> Warning
              </Badge>
            ) : (
              <Badge variant="success">
                <Check size={11} /> Ready
              </Badge>
            )}
          </div>
        </div>
        {fileName && <p className="mb-3 truncate text-xs text-gray-500">{fileName}</p>}
        <p className="text-3xl font-semibold tabular-nums leading-none text-gray-900">
          {rowCount ?? '—'} <span className="text-sm font-normal text-gray-500">positions</span>
        </p>
        {isWarning && (
          <p className="mt-3 flex items-center gap-1 text-xs font-medium text-warning-700">
            <AlertTriangle size={12} className="shrink-0" aria-hidden /> Missing {missing} position{missing === 1 ? '' : 's'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const DEMO_PROJECT_INFO: ProjectInfo = {
  name: 'Riverside Office Complex — Electrical Package',
  client: 'Riverside Development Ltd.',
  description: 'Full electrical fit-out for the 6-floor office building.',
};

const DEMO_REFERENCE_DOC: Omit<UploadedFile, 'uploadedAt'> = {
  fileName: 'reference-boq.xlsx',
  fileSize: 84_200,
  status: 'success',
  fileType: 'xlsx',
  rowCount: 184,
};

const DEMO_SUPPLIERS: Array<{ name: string; upload: Omit<UploadedFile, 'uploadedAt'> }> = [
  { name: 'Supplier A', upload: { fileName: 'supplier-a-quote.xlsx', fileSize: 79_400, status: 'success', fileType: 'xlsx', rowCount: 184 } },
  { name: 'Supplier B', upload: { fileName: 'supplier-b-quote.xlsx', fileSize: 71_800, status: 'success', fileType: 'xlsx', rowCount: 171 } },
  { name: 'Supplier C', upload: { fileName: 'supplier-c-quote.xlsx', fileSize: 82_100, status: 'success', fileType: 'xlsx', rowCount: 184 } },
];

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
  const step2Valid = referenceDoc?.status === 'success';
  const step3Valid =
    suppliers.length > 0 && suppliers.every((s) => s.name.trim().length > 0 && s.upload?.status === 'success');

  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const stepHelperText =
    step === 1 && !step1Valid
      ? 'Enter a project name and client to continue.'
      : step === 2 && !step2Valid
        ? 'Upload the BOQ to continue.'
        : step === 3 && !step3Valid
          ? 'Add a name and a file for every supplier to continue.'
          : step === 4 && (!step2Valid || !step3Valid)
            ? 'Complete the previous steps before analyzing this project.'
            : null;

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleReferenceFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setReferenceDoc({ fileName: file.name, fileSize: file.size, status: 'reading', fileType: 'unknown', rowCount: null, uploadedAt: null });
    const result = await readUpload(file);
    setReferenceDoc(result);
  };

  const handleSupplierFiles = async (supplierId: string, files: FileList) => {
    const file = files[0];
    if (!file) return;
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? { ...s, upload: { fileName: file.name, fileSize: file.size, status: 'reading', fileType: 'unknown', rowCount: null, uploadedAt: null } }
          : s
      )
    );
    const result = await readUpload(file);
    setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, upload: result } : s)));
  };

  const loadDemoProject = () => {
    const now = Date.now();
    setProjectInfo(DEMO_PROJECT_INFO);
    setReferenceDoc({ ...DEMO_REFERENCE_DOC, uploadedAt: now });
    setSuppliers(DEMO_SUPPLIERS.map((s) => ({ id: uid(), name: s.name, upload: { ...s.upload, uploadedAt: now } })));
    setStep(4);
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
  const hasMissingScope = suppliers.some((s) => {
    const rows = s.upload?.rowCount ?? null;
    return referenceRows !== null && rows !== null && rows < referenceRows;
  });

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
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="shrink-0 text-primary-600" aria-hidden />
                  <p className="text-sm text-gray-600">See how BidGuard works with a real example.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={loadDemoProject}>
                  Try Demo Project
                </Button>
              </div>
              <Card>
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
            </div>
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
                  <UploadedFileCard upload={referenceDoc} onRemove={() => setReferenceDoc(null)} />
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
                          compareRows={referenceDoc?.rowCount ?? null}
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
            <Card className="animate-fade-in">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Review</CardTitle>
                  <CardDescription>Confirm the documents before BidGuard runs the bid comparison.</CardDescription>
                </div>
                <Badge variant={hasMissingScope ? 'warning' : 'success'} className="shrink-0">
                  {hasMissingScope ? (
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
                {hasMissingScope && (
                  <Alert variant="warning" title="Missing scope detected">
                    One or more supplier quotes have fewer positions than the BOQ. Review before requesting a bid
                    comparison.
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {referenceDoc && (
                    <ReviewCard label="Reference BOQ" fileName={referenceDoc.fileName} rowCount={referenceDoc.rowCount} missing={null} />
                  )}
                  {suppliers.map((supplier) => {
                    const rows = supplier.upload?.rowCount ?? null;
                    const missing = referenceRows !== null && rows !== null ? referenceRows - rows : null;
                    return (
                      <ReviewCard
                        key={supplier.id}
                        label={supplier.name}
                        fileName={supplier.upload?.fileName}
                        rowCount={rows}
                        missing={missing}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
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
