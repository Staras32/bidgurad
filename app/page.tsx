import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  GitCompare,
  Layers3,
  MailCheck,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';

import { Badge, Card, CardContent } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Statybos sąmatų ir tiekėjų pasiūlymų valdymas',
  description:
    'Importuokite statybos sąmatą, parenkite darbų apimtį tiekėjams ir palyginkite gautus pasiūlymus vienoje BidGuard darbo erdvėje.',
  alternates: { canonical: '/' },
};

const primaryLink = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:border-primary-700 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2';
const secondaryLink = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2';

const workflow = [
  {
    number: '01',
    icon: UploadCloud,
    title: 'Importuokite sąmatą',
    description: 'Įkelkite Excel arba PDF sąmatą. BidGuard atskirs darbų pozicijas nuo dokumento antraščių ir suvestinių.',
  },
  {
    number: '02',
    icon: Layers3,
    title: 'Parenkite darbų apimtį',
    description: 'Patikrinkite pozicijas, sutvarkykite darbų grupes ir pasirinkite tik tas eilutes, kurias reikia perduoti tiekėjui.',
  },
  {
    number: '03',
    icon: MailCheck,
    title: 'Išsiųskite kontroliuojamą užklausą',
    description: 'Atsisiųskite Excel arba PDF priedą, parenkite laišką ir išsaugokite kiekvienos užklausos versiją.',
  },
  {
    number: '04',
    icon: GitCompare,
    title: 'Palyginkite gautą pasiūlymą',
    description: 'Įkelkite tiekėjo pasiūlymą ir patikrinkite, ar jame netrūksta išsiųstos apimties pozicijų bei kiekių.',
  },
];

const faq = [
  {
    question: 'Kokius sąmatų failus palaiko BidGuard?',
    answer: 'Galite importuoti Excel (.xlsx, .xls) ir PDF dokumentus. Prieš tęsiant visos aptiktos pozicijos parodomos patikrai.',
  },
  {
    question: 'Ar galima pasirinkti tik dalį sąmatos?',
    answer: 'Taip. Galite pasirinkti visą darbų grupę arba tik konkrečias pozicijas, kurios bus įtrauktos į tiekėjo užklausą.',
  },
  {
    question: 'Kaip kontroliuojami pasikeitę kiekiai?',
    answer: 'Kiekviena nauja užklausos versija parodo pridėtas, pašalintas ir pakeisto kiekio pozicijas, pavyzdžiui, V1 ir V2.',
  },
];

export default function Home() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'BidGuard',
      url: 'https://www.bidguard.eu',
      logo: 'https://www.bidguard.eu/icon.svg',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'BidGuard',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://www.bidguard.eu',
      description: 'Statybos sąmatų, tiekėjų užklausų ir gautų pasiūlymų valdymo sistema.',
      featureList: [
        'Excel ir PDF sąmatų importas',
        'Darbų apimties parengimas',
        'Tiekėjų užklausų versijos',
        'Tiekėjų pasiūlymų apimties palyginimas',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900" aria-label="BidGuard pradžia">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm"><ShieldCheck size={18} aria-hidden /></span>
            <span className="text-base font-semibold tracking-tight">BidGuard</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Pagrindinė navigacija">
            <Link href="/auth" className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 sm:inline-flex">Prisijungti</Link>
            <Link href="/new-project" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">Išbandyti <ArrowRight size={15} aria-hidden /></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-gray-100 bg-gray-50">
          <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.12),transparent_62%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:py-28">
            <div>
              <Badge variant="info" className="px-3 py-1">Statybos projektų komandoms</Badge>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-gray-950 sm:text-5xl lg:text-[58px]">
                Sąmata, darbų apimtis ir tiekėjų pasiūlymai — vienoje vietoje.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
                BidGuard padeda statybų projektų vadovams iš Excel ar PDF sąmatos parengti tikslią užklausą tiekėjams ir patikrinti, ar gautame pasiūlyme nieko netrūksta.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/new-project" className={primaryLink}>Išbandyti su savo sąmata <ArrowRight size={17} aria-hidden /></Link>
                <Link href="/auth" className={secondaryLink}>Prisijungti prie projektų</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-gray-500">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" /> Excel ir PDF</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" /> Apimties patikra</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success-600" /> Versijų kontrolė</span>
              </div>
            </div>

            <div className="relative lg:pl-5" aria-label="BidGuard darbo eigos pavyzdys">
              <div className="absolute -inset-6 rounded-[2rem] bg-primary-100/40 blur-3xl" aria-hidden />
              <Card className="relative overflow-hidden rounded-2xl border-gray-200 shadow-lg shadow-gray-900/[0.08]">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><FileSpreadsheet size={18} aria-hidden /></span>
                    <div><p className="text-sm font-semibold text-gray-900">Sembos gatvės remontas</p><p className="text-xs text-gray-500">Sąmatos darbų apimtis</p></div>
                  </div>
                  <Badge variant="success">Paruošta</Badge>
                </div>
                <CardContent className="p-5 sm:p-6">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Pozicijos</p><p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">184</p></div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Grupės</p><p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">12</p></div>
                    <div className="rounded-lg border border-success-200 bg-success-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-success-700">Patikra</p><p className="mt-1 text-sm font-semibold text-success-800">Be klaidų</p></div>
                  </div>
                  <div className="mt-5 space-y-2">
                    {[
                      ['2.1', 'Tranšėjų kasimas', '620 m³'],
                      ['2.2', 'Smėlio pagrindo įrengimas', '184 m³'],
                      ['2.3', 'Vamzdyno klojimas', '420 m'],
                    ].map(([number, name, quantity]) => (
                      <div key={number} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-lg border border-gray-100 px-3 py-3 text-xs">
                        <span className="font-mono text-gray-400">{number}</span><span className="truncate font-medium text-gray-800">{name}</span><span className="tabular-nums text-gray-500">{quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
                    <div><p className="text-xs font-semibold text-primary-900">Tiekėjo užklausa V2</p><p className="mt-0.5 text-[11px] text-primary-700">+2 pridėta · 1 pakeistas kiekis</p></div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-primary-600 shadow-sm"><ArrowRight size={16} aria-hidden /></span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="workflow-title">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">Aiški darbo eiga</p>
            <h2 id="workflow-title" className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">Nuo užsakovo sąmatos iki palyginto pasiūlymo</h2>
            <p className="mt-4 text-base leading-7 text-gray-600">Mažiau kopijavimo tarp failų, aiškesnė išsiųsta apimtis ir patikrinamas kiekvieno tiekėjo atsakymas.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.number} className="relative overflow-hidden shadow-none">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Icon size={19} aria-hidden /></span><span className="font-mono text-xs text-gray-300">{item.number}</span></div>
                    <h3 className="mt-6 text-base font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">Kontroliuojama apimtis</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">Prieš išsiunčiant — konkreti patikra, ne spėjimas.</h2>
              <p className="mt-4 text-base leading-7 text-gray-600">BidGuard sustabdo eksportą, jei pasirinktoje pozicijoje nėra numerio, mato vieneto ar kiekio. Naujoje užklausos versijoje matysite, kas tiksliai pasikeitė.</p>
              <ul className="mt-7 space-y-3 text-sm text-gray-700">
                {['Trūkstamų laukų patikra prieš Excel ir PDF eksportą', 'Pridėtų, pašalintų ir pakeistų pozicijų istorija', 'Pasiūlymo palyginimas tik su išsiųsta užklausos versija'].map((text) => <li key={text} className="flex gap-2.5"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success-600" aria-hidden /><span>{text}</span></li>)}
              </ul>
            </div>
            <Card className="overflow-hidden rounded-2xl shadow-md">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div className="flex items-center gap-2"><GitCompare size={17} className="text-primary-600" /><span className="text-sm font-semibold text-gray-900">Užklausos pakeitimai</span></div><Badge variant="info">V1 → V2</Badge></div>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50 px-4 py-3"><span className="text-sm font-medium text-success-900">Pridėtos pozicijos</span><Badge variant="success">+ 3</Badge></div>
                <div className="flex items-center justify-between rounded-lg border border-danger-200 bg-danger-50 px-4 py-3"><span className="text-sm font-medium text-danger-900">Pašalintos pozicijos</span><Badge variant="danger">− 1</Badge></div>
                <div className="flex items-center justify-between rounded-lg border border-warning-200 bg-warning-50 px-4 py-3"><span className="text-sm font-medium text-warning-900">Pakeisti kiekiai</span><Badge variant="warning">2</Badge></div>
                <div className="mt-2 rounded-lg border border-gray-200 p-4"><div className="flex items-center gap-3"><FileCheck2 size={18} className="text-success-600" /><div><p className="text-sm font-semibold text-gray-900">Tiekėjo pasiūlymas palygintas</p><p className="mt-0.5 text-xs text-gray-500">181 iš 184 pozicijų · 98,4 % apimties</p></div></div></div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="faq-title">
          <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">Dažniausi klausimai</p><h2 id="faq-title" className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">Pradėkite nuo turimos sąmatos</h2></div>
          <div className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
            {faq.map((item) => <div key={item.question} className="py-6"><h3 className="text-base font-semibold text-gray-900">{item.question}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{item.answer}</p></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-24">
          <div className="overflow-hidden rounded-2xl bg-gray-950 px-6 py-12 text-center sm:px-12 sm:py-16">
            <ShieldCheck size={30} className="mx-auto text-primary-400" aria-hidden />
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white">Parenkite pirmą tiekėjo užklausą iš realios sąmatos.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-300">Įkelkite Excel arba PDF failą, patikrinkite aptiktas pozicijas ir pasirinkite siunčiamą darbų apimtį.</p>
            <Link href="/new-project" className={`${primaryLink} mt-7`}>Pradėti sąmatos importą <ArrowRight size={17} aria-hidden /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-primary-600" /><span className="font-semibold text-gray-700">BidGuard</span><span>Statybos sąmatų ir tiekėjų pasiūlymų kontrolė</span></div>
          <div className="flex gap-5"><Link href="/new-project" className="hover:text-gray-900">Sąmatos importas</Link><Link href="/auth" className="hover:text-gray-900">Prisijungti</Link></div>
        </div>
      </footer>
    </div>
  );
}
