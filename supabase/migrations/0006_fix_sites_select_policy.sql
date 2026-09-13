-- The sites SELECT policy tested membership of `accessible_site_ids()`, a STABLE
-- function that reads public.sites. Inside an INSERT ... RETURNING the function runs
-- against the statement snapshot, so the row being inserted is invisible to it and the
-- RETURNING clause fails with "new row violates row-level security policy".
-- Evaluating the same rule against the candidate row fixes that (and is cheaper).
drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites for select using (
  agency_id = public.current_agency_id()
  and (
    public.current_role() in ('owner', 'admin')
    or exists (select 1 from public.supervisor_sites ss where ss.site_id = sites.id and ss.profile_id = auth.uid())
    or exists (select 1 from public.guards g where g.profile_id = auth.uid() and g.site_id = sites.id)
  )
);
