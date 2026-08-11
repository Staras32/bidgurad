'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileDown, FileSpreadsheet, Mail, Plus, Trash2, UsersRound } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
  Textarea,
} from '@/components/ui';
import type { BoqRow, WorkPackage } from '@/lib/boq/types';
import { exportSupplierRequestExcel, exportSupplierRequestPdf } from '@/lib/rfq/exportSupplierRequest';
import { createStoredSupplierRequest, createSupplier, deleteSupplier, listSuppliers } from '@/lib/rfq/repository';
import { buildSupplierEmail, formatPositionCount, selectedPackageNames } from '@/lib/rfq/supplierRequest';
import type { SupplierContact } from '@/lib/rfq/types';

interface SupplierRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (requestId: string) => void;
  projectId: string | null;
  projectName: string;
  rows: BoqRow[];
  packages: WorkPackage[];
}

const emptySupplier = { name: '', contactName: '', email: '', category: '' };

export function SupplierRequestModal({
  open,
  onClose,
  onSaved,
  projectId,
  projectName,
  rows,
  packages,
}: SupplierRequestModalProps) {
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [responseDeadline, setResponseDeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState(emptySupplier);
  const [actionError, setActionError] = useState('');
  const packageNames = useMemo(() => selectedPackageNames(rows, packages), [rows, packages]);

  useEffect(() => {
    if (!open) return;
    const email = buildSupplierEmail({ projectName, supplierName: '', responseDeadline, rows, packages });
    setSubject(email.subject);
    setBody(email.body);
    setCopied(false);
    setActionError('');
  }, [open, projectName, responseDeadline, rows, packages]);

  useEffect(() => {
    if (!open || !projectId) return;
    let active = true;
    setLoadingSuppliers(true);
    listSuppliers()
      .then((contacts) => {
        if (!active) return;
        setSuppliers(contacts);
        setSelectedSupplierIds((previous) => new Set([...previous].filter((id) => contacts.some((item) => item.id === id))));
      })
      .catch((loadError: Error) => {
        if (active) setActionError(loadError.message);
      })
      .finally(() => {
        if (active) setLoadingSuppliers(false);
      });
    return () => { active = false; };
  }, [open, projectId]);

  const exportDetails = { projectName, rows, packages };

  const handleExcelExport = () => {
    try {
      setActionError('');
      exportSupplierRequestExcel(exportDetails);
    } catch {
      setActionError('Nepavyko parengti Excel failo. Bandykite dar kartą.');
    }
  };

  const handlePdfExport = () => {
    try {
      setActionError('');
      exportSupplierRequestPdf(exportDetails);
    } catch {
      setActionError('Nepavyko parengti PDF failo. Bandykite dar kartą.');
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(`Tema: ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setActionError('Nepavyko nukopijuoti laiško. Pažymėkite tekstą ir nukopijuokite jį rankiniu būdu.');
    }
  };

  const toggleSupplier = (id: string) => {
    setSelectedSupplierIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSupplier = async () => {
    if (!supplierDraft.name.trim() || !supplierDraft.email.trim()) {
      setActionError('Įrašykite tiekėjo pavadinimą ir el. paštą.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(supplierDraft.email.trim())) {
      setActionError('Patikrinkite tiekėjo el. pašto adresą.');
      return;
    }
    setAddingSupplier(true);
    setActionError('');
    try {
      const contact = await createSupplier(supplierDraft);
      setSuppliers((previous) => [...previous, contact].sort((a, b) => a.name.localeCompare(b.name, 'lt-LT')));
      setSelectedSupplierIds((previous) => new Set(previous).add(contact.id));
      setSupplierDraft(emptySupplier);
      setShowSupplierForm(false);
    } catch (createError) {
      setActionError((createError as Error).message);
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier: SupplierContact) => {
    if (!window.confirm(`Pašalinti tiekėją „${supplier.name}“ iš kontaktų?`)) return;
    setActionError('');
    try {
      await deleteSupplier(supplier.id);
      setSuppliers((previous) => previous.filter((item) => item.id !== supplier.id));
      setSelectedSupplierIds((previous) => {
        const next = new Set(previous);
        next.delete(supplier.id);
        return next;
      });
    } catch (deleteError) {
      setActionError((deleteError as Error).message);
    }
  };

  const saveRequest = async () => {
    if (!projectId) {
      setActionError('Pirmiausia išsaugokite projektą savo BidGuard paskyroje.');
      return;
    }
    if (selectedSupplierIds.size === 0) {
      setActionError('Pasirinkite bent vieną tiekėją.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setActionError('Laiško tema ir tekstas negali būti tušti.');
      return;
    }
    setSavingRequest(true);
    setActionError('');
    try {
      const requestId = await createStoredSupplierRequest({
        projectId,
        projectName,
        subject,
        body,
        responseDeadline,
        rows,
        packages,
        supplierIds: [...selectedSupplierIds],
      });
      onSaved(requestId);
      setSelectedSupplierIds(new Set());
      onClose();
    } catch (saveError) {
      setActionError((saveError as Error).message);
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-hidden">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Mail size={20} aria-hidden />
          </div>
          <div>
            <ModalTitle className="text-lg">Tiekėjų kainos pasiūlymo užklausa</ModalTitle>
            <p className="mt-0.5 text-sm text-gray-500">Viena darbų apimtis, atskira kontroliuojama užklausa kiekvienam tiekėjui.</p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[calc(100vh-13rem)] space-y-6 overflow-y-auto">
        {actionError && <Alert variant="error" title="Veiksmo atlikti nepavyko">{actionError}</Alert>}
        {!projectId && (
          <Alert variant="warning" title="Projektas dar neišsaugotas">
            Eksportus galite atsisiųsti dabar, tačiau tiekėjų kontaktams ir užklausos istorijai pirmiausia išsaugokite projektą.
          </Alert>
        )}

        <section aria-labelledby="request-scope-title" className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="request-scope-title" className="text-sm font-semibold text-gray-900">Pasirinkta darbų apimtis</h3>
              <p className="mt-1 text-sm text-gray-600">{projectName}</p>
            </div>
            <Badge variant="info">{formatPositionCount(rows.length)}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {packageNames.map((name) => <Badge key={name} variant="neutral">{name}</Badge>)}
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {rows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex gap-3 border-b border-gray-100 px-3 py-2.5 last:border-0">
                <span className="w-16 shrink-0 font-mono text-xs text-gray-500">{row.positionNumber ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-800">{row.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">{row.quantity ?? '—'} {row.unit ?? ''}</span>
              </div>
            ))}
            {rows.length > 4 && <div className="px-3 py-2 text-center text-xs font-medium text-gray-500">Ir dar {(rows.length - 4).toLocaleString('lt-LT')} pozicijų</div>}
          </div>
        </section>

        <section aria-labelledby="supplier-contacts-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="supplier-contacts-title" className="text-sm font-semibold text-gray-900">Tiekėjai</h3>
                {selectedSupplierIds.size > 0 && <Badge variant="info">Pasirinkta {selectedSupplierIds.size}</Badge>}
              </div>
              <p className="mt-1 text-xs text-gray-500">Pasirinkite visus tiekėjus, kuriems siunčiama ta pati darbų apimtis.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowSupplierForm((value) => !value)} disabled={!projectId}>
              <Plus size={15} aria-hidden /> Naujas tiekėjas
            </Button>
          </div>

          {showSupplierForm && (
            <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700">Įmonės pavadinimas *</span>
                  <Input value={supplierDraft.name} onChange={(event) => setSupplierDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Pvz., UAB Vamzdynai" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700">El. paštas *</span>
                  <Input type="email" value={supplierDraft.email} onChange={(event) => setSupplierDraft((value) => ({ ...value, email: event.target.value }))} placeholder="pasiulymai@imone.lt" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700">Kontaktinis asmuo</span>
                  <Input value={supplierDraft.contactName} onChange={(event) => setSupplierDraft((value) => ({ ...value, contactName: event.target.value }))} placeholder="Vardas Pavardė" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700">Darbų kategorija</span>
                  <Input value={supplierDraft.category} onChange={(event) => setSupplierDraft((value) => ({ ...value, category: event.target.value }))} placeholder="Pvz., vamzdynų darbai" />
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowSupplierForm(false); setSupplierDraft(emptySupplier); }}>Atšaukti</Button>
                <Button size="sm" onClick={handleCreateSupplier} isLoading={addingSupplier}>Išsaugoti tiekėją</Button>
              </div>
            </div>
          )}

          {loadingSuppliers ? (
            <div className="grid gap-2 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          ) : suppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
              <UsersRound size={24} className="mx-auto text-gray-300" aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-800">Tiekėjų kontaktų dar nėra</p>
              <p className="mt-1 text-xs text-gray-500">Pridėkite pirmą tiekėją ir jis liks jūsų kontaktų sąraše.</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {suppliers.map((supplier) => {
                const selected = selectedSupplierIds.has(supplier.id);
                return (
                  <div key={supplier.id} className={`flex items-start gap-3 rounded-xl border p-3 transition ${selected ? 'border-primary-300 bg-primary-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleSupplier(supplier.id)} aria-label={`Pasirinkti tiekėją ${supplier.name}`} className="mt-1" />
                    <button type="button" onClick={() => toggleSupplier(supplier.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-gray-900">{supplier.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">{supplier.contact_name ? `${supplier.contact_name} · ` : ''}{supplier.email}</span>
                      {supplier.category && <span className="mt-1 block truncate text-xs text-primary-600">{supplier.category}</span>}
                    </button>
                    <button type="button" onClick={() => handleDeleteSupplier(supplier)} aria-label={`Pašalinti tiekėją ${supplier.name}`} className="rounded-md p-1.5 text-gray-300 transition hover:bg-danger-50 hover:text-danger-600">
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="request-settings-title">
          <div className="mb-3">
            <h3 id="request-settings-title" className="text-sm font-semibold text-gray-900">Terminas ir priedas</h3>
            <p className="mt-1 text-xs text-gray-500">Abiejuose failuose bus tik pažymėtos sąmatos pozicijos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Pasiūlymą pateikti iki</span>
              <Input type="date" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} />
            </label>
            <button type="button" onClick={handleExcelExport} className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
              <FileSpreadsheet size={19} className="text-success-700" aria-hidden />
              <span><span className="block text-sm font-semibold text-gray-900">Excel</span><span className="block text-xs text-gray-500">Atsisiųsti priedą</span></span>
              <FileDown size={15} className="ml-auto text-gray-300 group-hover:text-primary-600" aria-hidden />
            </button>
            <button type="button" onClick={handlePdfExport} className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
              <FileDown size={19} className="text-danger-700" aria-hidden />
              <span><span className="block text-sm font-semibold text-gray-900">PDF</span><span className="block text-xs text-gray-500">Atsisiųsti priedą</span></span>
              <FileDown size={15} className="ml-auto text-gray-300 group-hover:text-primary-600" aria-hidden />
            </button>
          </div>
        </section>

        <section aria-labelledby="email-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 id="email-title" className="text-sm font-semibold text-gray-900">Laiško šablonas</h3>
              <p className="mt-1 text-xs text-gray-500">Kiekvienam pasirinktam tiekėjui bus parengtas atskiras laiškas.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyEmail}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied ? 'Nukopijuota' : 'Kopijuoti šabloną'}
            </Button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Tema</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Laiško tekstas</span>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} className="resize-none leading-relaxed" />
          </label>
        </section>
      </ModalBody>

      <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-between">
        <p className="text-xs text-gray-500">Užklausa ir pasirinktos eilutės bus išsaugotos projekto istorijoje.</p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">Uždaryti</Button>
          <Button onClick={saveRequest} isLoading={savingRequest} disabled={!projectId || selectedSupplierIds.size === 0} className="flex-1 sm:flex-none">
            {!savingRequest && <Mail size={16} aria-hidden />}
            Išsaugoti užklausą ({selectedSupplierIds.size})
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
