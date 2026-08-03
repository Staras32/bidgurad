import type { Metadata } from 'next';
import { NewProjectWizard } from '@/components/features/NewProjectWizard';

export const metadata: Metadata = {
  title: 'New Project – BidGuard',
};

export default function NewProjectPage() {
  return <NewProjectWizard />;
}
