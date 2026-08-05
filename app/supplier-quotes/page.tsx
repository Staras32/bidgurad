import type { Metadata } from 'next';
import BidGuard from '@/components/features/BidGuard';

export const metadata: Metadata = {
  title: 'Subrangovų pasiūlymai – BidGuard',
};

export default function SupplierQuotesPage() {
  return <BidGuard />;
}
