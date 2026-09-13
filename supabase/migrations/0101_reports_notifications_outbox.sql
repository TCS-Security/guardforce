-- Reports/settings module addition: owners need an agency-wide read-only "Outbox"
-- view of notifications (F10, /settings/notifications), not just their own. RLS
-- policies are permissive and OR together, so this only widens access — it never
-- narrows the existing per-recipient policies.

create policy notifications_select_owner on public.notifications
  for select using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

create policy notifications_update_owner on public.notifications
  for update using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));
