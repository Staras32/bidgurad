import type { Metadata } from 'next';
import { BoqImport } from '@/components/features/BoqImport';

export const metadata: Metadata = {
  title: 'Sąmatos importas – BidGuard',
  description: 'Importuokite realią Excel arba PDF sąmatą, patikrinkite pozicijas ir suformuokite darbų paketus.',
};

export default function Home() {
  return <BoqImport />;
}
