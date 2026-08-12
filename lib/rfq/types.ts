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
  supplier_quote_imports?: SupplierQuoteImport[];
}

export interface SupplierRequestItem {
  id: string;
  request_id: string;
  source_row_id: string;
  package_id: string;
  package_name: string;
  position_number: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  notes: string | null;
  source_reference: string | null;
  ordinal: number;
}

export interface SupplierQuoteRow {
  positionNumber: string;
  description: string;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface SupplierQuoteComparison {
  referenceCount: number;
  detectedCount: number;
  matchedCount: number;
  coverage: number;
  missingItems: SupplierRequestItem[];
  unexpectedItems: SupplierQuoteRow[];
  quantityMismatches: Array<{
    positionNumber: string;
    description: string;
    requestedQuantity: number | null;
    quotedQuantity: number | null;
    unit: string | null;
  }>;
  quotedTotal: number | null;
}

export interface SupplierQuoteImport {
  id: string;
  request_id: string;
  recipient_id: string;
  file_name: string;
  file_size: number;
  file_type: 'xlsx' | 'pdf';
  parsed_rows: SupplierQuoteRow[];
  comparison: SupplierQuoteComparison;
  status: 'ready' | 'warning' | 'error';
  warning_message: string | null;
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
  root_request_id: string;
  parent_request_id: string | null;
  version_number: number;
  created_at: string;
  updated_at: string;
  supplier_request_recipients: SupplierRequestRecipient[];
  supplier_request_items: SupplierRequestItem[];
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
  parentRequestId?: string | null;
}
