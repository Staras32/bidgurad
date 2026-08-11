import type { BoqRow, WorkPackage } from '@/lib/boq/types';

export interface SupplierContact {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export type SupplierRequestRecipientStatus = 'draft' | 'sent' | 'answered';

export interface SupplierRequestRecipient {
  id: string;
  request_id: string;
  supplier_id: string | null;
  supplier_name: string;
  contact_name: string;
  email: string;
  status: SupplierRequestRecipientStatus;
  sent_at: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredSupplierRequest {
  id: string;
  project_id: string;
  title: string;
  subject: string;
  body: string;
  response_deadline: string | null;
  package_names: string[];
  item_count: number;
  created_at: string;
  updated_at: string;
  supplier_request_recipients: SupplierRequestRecipient[];
}

export interface CreateSupplierRequestInput {
  projectId: string;
  projectName: string;
  subject: string;
  body: string;
  responseDeadline: string;
  rows: BoqRow[];
  packages: WorkPackage[];
  supplierIds: string[];
}

