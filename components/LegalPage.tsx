import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { SiteFooter } from '@/components/SiteFooter';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalPageProps {
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
}

export function LegalPage({ title, intro, updatedAt, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900" aria-label="BidGuard pradžia">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
              <ShieldCheck size={18} aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">BidGuard</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
            <ArrowLeft size={15} aria-hidden /> Grįžti
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">BidGuard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">{title}</h1>
        <p className="mt-5 text-base leading-7 text-gray-600">{intro}</p>
        <p className="mt-3 text-xs text-gray-400">Atnaujinta: {updatedAt}</p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-gray-600">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          Klausimus dėl šios informacijos siųskite adresu{' '}
          <a href="mailto:info@bidguard.eu" className="font-medium text-primary-700 hover:text-primary-800">info@bidguard.eu</a>.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
