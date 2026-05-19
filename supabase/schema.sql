-- ============================================================
-- timecard-app: Supabase 初期スキーマ
-- Supabase Dashboard → SQL Editor → New query → 貼り付け → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hourly_rate INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_hourly_rate_positive CHECK (hourly_rate > 0)
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS time_entries_staff_id_idx ON public.time_entries (staff_id);
CREATE INDEX IF NOT EXISTS time_entries_clock_in_idx ON public.time_entries (clock_in DESC);

-- 1人につき「出勤中」は1件だけ
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_per_staff
  ON public.time_entries (staff_id)
  WHERE clock_out IS NULL;

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ログイン前の最小構成: anon キーで読み書き（管理者のみ利用想定）
CREATE POLICY "anon_all_staff"
  ON public.staff
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_time_entries"
  ON public.time_entries
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
