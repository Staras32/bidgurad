'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, Copy, Mail, Send, UsersRound } from 'lucide-react';

import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { listProjectSupplierRequests, updateRecipientStatus } from '@/lib/rfq/repository';
import { personalizeSupplierEmail } from '@/lib/rfq/supplierRequest';
import type { StoredSupplierRequest, SupplierRequestRecipient, SupplierRequestRecipientStatus } from '@/lib/rfq/types';

interface SupplierRequestHistoryProps {
  projectId: string;
  refreshKey: number;
}

const statusLabels: Record<SupplierRequestRecipientStatus, string> = {
  draft: 'Juodraštis',
  sent: 'Išsiųsta',
  answered: 'Atsakyta',
};

function isOverdue(request: StoredSupplierRequest, recipient: SupplierRequestRecipient): boolean {
  if (!request.response_deadline || recipient.status === 'answered') return false;
  return new Date(`${request.response_deadline}T23:59:59`).getTime() < Date.now();
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('lt-LT', { dateStyle: 'medium' }).format(new Date(value));
}

function countLabel(count: number, one: string, few: string, other: string): string {
  const form = new Intl.PluralRules('lt-LT').select(count);
  const word = form === 'one' ? one : form === 'few' ? few : other;
  return `${count.toLocaleString('lt-LT')} ${word}`;
}

export function SupplierRequestHistory({ projectId, refreshKey }: SupplierRequestHistoryProps) {
  const [requests, setRequests] = useState<StoredSupplierRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingRecipientId, setChangingRecipientId] = useState<string | null>(null);
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listProjectSupplierRequests(projectId)
      .then((items) => {
        if (active) setRequests(items);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [projectId, refreshKey]);

  const changeStatus = async (recipientId: string, status: SupplierRequestRecipientStatus) => {
    setChangingRecipientId(recipientId);
    setError('');
    try {
      await updateRecipientStatus(recipientId, status);
      const now = new Date().toISOString();
      setRequests((previous) => previous.map((request) => ({
        ...request,
        supplier_request_recipients: request.supplier_request_recipients.map((recipient) => (
          recipient.id === recipientId
            ? {
                ...recipient,
                status,
                sent_at: status === 'draft' ? null : now,
                answered_at: status === 'answered' ? now : null,
              }
            : recipient
        )),
      })));
    } catch (statusError) {
      setError((statusError as Error).message);
    } finally {
      setChangingRecipientId(null);
    }
  };

  const emailContent = (request: StoredSupplierRequest, recipient: SupplierRequestRecipient) => {
    const greetingName = recipient.contact_name || recipient.supplier_name;
    const body = personalizeSupplierEmail(request.body, greetingName);
    return { body, subject: request.subject };
  };

  const gmailUrl = (request: StoredSupplierRequest, recipient: SupplierRequestRecipient): string => {
    const { body, subject } = emailContent(request, recipient);
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: recipient.email,
      su: subject,
      body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  };

  const copyEmail = async (request: StoredSupplierRequest, recipient: SupplierRequestRecipient) => {
    const { body, subject } = emailContent(request, recipient);
    try {
      await navigator.clipboard.writeText(`Kam: ${recipient.email}\nTema: ${subject}\n\n${body}`);
      setCopiedRecipientId(recipient.id);
      window.setTimeout(() => setCopiedRecipientId((current) => (current === recipient.id ? null : current)), 2500);
    } catch {
      setError('Nepavyko nukopijuoti laiško. Atidarykite Gmail ir nukopijuokite tekstą rankiniu būdu.');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Send size={17} className="text-primary-600" aria-hidden /> Tiekėjų užklausos</CardTitle>
          <CardDescription>Išsaugota darbų apimtis ir atskira būsena kiekvienam gavėjui.</CardDescription>
        </div>
        {!loading && requests.length > 0 && (
          <Badge variant="neutral">{countLabel(requests.length, 'užklausa', 'užklausos', 'užklausų')}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="error" title="Užklausų istorija">{error}</Alert>}
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-28" /><Skeleton className="h-20" /></div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-5 py-7 text-center">
            <UsersRound size={24} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-800">Šiam projektui užklausų dar nėra</p>
            <p className="mt-1 text-xs text-gray-500">Pažymėkite sąmatos pozicijas ir pasirinkite „Paruošti tiekėjo užklausą“.</p>
          </div>
        ) : (
          requests.map((request) => (
            <article key={request.id} className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex flex-col gap-3 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-gray-900" title={request.title}>{request.title}</h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{countLabel(request.item_count, 'pozicija', 'pozicijos', 'pozicijų')}</span>
                    <span>{countLabel(request.supplier_request_recipients.length, 'tiekėjas', 'tiekėjai', 'tiekėjų')}</span>
                    <span>Sukurta {displayDate(request.created_at)}</span>
                  </div>
                </div>
                {request.response_deadline && (
                  <Badge variant="neutral" className="shrink-0"><CalendarClock size={12} aria-hidden /> Iki {displayDate(request.response_deadline)}</Badge>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {request.supplier_request_recipients.map((recipient) => {
                  const overdue = isOverdue(request, recipient);
                  return (
                    <div key={recipient.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-gray-900">{recipient.supplier_name}</span>
                          <Badge variant={overdue ? 'danger' : recipient.status === 'answered' ? 'success' : recipient.status === 'sent' ? 'info' : 'neutral'}>
                            {overdue ? 'Vėluoja' : statusLabels[recipient.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{recipient.contact_name ? `${recipient.contact_name} · ` : ''}{recipient.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={recipient.status}
                          onChange={(event) => changeStatus(recipient.id, event.target.value as SupplierRequestRecipientStatus)}
                          disabled={changingRecipientId === recipient.id}
                          aria-label={`Užklausos ${recipient.supplier_name} būsena`}
                          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 transition hover:border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
                        >
                          <option value="draft">Juodraštis</option>
                          <option value="sent">Išsiųsta</option>
                          <option value="answered">Atsakyta</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyEmail(request, recipient)}
                          aria-label={`Kopijuoti laišką tiekėjui ${recipient.supplier_name}`}
                        >
                          {copiedRecipientId === recipient.id ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                          {copiedRecipientId === recipient.id ? 'Nukopijuota' : 'Kopijuoti'}
                        </Button>
                        <a
                          href={gmailUrl(request, recipient)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1"
                        >
                          <Mail size={14} aria-hidden /> Atidaryti Gmail
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
