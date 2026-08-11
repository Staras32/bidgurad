create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  contact_name text not null default '' check (char_length(contact_name) <= 160),
  email text not null check (char_length(trim(email)) between 3 and 320),
  category text not null default '' check (char_length(category) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_owner_email_unique_idx
  on public.suppliers (owner_id, lower(trim(email)));
create index if not exists suppliers_owner_name_idx
  on public.suppliers (owner_id, name);

create table if not exists public.supplier_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  subject text not null check (char_length(trim(subject)) between 1 and 500),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  response_deadline date,
  package_names jsonb not null default '[]'::jsonb,
  item_count integer not null check (item_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_requests_project_created_idx
  on public.supplier_requests (project_id, created_at desc);
create index if not exists supplier_requests_owner_created_idx
  on public.supplier_requests (owner_id, created_at desc);

create table if not exists public.supplier_request_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.supplier_requests(id) on delete cascade,
  source_row_id text not null,
  package_id text not null,
  package_name text not null default '',
  position_number text,
  name text not null,
  unit text,
  quantity numeric,
  notes text,
  source_reference text,
  ordinal integer not null check (ordinal >= 0)
);

create index if not exists supplier_request_items_request_idx
  on public.supplier_request_items (request_id, ordinal);

create table if not exists public.supplier_request_recipients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.supplier_requests(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,
  contact_name text not null default '',
  email text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'answered')),
  sent_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, supplier_id)
);

create index if not exists supplier_request_recipients_request_idx
  on public.supplier_request_recipients (request_id, created_at);
create index if not exists supplier_request_recipients_owner_status_idx
  on public.supplier_request_recipients (owner_id, status);

alter table public.suppliers enable row level security;
alter table public.supplier_requests enable row level security;
alter table public.supplier_request_items enable row level security;
alter table public.supplier_request_recipients enable row level security;

drop policy if exists "Users can read own suppliers" on public.suppliers;
create policy "Users can read own suppliers"
  on public.suppliers for select using (auth.uid() = owner_id);
drop policy if exists "Users can create own suppliers" on public.suppliers;
create policy "Users can create own suppliers"
  on public.suppliers for insert with check (auth.uid() = owner_id);
drop policy if exists "Users can update own suppliers" on public.suppliers;
create policy "Users can update own suppliers"
  on public.suppliers for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own suppliers" on public.suppliers;
create policy "Users can delete own suppliers"
  on public.suppliers for delete using (auth.uid() = owner_id);

drop policy if exists "Users can read own supplier requests" on public.supplier_requests;
create policy "Users can read own supplier requests"
  on public.supplier_requests for select using (auth.uid() = owner_id);
drop policy if exists "Users can create own supplier requests" on public.supplier_requests;
create policy "Users can create own supplier requests"
  on public.supplier_requests for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_id and projects.owner_id = auth.uid()
    )
  );
drop policy if exists "Users can update own supplier requests" on public.supplier_requests;
create policy "Users can update own supplier requests"
  on public.supplier_requests for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own supplier requests" on public.supplier_requests;
create policy "Users can delete own supplier requests"
  on public.supplier_requests for delete using (auth.uid() = owner_id);

drop policy if exists "Users can read own supplier request items" on public.supplier_request_items;
create policy "Users can read own supplier request items"
  on public.supplier_request_items for select using (auth.uid() = owner_id);
drop policy if exists "Users can create own supplier request items" on public.supplier_request_items;
create policy "Users can create own supplier request items"
  on public.supplier_request_items for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.supplier_requests
      where supplier_requests.id = request_id and supplier_requests.owner_id = auth.uid()
    )
  );
drop policy if exists "Users can delete own supplier request items" on public.supplier_request_items;
create policy "Users can delete own supplier request items"
  on public.supplier_request_items for delete using (auth.uid() = owner_id);

drop policy if exists "Users can read own supplier request recipients" on public.supplier_request_recipients;
create policy "Users can read own supplier request recipients"
  on public.supplier_request_recipients for select using (auth.uid() = owner_id);
drop policy if exists "Users can create own supplier request recipients" on public.supplier_request_recipients;
create policy "Users can create own supplier request recipients"
  on public.supplier_request_recipients for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.supplier_requests
      where supplier_requests.id = request_id and supplier_requests.owner_id = auth.uid()
    )
  );
drop policy if exists "Users can update own supplier request recipients" on public.supplier_request_recipients;
create policy "Users can update own supplier request recipients"
  on public.supplier_request_recipients for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own supplier request recipients" on public.supplier_request_recipients;
create policy "Users can delete own supplier request recipients"
  on public.supplier_request_recipients for delete using (auth.uid() = owner_id);

create or replace function public.set_record_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_record_updated_at();

drop trigger if exists supplier_requests_set_updated_at on public.supplier_requests;
create trigger supplier_requests_set_updated_at
before update on public.supplier_requests
for each row execute function public.set_record_updated_at();

drop trigger if exists supplier_request_recipients_set_updated_at on public.supplier_request_recipients;
create trigger supplier_request_recipients_set_updated_at
before update on public.supplier_request_recipients
for each row execute function public.set_record_updated_at();

create or replace function public.create_supplier_request(
  p_project_id uuid,
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
  v_recipient_count integer;
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = v_owner_id
  ) then
    raise exception 'Project not found';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one request item is required';
  end if;

  if p_supplier_ids is null or cardinality(p_supplier_ids) = 0 then
    raise exception 'At least one supplier is required';
  end if;

  select count(*) into v_recipient_count
  from public.suppliers
  where owner_id = v_owner_id and id = any(p_supplier_ids);

  if v_recipient_count <> cardinality(p_supplier_ids) then
    raise exception 'One or more suppliers are unavailable';
  end if;

  insert into public.supplier_requests (
    owner_id, project_id, title, subject, body, response_deadline, package_names, item_count
  ) values (
    v_owner_id,
    p_project_id,
    trim(p_title),
    trim(p_subject),
    trim(p_body),
    p_response_deadline,
    coalesce(p_package_names, '[]'::jsonb),
    jsonb_array_length(p_items)
  ) returning id into v_request_id;

  insert into public.supplier_request_items (
    owner_id, request_id, source_row_id, package_id, package_name,
    position_number, name, unit, quantity, notes, source_reference, ordinal
  )
  select
    v_owner_id,
    v_request_id,
    item->>'id',
    item->>'packageId',
    coalesce(item->>'packageName', ''),
    nullif(item->>'positionNumber', ''),
    item->>'name',
    nullif(item->>'unit', ''),
    nullif(item->>'quantity', '')::numeric,
    nullif(item->>'notes', ''),
    nullif(item->>'sourceReference', ''),
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as parsed(item, ordinality);

  insert into public.supplier_request_recipients (
    owner_id, request_id, supplier_id, supplier_name, contact_name, email
  )
  select v_owner_id, v_request_id, id, name, contact_name, email
  from public.suppliers
  where owner_id = v_owner_id and id = any(p_supplier_ids);

  return v_request_id;
end;
$$;

revoke all on function public.create_supplier_request(uuid, text, text, text, date, jsonb, jsonb, uuid[]) from public;
grant execute on function public.create_supplier_request(uuid, text, text, text, date, jsonb, jsonb, uuid[]) to authenticated;

