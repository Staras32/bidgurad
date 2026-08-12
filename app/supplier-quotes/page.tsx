import type { Metadata } from 'next';
import BidGuard from '@/components/features/BidGuard';

export const metadata: Metadata = {
  title: 'Subrangovų pasiūlymai',
  robots: { index: false, follow: false },
};

export default function SupplierQuotesPage() {
  return <BidGuard />;
}
