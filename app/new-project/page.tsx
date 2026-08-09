import type { Metadata } from 'next';
import { BoqImport } from '@/components/features/BoqImport';

export const metadata: Metadata = { title: 'Naujas projektas – BidGuard' };
export default function NewProjectPage() { return <BoqImport />; }
