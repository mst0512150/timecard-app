-- 休憩記録（既存DB用）
-- Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.break_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries (id) ON DELETE CASCADE,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS break_entries_time_entry_id_idx
  ON public.break_entries (time_entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS break_entries_one_open_per_entry
  ON public.break_entries (time_entry_id)
  WHERE break_end IS NULL;

ALTER TABLE public.break_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_break_entries"
  ON public.break_entries
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
