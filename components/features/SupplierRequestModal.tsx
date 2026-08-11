'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileDown, FileSpreadsheet, Mail } from 'lucide-react';

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
  Textarea,
} from '@/components/ui';
import type { BoqRow, WorkPackage } from '@/lib/boq/types';
import { exportSupplierRequestExcel, exportSupplierRequestPdf } from '@/lib/rfq/exportSupplierRequest';
import { buildSupplierEmail, selectedPackageNames } from '@/lib/rfq/supplierRequest';

interface SupplierRequestModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  rows: BoqRow[];
  packages: WorkPackage[];
}

export function SupplierRequestModal({
  open,
  onClose,
  projectName,
  rows,
  packages,
}: SupplierRequestModalProps) {
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState('');
  const packageNames = useMemo(() => selectedPackageNames(rows, packages), [rows, packages]);

  useEffect(() => {
    if (!open) return;
    const email = buildSupplierEmail({ projectName, supplierName, responseDeadline, rows, packages });
    setSubject(email.subject);
    setBody(email.body);
    setCopied(false);
    setExportError('');
  }, [open, projectName, supplierName, responseDeadline, rows, packages]);

  const exportDetails = { projectName, rows, packages };

  const handleExcelExport = () => {
    try {
      setExportError('');
      exportSupplierRequestExcel(exportDetails);
    } catch {
      setExportError('Nepavyko parengti Excel failo. Bandykite dar kartą.');
    }
  };

  const handlePdfExport = () => {
    try {
      setExportError('');
      exportSupplierRequestPdf(exportDetails);
    } catch {
      setExportError('Nepavyko parengti PDF failo. Bandykite dar kartą.');
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(`Tema: ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setExportError('Nepavyko nukopijuoti laiško. Pažymėkite tekstą ir nukopijuokite jį rankiniu būdu.');
    }
  };

  const openEmailClient = () => {
    const recipient = supplierEmail.trim();
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-hidden">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Mail size={20} aria-hidden />
          </div>
          <div>
            <ModalTitle className="text-lg">Tiekėjo kainos pasiūlymo užklausa</ModalTitle>
            <p className="mt-0.5 text-sm text-gray-500">
              Eksportuokite pasirinktą darbų apimtį ir paruoškite laišką tiekėjui.
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[calc(100vh-13rem)] space-y-6 overflow-y-auto">
        {exportError && <Alert variant="error" title="Veiksmo atlikti nepavyko">{exportError}</Alert>}

        <section aria-labelledby="request-scope-title" className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="request-scope-title" className="text-sm font-semibold text-gray-900">Pasirinkta darbų apimtis</h3>
              <p className="mt-1 text-sm text-gray-600">{projectName}</p>
            </div>
            <Badge variant="info">{rows.length.toLocaleString('lt-LT')} pozicijų</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {packageNames.map((name) => <Badge key={name} variant="neutral">{name}</Badge>)}
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {rows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex gap-3 border-b border-gray-100 px-3 py-2.5 last:border-0">
                <span className="w-16 shrink-0 font-mono text-xs text-gray-500">{row.positionNumber ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-800">{row.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {row.quantity ?? '—'} {row.unit ?? ''}
                </span>
              </div>
            ))}
            {rows.length > 4 && (
              <div className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                Ir dar {(rows.length - 4).toLocaleString('lt-LT')} pozicijų
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="supplier-details-title">
          <div className="mb-3">
            <h3 id="supplier-details-title" className="text-sm font-semibold text-gray-900">Tiekėjas ir terminas</h3>
            <p className="mt-1 text-xs text-gray-500">Šie laukai naudojami tik laiškui paruošti.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Tiekėjo pavadinimas</span>
              <Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Pvz., UAB Rangovas" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Tiekėjo el. paštas</span>
              <Input type="email" value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} placeholder="pasiulymai@imone.lt" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Pateikti iki</span>
              <Input type="date" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} />
            </label>
          </div>
        </section>

        <section aria-labelledby="attachments-title">
          <div className="mb-3">
            <h3 id="attachments-title" className="text-sm font-semibold text-gray-900">Užklausos priedas</h3>
            <p className="mt-1 text-xs text-gray-500">Abiejuose failuose bus tik pažymėtos sąmatos pozicijos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleExcelExport}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
                <FileSpreadsheet size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">Atsisiųsti Excel</span>
                <span className="mt-0.5 block text-xs text-gray-500">Redaguojama pozicijų lentelė</span>
              </span>
              <FileDown size={16} className="ml-auto text-gray-300 transition group-hover:text-primary-600" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-700">
                <FileDown size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">Atsisiųsti PDF</span>
                <span className="mt-0.5 block text-xs text-gray-500">Siuntimui paruoštas dokumentas</span>
              </span>
              <FileDown size={16} className="ml-auto text-gray-300 transition group-hover:text-primary-600" aria-hidden />
            </button>
          </div>
        </section>

        <section aria-labelledby="email-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 id="email-title" className="text-sm font-semibold text-gray-900">Laiškas tiekėjui</h3>
              <p className="mt-1 text-xs text-gray-500">Prieš siųsdami galite pakeisti temą ir tekstą.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={copyEmail}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied ? 'Nukopijuota' : 'Kopijuoti laišką'}
            </Button>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Tema</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Laiško tekstas</span>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={13} className="resize-none leading-relaxed" />
          </label>
        </section>
      </ModalBody>

      <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-between">
        <p className="text-xs text-gray-500">Prie laiško pridėkite atsisiųstą Excel arba PDF failą.</p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">Uždaryti</Button>
          <Button onClick={openEmailClient} className="flex-1 sm:flex-none">
            <Mail size={16} aria-hidden /> Atidaryti el. paštą
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

