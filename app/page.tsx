import type { Metadata } from 'next';
import { BoqImport } from '@/components/features/BoqImport';

export const metadata: Metadata = {
  title: 'Darbų žiniaraščio importas – BidGuard',
};

export default function Home() {
  return <BoqImport />;
}
