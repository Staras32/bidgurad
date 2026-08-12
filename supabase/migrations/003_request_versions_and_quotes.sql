alter table public.supplier_requests
  add column if not exists root_request_id uuid references public.supplier_requests(id) on delete cascade,
  add column if not exists parent_request_id uuid references public.supplier_requests(id) on delete restrict,
  add column if not exists version_number integer not null default 1 check (version_number > 0);

update public.supplier_requests
set root_request_id = id
where root_request_id is null;

alter table public.supplier_requests alter column root_request_id set not null;

create unique index if not exists supplier_requests_root_version_unique_idx
  on public.supplier_requests (root_request_id, version_number);

create table if not exists public.supplier_quote_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.supplier_requests(id) on delete cascade,
  recipient_id uuid not null references public.supplier_request_recipients(id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  file_type text not null check (file_type in ('xlsx', 'pdf')),
  parsed_rows jsonb not null default '[]'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'warning', 'error')),
  warning_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, recipient_id)
);

create index if not exists supplier_quote_imports_request_idx
  on public.supplier_quote_imports (request_id, created_at desc);

alter table public.supplier_quote_imports enable row level security;

drop policy if exists "Users can read own supplier quote imports" on public.supplier_quote_imports;
create policy "Users can read own supplier quote imports"
  on public.supplier_quote_imports for select using (auth.uid() = owner_id);
drop policy if exists "Users can create own supplier quote imports" on public.supplier_quote_imports;
create policy "Users can create own supplier quote imports"
  on public.supplier_quote_imports for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.supplier_requests
      where supplier_requests.id = request_id and supplier_requests.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.supplier_request_recipients
      where supplier_request_recipients.id = recipient_id
        and supplier_request_recipients.request_id = request_id
        and supplier_request_recipients.owner_id = auth.uid()
    )
  );
drop policy if exists "Users can update own supplier quote imports" on public.supplier_quote_imports;
create policy "Users can update own supplier quote imports"
  on public.supplier_quote_imports for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own supplier quote imports" on public.supplier_quote_imports;
create policy "Users can delete own supplier quote imports"
  on public.supplier_quote_imports for delete using (auth.uid() = owner_id);

drop trigger if exists supplier_quote_imports_set_updated_at on public.supplier_quote_imports;
create trigger supplier_quote_imports_set_updated_at
before update on public.supplier_quote_imports
for each row execute function public.set_record_updated_at();

create or replace function public.create_supplier_request_version(
  p_project_id uuid,
  p_parent_request_id uuid,
  p_title text,
  p_subject text,
  p_body text,
  p_response_deadline date,
  p_package_names jsonb,
  p_items jsonb,
  p_supplier_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_request_id uuid;
  v_root_request_id uuid;
  v_version_number integer;
  v_recipient_count integer;
begin
  if v_owner_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id and owner_id = v_owner_id) then
    raise exception 'Project not found';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one request item is required';
  end if;
  if p_supplier_ids is null or cardinality(p_supplier_ids) = 0 then
    raise exception 'At least one supplier is required';
  end if;

  select count(*) into v_recipient_count from public.suppliers
  where owner_id = v_owner_id and id = any(p_supplier_ids);
  if v_recipient_count <> cardinality(p_supplier_ids) then raise exception 'One or more suppliers are unavailable'; end if;

  if p_parent_request_id is null then
    v_request_id := gen_random_uuid();
    v_root_request_id := v_request_id;
    v_version_number := 1;
  else
    select root_request_id into v_root_request_id
    from public.supplier_requests
    where id = p_parent_request_id and project_id = p_project_id and owner_id = v_owner_id;
    if v_root_request_id is null then raise exception 'Parent request not found'; end if;
    select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.supplier_requests where root_request_id = v_root_request_id;
    v_request_id := gen_random_uuid();
  end if;

  insert into public.supplier_requests (
    id, owner_id, project_id, root_request_id, parent_request_id, version_number,
    title, subject, body, response_deadline, package_names, item_count
  ) values (
    v_request_id, v_owner_id, p_project_id, v_root_request_id, p_parent_request_id, v_version_number,
    trim(p_title), trim(p_subject), trim(p_body), p_response_deadline,
    coalesce(p_package_names, '[]'::jsonb), jsonb_array_length(p_items)
  );

  insert into public.supplier_request_items (
    owner_id, request_id, source_row_id, package_id, package_name,
    position_number, name, unit, quantity, notes, source_reference, ordinal
  )
  select v_owner_id, v_request_id, item->>'id', item->>'packageId', coalesce(item->>'packageName', ''),
    nullif(item->>'positionNumber', ''), item->>'name', nullif(item->>'unit', ''),
    nullif(item->>'quantity', '')::numeric, nullif(item->>'notes', ''),
    nullif(item->>'sourceReference', ''), (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as parsed(item, ordinality);

  insert into public.supplier_request_recipients (
    owner_id, request_id, supplier_id, supplier_name, contact_name, email
  )
  select v_owner_id, v_request_id, id, name, contact_name, email
  from public.suppliers where owner_id = v_owner_id and id = any(p_supplier_ids);

  return v_request_id;
end;
$$;

revoke all on function public.create_supplier_request_version(uuid, uuid, text, text, text, date, jsonb, jsonb, uuid[]) from public;
grant execute on function public.create_supplier_request_version(uuid, uuid, text, text, text, date, jsonb, jsonb, uuid[]) to authenticated;

