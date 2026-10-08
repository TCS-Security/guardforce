-- What you need to actually pay a guard, and who to call if something happens to him.
--
-- `guards` already carried `address` and `emergency_contact` but nothing to run a salary
-- against: no bank account, no IFSC, no UAN, no ESIC insurance number. An agency cannot
-- file a PF return or push a NEFT batch without those, so they were the missing half of
-- the record.
--
-- The account number is stored **masked** (last four digits). The full number belongs in
-- the bank's own mandate file, not in a row that every manager with guards:read can see;
-- a masked number is enough to reconcile a payout against a payslip, which is what the
-- app actually needs it for.
alter table public.guards
  add column if not exists bank_name            text,
  add column if not exists bank_account_masked  text,
  add column if not exists bank_ifsc            text,
  -- Universal Account Number: the PF identity that follows a guard between employers.
  add column if not exists uan                  text,
  -- ESIC insurance number. Note a guard above the Rs 21,000 gross ceiling is out of ESI,
  -- which after the 2026 Karnataka revision is most of them — the number is still kept,
  -- because coverage resumes whenever they drop back under it.
  add column if not exists esic_ip              text;

comment on column public.guards.bank_account_masked is 'Last four digits only; the full number lives in the bank mandate, not here.';
