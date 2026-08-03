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
  title: 'BidGuard – Subrangovų pasiūlymų rizikos analizė',
  description:
    'Sistema, kuri parodo, kuris subrangovo pasiūlymas realiai rizikingas – nepriklausomai nuo to, kuris pigiausias.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lt" className={inter.variable}>
      <body className="font-sans text-gray-900 bg-background antialiased">{children}</body>
    </html>
  );
}
