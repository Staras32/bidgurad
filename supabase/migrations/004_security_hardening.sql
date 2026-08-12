-- Tighten update policies so an owned child row cannot be moved under another
-- user's project, request, recipient or supplier even when an ID is known.

drop policy if exists "Users can update own supplier requests" on public.supplier_requests;
create policy "Users can update own supplier requests"
  on public.supplier_requests for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects
      where projects.id = project_id and projects.owner_id = auth.uid()
    )
    and (
      parent_request_id is null
      or exists (
        select 1 from public.supplier_requests parent
        where parent.id = parent_request_id and parent.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update own supplier request recipients" on public.supplier_request_recipients;
create policy "Users can update own supplier request recipients"
  on public.supplier_request_recipients for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.supplier_requests
      where supplier_requests.id = request_id and supplier_requests.owner_id = auth.uid()
    )
    and (
      supplier_id is null
      or exists (
        select 1 from public.suppliers
        where suppliers.id = supplier_id and suppliers.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update own supplier quote imports" on public.supplier_quote_imports;
create policy "Users can update own supplier quote imports"
  on public.supplier_quote_imports for update
  using (auth.uid() = owner_id)
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

-- Prevent unexpectedly large JSON payloads from being persisted directly.
alter table public.projects drop constraint if exists projects_payload_size_check;
alter table public.projects add constraint projects_payload_size_check
  check (pg_column_size(packages) + pg_column_size(rows) <= 20 * 1024 * 1024);

alter table public.supplier_quote_imports drop constraint if exists supplier_quote_payload_size_check;
alter table public.supplier_quote_imports add constraint supplier_quote_payload_size_check
  check (pg_column_size(parsed_rows) + pg_column_size(comparison) <= 10 * 1024 * 1024);
