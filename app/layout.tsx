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
  title: 'BidGuard – konkursinių sąmatų ir pasiūlymų rizikos valdymas',
  description:
    'Išmani BOQ analizė, konkursinių sąmatų valdymas ir subrangovų pasiūlymų rizikos kontrolė.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="lt" className={inter.variable}>
      <body className="font-sans text-gray-900 bg-background antialiased">{children}</body>
    </html>
  );
}
