-- 定時休憩・手動終了フラグ（既存 break_entries に追加）
ALTER TABLE public.break_entries
  ADD COLUMN IF NOT EXISTS planned_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS manual_end BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.break_entries
  DROP CONSTRAINT IF EXISTS break_entries_planned_minutes_check;

ALTER TABLE public.break_entries
  ADD CONSTRAINT break_entries_planned_minutes_check
  CHECK (planned_minutes IS NULL OR planned_minutes IN (15, 30, 45, 60));
