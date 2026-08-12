import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bidguard.eu'),
  title: {
    default: 'BidGuard – statybos sąmatų ir tiekėjų pasiūlymų valdymas',
    template: '%s – BidGuard',
  },
  description:
    'Importuokite statybos sąmatas, parenkite darbų apimtį tiekėjams ir palyginkite gautus pasiūlymus.',
  applicationName: 'BidGuard',
  keywords: [
    'statybos sąmata',
    'sąmatų analizė',
    'darbų kiekių žiniaraštis',
    'tiekėjų pasiūlymų palyginimas',
    'užklausa subrangovams',
    'statybos projektų valdymas',
  ],
  authors: [{ name: 'BidGuard' }],
  creator: 'BidGuard',
  publisher: 'BidGuard',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'lt_LT',
    url: '/',
    siteName: 'BidGuard',
    title: 'BidGuard – statybos sąmatų ir tiekėjų pasiūlymų valdymas',
    description: 'Nuo Excel ar PDF sąmatos iki kontroliuojamos tiekėjo užklausos ir palyginto pasiūlymo.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BidGuard – statybos sąmatų ir tiekėjų pasiūlymų valdymas',
    description: 'Nuo Excel ar PDF sąmatos iki kontroliuojamos tiekėjo užklausos ir palyginto pasiūlymo.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lt" className={inter.variable}>
      <body className="font-sans text-gray-900 bg-background antialiased">{children}</body>
    </html>
  );
}
