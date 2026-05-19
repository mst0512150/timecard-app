-- 既存DB用: スタッフの退職・非表示フラグ
-- Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
