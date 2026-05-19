"use server";

import { revalidatePath } from "next/cache";
import { forceDynamicData } from "@/lib/force-dynamic-data";
import { getAnonClient } from "@/lib/supabase/service";
import type { Staff, TimeEntry } from "@/types/timecard";

type DbStaff = {
  id: string;
  name: string;
  hourly_rate: number;
  is_active?: boolean | string | null;
};

type DbTimeEntry = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  staff: { name: string; hourly_rate: number } | null;
};

function mapStaff(row: DbStaff): Staff {
  const raw = row.is_active;
  const isActive =
    raw === false || raw === true
      ? raw
      : raw === "false" || raw === "f"
        ? false
        : true;
  return {
    id: row.id,
    name: row.name,
    hourlyRate: row.hourly_rate,
    isActive,
  };
}

function mapEntry(row: DbTimeEntry): TimeEntry {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff?.name ?? "",
    hourlyRate: row.staff?.hourly_rate ?? 0,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
  };
}

export async function fetchBootstrapAction(): Promise<
  | { ok: true; staff: Staff[]; entries: TimeEntry[] }
  | { ok: false; error: string }
> {
  forceDynamicData();
  try {
    const supabase = getAnonClient();
    const [staffRes, entriesRes] = await Promise.all([
      supabase
        .from("staff")
        .select("id, name, hourly_rate, is_active")
        .order("name", { ascending: true }),
      supabase
        .from("time_entries")
        .select("*, staff(name, hourly_rate)")
        .order("clock_in", { ascending: false })
        .limit(50),
    ]);

    if (staffRes.error) {
      const msg = staffRes.error.message ?? "";
      if (msg.includes("is_active")) {
        return {
          ok: false,
          error:
            "staff テーブルに is_active 列がありません。Supabase で migration-staff-is-active.sql を実行してください。",
        };
      }
      return { ok: false, error: "データの取得に失敗しました。" };
    }
    if (entriesRes.error) {
      return { ok: false, error: "データの取得に失敗しました。" };
    }

    return {
      ok: true,
      staff: (staffRes.data ?? []).map((r) => mapStaff(r as DbStaff)),
      entries: (entriesRes.data ?? []).map((r) =>
        mapEntry(r as DbTimeEntry),
      ),
    };
  } catch {
    return {
      ok: false,
      error:
        "Supabase の設定を確認してください（.env.local に URL と anon キー）。",
    };
  }
}

export async function addStaffAction(
  name: string,
  hourlyRate: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "名前を入力してください。" };
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return { ok: false, error: "時給は1円以上で入力してください。" };
  }

  const supabase = getAnonClient();
  const { error } = await supabase.from("staff").insert({
    name: trimmed,
    hourly_rate: Math.round(hourlyRate),
  });
  if (error) {
    return { ok: false, error: "スタッフの登録に失敗しました。" };
  }
  return { ok: true };
}

export async function updateStaffAction(
  staffId: string,
  name: string,
  hourlyRate: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  if (!staffId.trim()) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "名前を入力してください。" };
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return { ok: false, error: "時給は1円以上で入力してください。" };
  }

  const supabase = getAnonClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name: trimmed,
      hourly_rate: Math.round(hourlyRate),
    })
    .eq("id", staffId);
  if (error) {
    return { ok: false, error: "スタッフ情報の更新に失敗しました。" };
  }
  return { ok: true };
}

export async function setStaffActiveAction(
  staffId: string,
  isActive: boolean,
): Promise<
  { ok: true; isActive: boolean } | { ok: false; error: string }
> {
  forceDynamicData();
  if (!staffId.trim()) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }

  const supabase = getAnonClient();
  const { data: row, error: findError } = await supabase
    .from("staff")
    .select("id, is_active")
    .eq("id", staffId)
    .maybeSingle();
  if (findError) {
    const msg = findError.message ?? "";
    if (msg.includes("is_active")) {
      return {
        ok: false,
        error:
          "is_active 列がありません。Supabase で migration-staff-is-active.sql を実行してください。",
      };
    }
    return { ok: false, error: "スタッフが見つかりません。" };
  }
  if (!row) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }

  const currentActive = row.is_active !== false;
  if (currentActive === isActive) {
    return {
      ok: false,
      error: isActive ? "すでに在籍中です。" : "すでに退職扱いです。",
    };
  }

  const { error } = await supabase
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", staffId);
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("is_active")) {
      return {
        ok: false,
        error:
          "is_active 列がありません。Supabase で migration-staff-is-active.sql を実行してください。",
      };
    }
    return {
      ok: false,
      error: isActive
        ? "在籍中への変更に失敗しました。"
        : "退職扱いの更新に失敗しました。",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true, isActive };
}

export async function clockInAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const supabase = getAnonClient();

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("is_active")
    .eq("id", staffId)
    .maybeSingle();
  if (staffError || !staffRow) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }
  if (staffRow.is_active === false) {
    return {
      ok: false,
      error: "退職扱いのスタッフは出勤できません。管理者に連絡してください。",
    };
  }

  const { data: open } = await supabase
    .from("time_entries")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (open) {
    return { ok: false, error: "すでに出勤中です。先に退店してください。" };
  }

  const { error } = await supabase.from("time_entries").insert({
    staff_id: staffId,
    clock_in: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: "出勤の記録に失敗しました。" };
  }
  return { ok: true };
}

export async function clockOutAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const supabase = getAnonClient();

  const { data: open, error: findError } = await supabase
    .from("time_entries")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (findError || !open) {
    return { ok: false, error: "出勤中の記録がありません。" };
  }

  const { error } = await supabase
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", open.id);
  if (error) {
    return { ok: false, error: "退店の記録に失敗しました。" };
  }
  return { ok: true };
}

export async function updateTimeEntryAction(
  entryId: string,
  clockInRaw: string,
  clockOutRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  if (!entryId.trim()) {
    return { ok: false, error: "勤務記録が見つかりません。" };
  }

  const clockIn = new Date(clockInRaw);
  const clockOut = new Date(clockOutRaw);
  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) {
    return { ok: false, error: "日時の形式が正しくありません。" };
  }
  if (clockOut.getTime() <= clockIn.getTime()) {
    return { ok: false, error: "退店は出勤より後の時刻にしてください。" };
  }

  const supabase = getAnonClient();
  const { data: row, error: findError } = await supabase
    .from("time_entries")
    .select("id, clock_out")
    .eq("id", entryId)
    .maybeSingle();
  if (findError || !row?.clock_out) {
    return { ok: false, error: "退店済みの勤務記録のみ修正できます。" };
  }

  const { error } = await supabase
    .from("time_entries")
    .update({
      clock_in: clockIn.toISOString(),
      clock_out: clockOut.toISOString(),
    })
    .eq("id", entryId);
  if (error) {
    return { ok: false, error: "時間の保存に失敗しました。" };
  }
  return { ok: true };
}
