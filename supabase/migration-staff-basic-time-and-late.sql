-- 既存DB用: 社員の基本勤務時間と遅刻記録
-- Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS basic_start_time TIME,
  ADD COLUMN IF NOT EXISTS basic_end_time TIME;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER NOT NULL DEFAULT 0;
