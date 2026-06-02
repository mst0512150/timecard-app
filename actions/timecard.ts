"use server";

import { revalidatePath } from "next/cache";
import { isBreakDurationMinutes } from "@/lib/break-billing";
import { forceDynamicData } from "@/lib/force-dynamic-data";
import { getAnonClient } from "@/lib/supabase/service";
import type { BreakEntry, EmploymentType, Staff, TimeEntry } from "@/types/timecard";

type DbStaff = {
  id: string;
  name: string;
  hourly_rate: number;
  is_active?: boolean | string | null;
  employment_type?: string | null;
  basic_start_time?: string | null;
  basic_end_time?: string | null;
};

type DbTimeEntry = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  late_minutes?: number | null;
  early_leave_minutes?: number | null;
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
    employmentType: row.employment_type === "employee" ? "employee" : "part_time",
    basicStartTime: row.basic_start_time ?? null,
    basicEndTime: row.basic_end_time ?? null,
  };
}

type DbBreakEntry = {
  id: string;
  time_entry_id: string;
  break_start: string;
  break_end: string | null;
  planned_minutes?: number | null;
  manual_end?: boolean | null;
};

type OpenBreakRow = {
  id: string;
  time_entry_id: string;
  break_start: string;
  planned_minutes: number;
};

function mapBreak(row: DbBreakEntry): BreakEntry {
  return {
    id: row.id,
    timeEntryId: row.time_entry_id,
    breakStart: row.break_start,
    breakEnd: row.break_end,
    plannedMinutes: row.planned_minutes ?? null,
    manualEnd: row.manual_end === true,
  };
}

async function finalizeDueBreaks(
  supabase: ReturnType<typeof getAnonClient>,
): Promise<void> {
  const { data: openBreaks } = await supabase
    .from("break_entries")
    .select("id, time_entry_id, break_start, planned_minutes")
    .is("break_end", null)
    .not("planned_minutes", "is", null);

  const now = Date.now();
  for (const row of (openBreaks ?? []) as OpenBreakRow[]) {
    const breakStartMs = new Date(row.break_start).getTime();
    const forcedClockOutMs = breakStartMs + 75 * 60_000;
    // 76分以上は自動退勤（休憩は75分扱いで締める）
    if (now > forcedClockOutMs) {
      const forcedIso = new Date(forcedClockOutMs).toISOString();
      await supabase
        .from("break_entries")
        .update({
          break_end: forcedIso,
          manual_end: false,
        })
        .eq("id", row.id);
      await supabase
        .from("time_entries")
        .update({ clock_out: forcedIso })
        .eq("id", row.time_entry_id)
        .is("clock_out", null);
    }
  }
}

function computeRoundedLateMinutes(
  now: Date,
  basicStartTime: string | null | undefined,
  basicEndTime: string | null | undefined,
): number {
  if (!basicStartTime || !basicEndTime) return 0;
  const [hRaw, mRaw] = basicStartTime.split(":");
  const [ehRaw, emRaw] = basicEndTime.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  const endHour = Number(ehRaw);
  const endMinute = Number(emRaw);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }

  const baseline = new Date(now);
  baseline.setHours(hour, minute, 0, 0);
  const windowEnd = new Date(now);
  windowEnd.setHours(endHour, endMinute, 0, 0);
  if (windowEnd.getTime() <= baseline.getTime()) {
    windowEnd.setDate(windowEnd.getDate() + 1);
  }
  if (now.getTime() > windowEnd.getTime()) return 0;

  const diffMs = now.getTime() - baseline.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (15 * 60_000)) * 15;
}

function computeRoundedEarlyLeaveMinutes(
  now: Date,
  basicStartTime: string | null | undefined,
  basicEndTime: string | null | undefined,
): number {
  if (!basicStartTime || !basicEndTime) return 0;
  const [hRaw, mRaw] = basicStartTime.split(":");
  const [ehRaw, emRaw] = basicEndTime.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  const endHour = Number(ehRaw);
  const endMinute = Number(emRaw);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }

  const windowStart = new Date(now);
  windowStart.setHours(hour, minute, 0, 0);
  const windowEnd = new Date(now);
  windowEnd.setHours(endHour, endMinute, 0, 0);
  if (windowEnd.getTime() <= windowStart.getTime()) {
    windowEnd.setDate(windowEnd.getDate() + 1);
  }
  if (now.getTime() >= windowEnd.getTime()) return 0;
  const diffMs = windowEnd.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (15 * 60_000)) * 15;
}

function attachBreaks(entries: TimeEntry[], breaks: BreakEntry[]): TimeEntry[] {
  const byEntry = new Map<string, BreakEntry[]>();
  for (const b of breaks) {
    const list = byEntry.get(b.timeEntryId) ?? [];
    list.push(b);
    byEntry.set(b.timeEntryId, list);
  }
  return entries.map((e) => ({
    ...e,
    breaks: byEntry.get(e.id) ?? [],
  }));
}

function mapEntry(row: DbTimeEntry): TimeEntry {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff?.name ?? "",
    hourlyRate: row.staff?.hourly_rate ?? 0,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    lateMinutes: row.late_minutes ?? 0,
    earlyLeaveMinutes: row.early_leave_minutes ?? 0,
    breaks: [],
  };
}

export async function fetchBootstrapAction(): Promise<
  | { ok: true; staff: Staff[]; entries: TimeEntry[] }
  | { ok: false; error: string }
> {
  forceDynamicData();
  try {
    const supabase = getAnonClient();
    await finalizeDueBreaks(supabase);

    const [staffRes, entriesRes, breaksRes] = await Promise.all([
      supabase
        .from("staff")
        .select(
          "id, name, hourly_rate, is_active, employment_type, basic_start_time, basic_end_time",
        )
        .order("name", { ascending: true }),
      supabase
        .from("time_entries")
        .select("*, staff(name, hourly_rate)")
        .order("clock_in", { ascending: false })
        .limit(50),
      supabase
        .from("break_entries")
        .select(
          "id, time_entry_id, break_start, break_end, planned_minutes, manual_end",
        )
        .order("break_start", { ascending: false })
        .limit(200),
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
      if (msg.includes("employment_type")) {
        return {
          ok: false,
          error:
            "staff テーブルに employment_type 列がありません。Supabase で migration-staff-employment-type.sql を実行してください。",
        };
      }
      if (msg.includes("basic_start_time") || msg.includes("basic_end_time")) {
        return {
          ok: false,
          error:
            "staff テーブルに基本勤務時間列がありません。Supabase で migration-staff-basic-time-and-late.sql を実行してください。",
        };
      }
      return { ok: false, error: "データの取得に失敗しました。" };
    }
    if (entriesRes.error) {
      return { ok: false, error: "データの取得に失敗しました。" };
    }
    if (breaksRes.error) {
      const msg = breaksRes.error.message ?? "";
      if (msg.includes("planned_minutes") || msg.includes("manual_end")) {
        return {
          ok: false,
          error:
            "break_entries に列が不足しています。Supabase で migration-break-planned.sql を実行してください。",
        };
      }
      if (msg.includes("break_entries")) {
        return {
          ok: false,
          error:
            "break_entries テーブルがありません。Supabase で migration-break-entries.sql を実行してください。",
        };
      }
      return { ok: false, error: "データの取得に失敗しました。" };
    }

    const entries = attachBreaks(
      (entriesRes.data ?? []).map((r) => mapEntry(r as DbTimeEntry)),
      (breaksRes.data ?? []).map((r) => mapBreak(r as DbBreakEntry)),
    );

    return {
      ok: true,
      staff: (staffRes.data ?? []).map((r) => mapStaff(r as DbStaff)),
      entries,
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
  employmentType: EmploymentType,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "名前を入力してください。" };
  }
  if (employmentType !== "part_time" && employmentType !== "employee") {
    return { ok: false, error: "雇用区分が不正です。" };
  }
  if (employmentType === "part_time") {
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      return { ok: false, error: "時給は1円以上で入力してください。" };
    }
  }

  // 社員は金額計算しないため、時給未入力でも登録できるようにする。
  // DB制約(hourly_rate > 0)との整合のため、社員は最低値1を保存する。
  const normalizedHourlyRate =
    employmentType === "employee"
      ? 1
      : Number.isFinite(hourlyRate) && hourlyRate > 0
        ? hourlyRate
        : 0;

  const supabase = getAnonClient();
  const { error } = await supabase.from("staff").insert({
    name: trimmed,
    hourly_rate: Math.round(normalizedHourlyRate),
    employment_type: employmentType,
    basic_start_time: null,
    basic_end_time: null,
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
  basicStartTime?: string | null,
  basicEndTime?: string | null,
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
      basic_start_time: basicStartTime ?? null,
      basic_end_time: basicEndTime ?? null,
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

export async function deleteRetiredStaffAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  if (!staffId.trim()) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }

  const supabase = getAnonClient();
  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("id, is_active")
    .eq("id", staffId)
    .maybeSingle();
  if (staffError || !staffRow) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }
  if (staffRow.is_active !== false) {
    return { ok: false, error: "在籍中スタッフは削除できません。" };
  }

  const { error } = await supabase.from("staff").delete().eq("id", staffId);
  if (error) {
    return { ok: false, error: "スタッフの削除に失敗しました。" };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

export async function clockInAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const supabase = getAnonClient();

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("is_active, employment_type, basic_start_time, basic_end_time")
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

  const now = new Date();
  const isEmployee = staffRow.employment_type === "employee";
  const lateMinutes = isEmployee
    ? computeRoundedLateMinutes(
        now,
        staffRow.basic_start_time,
        staffRow.basic_end_time,
      )
    : 0;

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
    clock_in: now.toISOString(),
    late_minutes: lateMinutes,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("late_minutes")) {
      return {
        ok: false,
        error:
          "time_entries テーブルに遅刻列がありません。Supabase で migration-staff-basic-time-and-late.sql を実行してください。",
      };
    }
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

  await finalizeDueBreaks(supabase);

  const clockOutAt = new Date();
  const clockOutIso = clockOutAt.toISOString();
  const { data: staffRow } = await supabase
    .from("staff")
    .select("employment_type, basic_start_time, basic_end_time")
    .eq("id", staffId)
    .maybeSingle();
  const earlyLeaveMinutes =
    staffRow?.employment_type === "employee"
      ? computeRoundedEarlyLeaveMinutes(
          clockOutAt,
          staffRow.basic_start_time,
          staffRow.basic_end_time,
        )
      : 0;

  const { data: openBreak } = await supabase
    .from("break_entries")
    .select("id")
    .eq("time_entry_id", open.id)
    .is("break_end", null)
    .maybeSingle();
  if (openBreak) {
    const { error: breakError } = await supabase
      .from("break_entries")
      .update({ break_end: clockOutIso, manual_end: false })
      .eq("id", openBreak.id);
    if (breakError) {
      return { ok: false, error: "休憩終了の記録に失敗しました。" };
    }
  }

  const { error } = await supabase
    .from("time_entries")
    .update({ clock_out: clockOutIso, early_leave_minutes: earlyLeaveMinutes })
    .eq("id", open.id);
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("early_leave_minutes")) {
      return {
        ok: false,
        error:
          "time_entries テーブルに早退列がありません。Supabase で migration-staff-basic-time-and-late.sql を実行してください。",
      };
    }
    return { ok: false, error: "退店の記録に失敗しました。" };
  }
  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

export async function breakStartAction(
  staffId: string,
  plannedMinutes: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  if (!isBreakDurationMinutes(plannedMinutes)) {
    return { ok: false, error: "休憩時間を選択してください。" };
  }

  const supabase = getAnonClient();
  await finalizeDueBreaks(supabase);

  const { data: open, error: findError } = await supabase
    .from("time_entries")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (findError || !open) {
    return { ok: false, error: "出勤中のみ休憩を開始できます。" };
  }

  const { data: existing } = await supabase
    .from("break_entries")
    .select("id")
    .eq("time_entry_id", open.id)
    .is("break_end", null)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "すでに休憩中です。" };
  }

  const { error } = await supabase.from("break_entries").insert({
    time_entry_id: open.id,
    break_start: new Date().toISOString(),
    planned_minutes: plannedMinutes,
    manual_end: false,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("planned_minutes")) {
      return {
        ok: false,
        error:
          "休憩機能のDB更新が必要です。Supabase で migration-break-planned.sql を実行してください。",
      };
    }
    return { ok: false, error: "休憩開始の記録に失敗しました。" };
  }
  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

export async function breakEndAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const supabase = getAnonClient();
  await finalizeDueBreaks(supabase);

  const { data: open, error: findError } = await supabase
    .from("time_entries")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (findError || !open) {
    return { ok: false, error: "出勤中の記録がありません。" };
  }

  const { data: openBreak, error: breakFindError } = await supabase
    .from("break_entries")
    .select("id")
    .eq("time_entry_id", open.id)
    .is("break_end", null)
    .maybeSingle();
  if (breakFindError || !openBreak) {
    return { ok: false, error: "休憩中の記録がありません。" };
  }

  const { error } = await supabase
    .from("break_entries")
    .update({
      break_end: new Date().toISOString(),
      // スタッフの通常再開は、計算ルール上「強制終了」扱いにしない
      manual_end: false,
    })
    .eq("id", openBreak.id);
  if (error) {
    return { ok: false, error: "休憩の再開に失敗しました。" };
  }
  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

export async function adminManualBreakEndAction(
  staffId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  forceDynamicData();
  const supabase = getAnonClient();
  await finalizeDueBreaks(supabase);

  const { data: open, error: findError } = await supabase
    .from("time_entries")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (findError || !open) {
    return { ok: false, error: "出勤中の記録がありません。" };
  }

  const { data: openBreak, error: breakFindError } = await supabase
    .from("break_entries")
    .select("id")
    .eq("time_entry_id", open.id)
    .is("break_end", null)
    .maybeSingle();
  if (breakFindError || !openBreak) {
    return { ok: false, error: "休憩中の記録がありません。" };
  }

  const { error } = await supabase
    .from("break_entries")
    .update({
      break_end: new Date().toISOString(),
      manual_end: true,
    })
    .eq("id", openBreak.id);
  if (error) {
    return { ok: false, error: "休憩の手動終了に失敗しました。" };
  }
  revalidatePath("/admin");
  revalidatePath("/staff");
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
