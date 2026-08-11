'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { selectedPackageNames } from './supplierRequest';
import type {
  CreateSupplierRequestInput,
  StoredSupplierRequest,
  SupplierContact,
  SupplierRequestRecipientStatus,
} from './types';

async function authenticatedUserId(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Duomenų bazė nesukonfigūruota.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Norėdami tęsti, prisijunkite prie BidGuard.');
  return data.user.id;
}

export async function listSuppliers(): Promise<SupplierContact[]> {
  await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) throw new Error('Nepavyko įkelti tiekėjų kontaktų.');
  return (data ?? []) as SupplierContact[];
}

export async function createSupplier(input: {
  name: string;
  contactName: string;
  email: string;
  category: string;
}): Promise<SupplierContact> {
  const ownerId = await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Duomenų bazė nesukonfigūruota.');
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      owner_id: ownerId,
      name: input.name.trim(),
      contact_name: input.contactName.trim(),
      email: input.email.trim().toLowerCase(),
      category: input.category.trim(),
    })
    .select('*')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error('Tiekėjas tokiu el. paštu jau išsaugotas.');
    throw new Error('Nepavyko išsaugoti tiekėjo kontakto.');
  }
  return data as SupplierContact;
}

export async function deleteSupplier(id: string): Promise<void> {
  await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error('Nepavyko pašalinti tiekėjo kontakto.');
}

export async function createStoredSupplierRequest(input: CreateSupplierRequestInput): Promise<string> {
  await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Duomenų bazė nesukonfigūruota.');
  const packageNames = selectedPackageNames(input.rows, input.packages);
  const items = input.rows.map((row) => ({
    id: row.id,
    packageId: row.packageId,
    packageName: input.packages.find((pkg) => pkg.id === row.packageId)?.name ?? '',
    positionNumber: row.positionNumber,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    notes: row.notes,
    sourceReference: row.sourceReference,
  }));
  const title = `${input.projectName} – ${packageNames.join(', ') || 'pasirinkta darbų apimtis'}`;
  const { data, error } = await supabase.rpc('create_supplier_request', {
    p_project_id: input.projectId,
    p_title: title,
    p_subject: input.subject,
    p_body: input.body,
    p_response_deadline: input.responseDeadline || null,
    p_package_names: packageNames,
    p_items: items,
    p_supplier_ids: input.supplierIds,
  });
  if (error || !data) throw new Error('Nepavyko išsaugoti tiekėjo užklausos. Patikrinkite duomenis ir bandykite dar kartą.');
  return data as string;
}

export async function listProjectSupplierRequests(projectId: string): Promise<StoredSupplierRequest[]> {
  await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('supplier_requests')
    .select('*, supplier_request_recipients(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Nepavyko įkelti tiekėjų užklausų istorijos.');
  return (data ?? []) as StoredSupplierRequest[];
}

export async function updateRecipientStatus(
  recipientId: string,
  status: SupplierRequestRecipientStatus
): Promise<void> {
  await authenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  const timestamps = status === 'draft'
    ? { sent_at: null, answered_at: null }
    : status === 'sent'
      ? { sent_at: now, answered_at: null }
      : { sent_at: now, answered_at: now };
  const { error } = await supabase
    .from('supplier_request_recipients')
    .update({ status, ...timestamps })
    .eq('id', recipientId);
  if (error) throw new Error('Nepavyko pakeisti užklausos būsenos.');
}

