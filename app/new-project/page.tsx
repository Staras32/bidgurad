import type { Metadata } from 'next';
import { BoqImport } from '@/components/features/BoqImport';

export const metadata: Metadata = {
  title: 'Sąmatos importas',
  description: 'Importuokite Excel arba PDF statybos sąmatą, patikrinkite pozicijas ir parenkite darbų apimtį tiekėjams.',
  alternates: { canonical: '/new-project' },
};
export default function NewProjectPage() { return <BoqImport />; }
