-- tasks_select tested membership of task_assignments while task_assignments_select
-- tested the parent task's site, so evaluating either policy re-entered the other and
-- Postgres aborted with "infinite recursion detected in policy for relation tasks".
-- Every task was therefore invisible to every role.
--
-- Both directions now go through SECURITY DEFINER helpers, which are not themselves
-- row-level-secured, so the cycle is broken while the rules stay identical.

create or replace function public.guard_is_assigned_to_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.task_assignments ta
    where ta.task_id = p_task_id and ta.guard_id = public.current_guard_id()
  )
$$;

create or replace function public.task_site_id(p_task_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select site_id from public.tasks where id = p_task_id
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  site_id in (select public.accessible_site_ids())
  or public.guard_is_assigned_to_task(id)
);

drop policy if exists task_assignments_select on public.task_assignments;
create policy task_assignments_select on public.task_assignments for select using (
  agency_id = public.current_agency_id()
  and (
    guard_id = public.current_guard_id()
    or public.task_site_id(task_id) in (select public.accessible_site_ids())
  )
);

grant execute on function public.guard_is_assigned_to_task(uuid) to authenticated;
grant execute on function public.task_site_id(uuid) to authenticated;
