-- 既存DB用: スタッフの雇用区分（アルバイト / 社員）
-- Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'part_time';

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_employment_type_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_employment_type_check
  CHECK (employment_type IN ('part_time', 'employee'));
