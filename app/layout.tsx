import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'BidGuard – Subrangovų pasiūlymų rizikos analizė',
  description:
    'Sistema, kuri parodo, kuris subrangovo pasiūlymas realiai rizikingas – nepriklausomai nuo to, kuris pigiausias.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
