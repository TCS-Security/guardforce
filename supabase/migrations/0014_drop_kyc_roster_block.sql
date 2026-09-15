-- ---------------------------------------------------------------------------
-- 0014 — stop KYC completeness blocking roster assignment
--
-- `0003_functions.sql` hung a trigger on shift_assignments and roster_patterns that
-- refused any guard whose mandatory KYC was incomplete (KYC-1). In practice agencies
-- roster a guard the day they hire them and chase the paperwork afterwards, so the
-- rule blocked real work: an operator who could see the guard could not place them,
-- and the only way out was a paperwork queue they do not control.
--
-- The rule is withdrawn, not deleted. The triggers go; `guard_kyc_missing()` and
-- `guard_kyc_complete()` stay exactly as they are, because the guards page, the
-- overview's "needs action" tile and the public profile share page all read them,
-- and because we may want the block back — possibly per agency rather than for
-- everyone. `assignments_require_kyc()` is kept too, so restoring it is two
-- `create trigger` statements:
--
--   create trigger shift_assignments_require_kyc before insert on public.shift_assignments
--     for each row execute function public.assignments_require_kyc();
--   create trigger roster_patterns_require_kyc before insert on public.roster_patterns
--     for each row execute function public.assignments_require_kyc();
--
-- KYC completeness remains visible everywhere it was; it simply no longer decides
-- who can be put on a shift.
-- ---------------------------------------------------------------------------

drop trigger if exists shift_assignments_require_kyc on public.shift_assignments;
drop trigger if exists roster_patterns_require_kyc on public.roster_patterns;

comment on function public.assignments_require_kyc() is
  'Withdrawn in 0014: KYC completeness no longer blocks rostering. Kept so the rule can be restored by re-creating the triggers on shift_assignments and roster_patterns.';
