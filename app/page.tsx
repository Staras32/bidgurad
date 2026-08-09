import type { Metadata } from 'next';
import { BoqImport } from '@/components/features/BoqImport';

export const metadata: Metadata = {
  title: 'BOQ importas – BidGuard',
  description: 'Importuokite realų Excel arba PDF darbų žiniaraštį, patikrinkite pozicijas ir suformuokite darbų paketus.',
};

export default function Home() {
  return <BoqImport />;
}
