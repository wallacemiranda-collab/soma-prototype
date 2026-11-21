-- Apply only after clinical review of Phase 1. No existing measurement is backfilled.
alter table public.profiles
  add column if not exists height_cm numeric check (height_cm between 30 and 300);
alter table public.metabolic_entries
  add column if not exists height_cm numeric check (height_cm between 30 and 300);
-- Existing ownership, read-only sharing and grants remain unchanged.
