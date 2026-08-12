import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ShieldCheck size={15} className="text-primary-600" aria-hidden />
          <span className="font-semibold text-gray-700">BidGuard</span>
          <span>Statybos sąmatų ir tiekėjų pasiūlymų kontrolė</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Teisinė ir kontaktinė informacija">
          <Link href="/privacy" className="transition-colors hover:text-gray-900">Privatumo politika</Link>
          <Link href="/terms" className="transition-colors hover:text-gray-900">Naudojimo sąlygos</Link>
          <a href="mailto:info@bidguard.eu?subject=BidGuard%20atsiliepimas" className="transition-colors hover:text-gray-900">Parašyti atsiliepimą</a>
        </nav>
      </div>
    </footer>
  );
}
