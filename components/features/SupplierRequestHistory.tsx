'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Copy, FileCheck2, GitCompare, Mail, RefreshCw, Send, Upload, UsersRound } from 'lucide-react';

import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FileUpload, Skeleton } from '@/components/ui';
import { compareSupplierQuote, parseSupplierQuoteFile } from '@/lib/rfq/parseSupplierQuote';
import { listProjectSupplierRequests, saveSupplierQuoteImport, updateRecipientStatus } from '@/lib/rfq/repository';
import { compareStoredScopeVersions } from '@/lib/rfq/scopeValidation';
import { personalizeSupplierEmail } from '@/lib/rfq/supplierRequest';
import type { StoredSupplierRequest, SupplierRequestRecipient, SupplierRequestRecipientStatus } from '@/lib/rfq/types';

interface SupplierRequestHistoryProps {
  projectId: string;
  refreshKey: number;
  selectedRowsCount: number;
  onCreateVersion: (request: StoredSupplierRequest) => void;
}

const statusLabels: Record<SupplierRequestRecipientStatus, string> = {
  draft: 'Juodraštis',
  sent: 'Išsiųsta',
  answered: 'Atsakyta',
};

const countLabel = (count: number, one: string, few: string, other: string) => {
  const form = new Intl.PluralRules('lt-LT').select(count);
  return `${count.toLocaleString('lt-LT')} ${form === 'one' ? one : form === 'few' ? few : other}`;
};

const displayDate = (value: string) => new Intl.DateTimeFormat('lt-LT', { dateStyle: 'medium' }).format(new Date(value));
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function isOverdue(request: StoredSupplierRequest, recipient: SupplierRequestRecipient): boolean {
  if (!request.response_deadline || recipient.status === 'answered') return false;
  return new Date(`${request.response_deadline}T23:59:59`).getTime() < Date.now();
}

function QuoteImportPanel({
  request,
  recipient,
  onImported,
}: {
  request: StoredSupplierRequest;
  recipient: SupplierRequestRecipient;
  onImported: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const imported = recipient.supplier_quote_imports?.[0] ?? null;

  const importFile = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const parsed = await parseSupplierQuoteFile(file);
      if (parsed.rows.length === 0) {
        throw new Error('Pasiūlyme nerasta eilučių su pozicijos numeriu ir darbų pavadinimu. Patikrinkite failo stulpelius.');
      }
      const comparison = compareSupplierQuote(request.supplier_request_items, parsed.rows);
      await saveSupplierQuoteImport({
        requestId: request.id,
        recipientId: recipient.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: parsed.fileType,
        parsedRows: parsed.rows,
        comparison,
      });
      onImported();
    } catch (importError) {
      setError((importError as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
      {error && <Alert variant="error" title="Pasiūlymo importas" className="mb-3">{error}</Alert>}
      {imported ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-success-700">
                <FileCheck2 size={17} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{imported.file_name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{imported.file_type.toUpperCase()} · {fileSize(imported.file_size)} · palyginta su V{request.version_number}</p>
              </div>
            </div>
            <Badge variant={imported.status === 'ready' ? 'success' : imported.status === 'warning' ? 'warning' : 'danger'}>
              {imported.status === 'ready' ? 'Apimtis sutampa' : imported.status === 'warning' ? 'Reikia patikrinti' : 'Klaida'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Padengimas</p><p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{imported.comparison.coverage.toLocaleString('lt-LT')} %</p></div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Sutapo</p><p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{imported.comparison.matchedCount}/{imported.comparison.referenceCount}</p></div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Trūksta</p><p className="mt-1 text-lg font-semibold tabular-nums text-danger-700">{imported.comparison.missingItems.length}</p></div>
            <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Kiekiai skiriasi</p><p className="mt-1 text-lg font-semibold tabular-nums text-warning-700">{imported.comparison.quantityMismatches.length}</p></div>
            <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-3 sm:col-span-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Pasiūlymo suma</p><p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{imported.comparison.quotedTotal === null ? 'Nenurodyta' : `${imported.comparison.quotedTotal.toLocaleString('lt-LT', { maximumFractionDigits: 2 })} €`}</p></div>
          </div>

          {(imported.comparison.missingItems.length > 0 || imported.comparison.quantityMismatches.length > 0 || imported.comparison.unexpectedItems.length > 0) && (
            <details className="rounded-lg border border-warning-200 bg-warning-50/50 px-3 py-2 text-xs text-gray-700">
              <summary className="cursor-pointer font-semibold text-warning-800">Rodyti apimties neatitikimus</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><p className="font-semibold text-gray-900">Trūkstamos pozicijos</p>{imported.comparison.missingItems.length === 0 ? <p className="mt-1 text-gray-500">Nėra</p> : imported.comparison.missingItems.slice(0, 8).map((item) => <p key={item.id} className="mt-1 truncate"><span className="font-mono">{item.position_number}</span> {item.name}</p>)}</div>
                <div><p className="font-semibold text-gray-900">Pakeisti kiekiai</p>{imported.comparison.quantityMismatches.length === 0 ? <p className="mt-1 text-gray-500">Nėra</p> : imported.comparison.quantityMismatches.slice(0, 8).map((item) => <p key={item.positionNumber} className="mt-1"><span className="font-mono">{item.positionNumber}</span> {item.requestedQuantity} → {item.quotedQuantity} {item.unit}</p>)}</div>
                <div><p className="font-semibold text-gray-900">Papildomos pozicijos</p>{imported.comparison.unexpectedItems.length === 0 ? <p className="mt-1 text-gray-500">Nėra</p> : imported.comparison.unexpectedItems.slice(0, 8).map((item) => <p key={item.positionNumber} className="mt-1 truncate"><span className="font-mono">{item.positionNumber}</span> {item.description}</p>)}</div>
              </div>
            </details>
          )}

          <FileUpload accept=".xlsx,.xls,.pdf" disabled={importing} onFilesSelected={importFile} label={importing ? 'Skaitomas pasiūlymas…' : 'Pakeisti pasiūlymo failą'} hint="Excel arba PDF · ankstesnis importas bus pakeistas" className="py-4" />
        </div>
      ) : (
        <FileUpload accept=".xlsx,.xls,.pdf" disabled={importing} onFilesSelected={importFile} label={importing ? 'Skaitomas ir lyginamas pasiūlymas…' : 'Vilkite tiekėjo pasiūlymą arba pasirinkite failą'} hint={`Excel arba PDF · bus lyginama tik su V${request.version_number} išsiųsta apimtimi`} className="bg-white py-5" />
      )}
    </div>
  );
}

export function SupplierRequestHistory({ projectId, refreshKey, selectedRowsCount, onCreateVersion }: SupplierRequestHistoryProps) {
  const [requests, setRequests] = useState<StoredSupplierRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingRecipientId, setChangingRecipientId] = useState<string | null>(null);
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(null);
  const [expandedRecipientId, setExpandedRecipientId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await listProjectSupplierRequests(projectId));
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void loadRequests(); }, [loadRequests, refreshKey]);

  const latestVersionByRoot = useMemo(() => {
    const map = new Map<string, number>();
    for (const request of requests) map.set(request.root_request_id, Math.max(map.get(request.root_request_id) ?? 0, request.version_number));
    return map;
  }, [requests]);

  const requestById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);

  const changeStatus = async (recipientId: string, status: SupplierRequestRecipientStatus) => {
    setChangingRecipientId(recipientId);
    setError('');
    try {
      await updateRecipientStatus(recipientId, status);
      await loadRequests();
    } catch (statusError) {
      setError((statusError as Error).message);
    } finally {
      setChangingRecipientId(null);
    }
  };

  const emailContent = (request: StoredSupplierRequest, recipient: SupplierRequestRecipient) => ({
    body: personalizeSupplierEmail(request.body, recipient.contact_name || recipient.supplier_name),
    subject: request.subject,
  });

  const gmailUrl = (request: StoredSupplierRequest, recipient: SupplierRequestRecipient) => {
    const { body, subject } = emailContent(request, recipient);
    return `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', to: recipient.email, su: subject, body }).toString()}`;
  };

  const copyEmail = async (request: StoredSupplierRequest, recipient: SupplierRequestRecipient) => {
    const { body, subject } = emailContent(request, recipient);
    try {
      await navigator.clipboard.writeText(`Kam: ${recipient.email}\nTema: ${subject}\n\n${body}`);
      setCopiedRecipientId(recipient.id);
      window.setTimeout(() => setCopiedRecipientId((current) => current === recipient.id ? null : current), 2500);
    } catch {
      setError('Nepavyko nukopijuoti laiško. Atidarykite Gmail ir nukopijuokite tekstą rankiniu būdu.');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Send size={17} className="text-primary-600" aria-hidden /> Tiekėjų užklausos ir pasiūlymai</CardTitle>
          <CardDescription>Versijos, išsiųstos apimties pakeitimai ir gautų pasiūlymų palyginimas.</CardDescription>
        </div>
        {!loading && requests.length > 0 && <Badge variant="neutral">{countLabel(requests.length, 'versija', 'versijos', 'versijų')}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="error" title="Užklausų istorija">{error}</Alert>}
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-28" /><Skeleton className="h-20" /></div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-5 py-7 text-center">
            <UsersRound size={24} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-800">Šiam projektui užklausų dar nėra</p>
            <p className="mt-1 text-xs text-gray-500">Žemiau pažymėkite sąmatos eilutes ir pasirinkite „Paruošti tiekėjo užklausą“.</p>
          </div>
        ) : requests.map((request) => {
          const parent = request.parent_request_id ? requestById.get(request.parent_request_id) : null;
          const diff = parent ? compareStoredScopeVersions(parent.supplier_request_items, request.supplier_request_items) : null;
          const isLatest = latestVersionByRoot.get(request.root_request_id) === request.version_number;
          return (
            <article key={request.id} className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex flex-col gap-3 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="info">V{request.version_number}</Badge><h4 className="truncate text-sm font-semibold text-gray-900" title={request.title}>{request.title}</h4></div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{countLabel(request.item_count, 'pozicija', 'pozicijos', 'pozicijų')}</span><span>{countLabel(request.supplier_request_recipients.length, 'tiekėjas', 'tiekėjai', 'tiekėjų')}</span><span>Sukurta {displayDate(request.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {request.response_deadline && <Badge variant="neutral"><CalendarClock size={12} aria-hidden /> Iki {displayDate(request.response_deadline)}</Badge>}
                  {isLatest && (
                    <Button variant="secondary" size="sm" onClick={() => onCreateVersion(request)} disabled={selectedRowsCount === 0} title={selectedRowsCount === 0 ? 'Pirmiausia sąmatos lentelėje pažymėkite naujos versijos eilutes' : undefined}>
                      <GitCompare size={14} aria-hidden /> Kurti V{request.version_number + 1} iš pažymėtų ({selectedRowsCount})
                    </Button>
                  )}
                </div>
              </div>

              {diff && (
                <div className="border-t border-gray-100 bg-primary-50/30 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-gray-800">Pakeitimai nuo V{parent?.version_number}</span><Badge variant={diff.added.length ? 'info' : 'neutral'}>+ {diff.added.length}</Badge><Badge variant={diff.removed.length ? 'danger' : 'neutral'}>− {diff.removed.length}</Badge><Badge variant={diff.quantityChanged.length ? 'warning' : 'neutral'}>Kiekiai {diff.quantityChanged.length}</Badge></div>
                  {(diff.added.length + diff.removed.length + diff.quantityChanged.length > 0) && (
                    <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer font-medium text-primary-700">Rodyti pakeistas pozicijas</summary><div className="mt-2 grid gap-3 sm:grid-cols-3"><div><p className="font-semibold text-gray-900">Pridėta</p>{diff.added.map((item) => <p key={item.id} className="mt-1 truncate">{item.position_number} {item.name}</p>)}</div><div><p className="font-semibold text-gray-900">Pašalinta</p>{diff.removed.map((item) => <p key={item.id} className="mt-1 truncate">{item.position_number} {item.name}</p>)}</div><div><p className="font-semibold text-gray-900">Pakeistas kiekis</p>{diff.quantityChanged.map((item) => <p key={`${item.positionNumber}-${item.name}`} className="mt-1">{item.positionNumber}: {item.previousQuantity} → {item.currentQuantity} {item.unit}</p>)}</div></div></details>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-100">
                {request.supplier_request_recipients.map((recipient) => {
                  const overdue = isOverdue(request, recipient);
                  const hasQuote = Boolean(recipient.supplier_quote_imports?.length);
                  return (
                    <div key={recipient.id}>
                      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium text-gray-900">{recipient.supplier_name}</span><Badge variant={overdue ? 'danger' : recipient.status === 'answered' ? 'success' : recipient.status === 'sent' ? 'info' : 'neutral'}>{overdue ? 'Vėluoja' : statusLabels[recipient.status]}</Badge>{hasQuote && <Badge variant="success"><FileCheck2 size={12} /> Pasiūlymas įkeltas</Badge>}</div><p className="mt-0.5 truncate text-xs text-gray-500">{recipient.contact_name ? `${recipient.contact_name} · ` : ''}{recipient.email}</p></div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={recipient.status} onChange={(event) => changeStatus(recipient.id, event.target.value as SupplierRequestRecipientStatus)} disabled={changingRecipientId === recipient.id} aria-label={`Užklausos ${recipient.supplier_name} būsena`} className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 transition hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"><option value="draft">Juodraštis</option><option value="sent">Išsiųsta</option><option value="answered">Atsakyta</option></select>
                          <Button variant="ghost" size="sm" onClick={() => copyEmail(request, recipient)}>{copiedRecipientId === recipient.id ? <Check size={14} /> : <Copy size={14} />}{copiedRecipientId === recipient.id ? 'Nukopijuota' : 'Kopijuoti'}</Button>
                          <a href={gmailUrl(request, recipient)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"><Mail size={14} /> Atidaryti Gmail</a>
                          <Button variant={hasQuote ? 'secondary' : 'primary'} size="sm" onClick={() => setExpandedRecipientId((current) => current === recipient.id ? null : recipient.id)}>{hasQuote ? <RefreshCw size={14} /> : <Upload size={14} />}{expandedRecipientId === recipient.id ? 'Uždaryti' : hasQuote ? 'Peržiūrėti pasiūlymą' : 'Įkelti pasiūlymą'}</Button>
                        </div>
                      </div>
                      {expandedRecipientId === recipient.id && <QuoteImportPanel request={request} recipient={recipient} onImported={() => void loadRequests()} />}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
