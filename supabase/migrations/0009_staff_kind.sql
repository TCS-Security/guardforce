-- A new enum value cannot be used in the transaction that adds it, and each migration file
-- runs as one transaction, so the value lands here and 0010 uses it.
alter type public.user_role add value if not exists 'staff';
