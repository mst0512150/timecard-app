import type { BreakEntry } from "@/types/timecard";

export const BREAK_DURATION_OPTIONS = [15, 30, 45, 60] as const;
export type BreakDurationMinutes = (typeof BREAK_DURATION_OPTIONS)[number];

const MS_PER_MINUTE = 60_000;

export function isBreakDurationMinutes(
  value: number,
): value is BreakDurationMinutes {
  return (BREAK_DURATION_OPTIONS as readonly number[]).includes(value);
}

function elapsedMinutesFloor(ms: number): number {
  return Math.max(0, Math.floor(ms / MS_PER_MINUTE));
}

function billableMinutesForAdminManualEnd(
  elapsedMinutes: number,
): number {
  // 【管理画面からの強制終了のみ】
  // 0〜14 → 0
  // 15〜30 → 15
  // 31〜45 → 30
  // 46〜60 → 45
  // 61〜 → 60
  if (elapsedMinutes <= 14) return 0;
  if (elapsedMinutes <= 30) return 15;
  if (elapsedMinutes <= 45) return 30;
  if (elapsedMinutes <= 60) return 45;
  return 60;
}

function billableMinutesForNormalRestart(
  plannedMinutes: number,
  elapsedMinutes: number,
): number {
  // 【通常の再開】
  // 「選んだ休憩時間」を最低休憩時間にし、
  // 経過は15分単位で“切り上げ”扱い（上限75分）
  // 例:
  //  15分 → 16分で30分扱い、31分で45分扱い、46分で60分扱い、61分で75分扱い
  const roundedUp15 =
    elapsedMinutes === 0 ? 0 : Math.ceil(elapsedMinutes / 15) * 15;
  const capped = Math.min(75, roundedUp15);
  return Math.min(75, Math.max(plannedMinutes, capped));
}

export function getPlannedBreakEnd(b: BreakEntry): Date | null {
  if (!b.plannedMinutes) return null;
  return new Date(
    new Date(b.breakStart).getTime() + b.plannedMinutes * MS_PER_MINUTE,
  );
}

/** 給与・履歴表示用の1休憩あたりの計上ミリ秒 */
export function billableBreakMs(b: BreakEntry): number {
  if (!b.breakEnd) return 0;
  const start = new Date(b.breakStart).getTime();
  const end = new Date(b.breakEnd).getTime();
  const actualMs = end - start;
  if (actualMs <= 0) return 0;

  const elapsedMinutes = elapsedMinutesFloor(actualMs);

  // 管理画面の強制終了のみ、実際の経過を15分単位で丸め
  if (b.manualEnd) {
    return billableMinutesForAdminManualEnd(elapsedMinutes) * MS_PER_MINUTE;
  }

  // 通常の再開（スタッフの再開ボタン・自動終了）
  // planned_minutes が無い既存データは、従来通り「実際の経過」を控除する
  if (b.plannedMinutes == null) {
    return actualMs;
  }

  return billableMinutesForNormalRestart(
    b.plannedMinutes,
    elapsedMinutes,
  ) * MS_PER_MINUTE;
}

export function totalBillableBreakMs(breaks: BreakEntry[]): number {
  let total = 0;
  for (const b of breaks) {
    total += billableBreakMs(b);
  }
  return total;
}

/** 勤務時間から控除する休憩区間（丸め後の勤務枠内にクリップ） */
export function billableBreakInterval(
  b: BreakEntry,
  clockIn: Date,
  clockOut: Date,
): { start: Date; end: Date } | null {
  const ms = billableBreakMs(b);
  if (ms <= 0) return null;
  const bs = new Date(b.breakStart);
  const end = new Date(bs.getTime() + ms);
  const start = new Date(Math.max(bs.getTime(), clockIn.getTime()));
  const cappedEnd = new Date(Math.min(end.getTime(), clockOut.getTime()));
  if (cappedEnd.getTime() <= start.getTime()) return null;
  return { start, end: cappedEnd };
}

export function formatBreakUntilLabel(until: Date): string {
  const t = until.toLocaleTimeString("ja-JP", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${t}まで休憩です`;
}
