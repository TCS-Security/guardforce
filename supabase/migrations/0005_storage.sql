-- Storage buckets: all private; access via signed URLs from the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-docs', 'kyc-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('selfies', 'selfies', false, 2097152, array['image/jpeg', 'image/webp']),
  ('patrol-photos', 'patrol-photos', false, 4194304, array['image/jpeg', 'image/webp']),
  ('task-photos', 'task-photos', false, 4194304, array['image/jpeg', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Object paths are prefixed with the agency id: <agency_id>/<...>
create or replace function public.storage_agency_prefix(p_name text)
returns uuid language sql immutable as $$
  select nullif(split_part(p_name, '/', 1), '')::uuid
$$;

create policy "agency members read own agency objects" on storage.objects for select to authenticated
  using (public.storage_agency_prefix(name) = public.current_agency_id());
create policy "agency members upload into own agency prefix" on storage.objects for insert to authenticated
  with check (public.storage_agency_prefix(name) = public.current_agency_id());
create policy "managers update own agency objects" on storage.objects for update to authenticated
  using (public.storage_agency_prefix(name) = public.current_agency_id() and public.is_manager());
create policy "managers delete own agency objects" on storage.objects for delete to authenticated
  using (public.storage_agency_prefix(name) = public.current_agency_id() and public.is_manager());
