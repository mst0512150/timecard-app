import { billableBreakInterval, totalBillableBreakMs } from "@/lib/break-billing";
import type { BreakEntry, WorkSummary } from "@/types/timecard";

const MS_PER_MINUTE = 60_000;
const MS_PER_15_MIN = 15 * MS_PER_MINUTE;

function isOn15MinuteMark(date: Date): boolean {
  return (
    date.getMinutes() % 15 === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

/** 出勤: :00/:15/:30/:45 はそのまま、それ以外は次の15分へ切り上げ */
export function roundClockInUp15(date: Date): Date {
  if (isOn15MinuteMark(date)) {
    return new Date(date.getTime());
  }
  return new Date(Math.ceil(date.getTime() / MS_PER_15_MIN) * MS_PER_15_MIN);
}

/** 退勤: :00/:15/:30/:45 はそのまま、それ以外は前の15分へ切り捨て */
export function roundClockOutDown15(date: Date): Date {
  if (isOn15MinuteMark(date)) {
    return new Date(date.getTime());
  }
  return new Date(Math.floor(date.getTime() / MS_PER_15_MIN) * MS_PER_15_MIN);
}

/** 給料・勤務時間計算用の丸め後の出勤〜退勤 */
export function roundedShiftBounds(
  clockInIso: string,
  clockOutIso: string | null,
  now = new Date(),
): { clockIn: Date; clockOut: Date } {
  const clockIn = roundClockInUp15(new Date(clockInIso));
  const rawOut = clockOutIso ? new Date(clockOutIso) : now;
  const clockOut = roundClockOutDown15(rawOut);
  return { clockIn, clockOut };
}

/** 22:00〜翌5:00 を深夜帯とする（ローカル時刻） */
export function isNightMinute(date: Date): boolean {
  const h = date.getHours();
  return h >= 22 || h < 5;
}

export function splitWorkMs(
  clockIn: Date,
  clockOut: Date,
): { regularMs: number; nightMs: number } {
  const start = clockIn.getTime();
  const end = clockOut.getTime();
  if (end <= start) {
    return { regularMs: 0, nightMs: 0 };
  }

  let regularMs = 0;
  let nightMs = 0;
  let t = start;

  while (t < end) {
    const next = Math.min(t + MS_PER_MINUTE, end);
    const duration = next - t;
    if (isNightMinute(new Date(t))) {
      nightMs += duration;
    } else {
      regularMs += duration;
    }
    t = next;
  }

  return { regularMs, nightMs };
}

export function calculatePay(
  hourlyRate: number,
  regularMs: number,
  nightMs: number,
  breakHours = 0,
): WorkSummary {
  const regularHours = regularMs / 3_600_000;
  const nightHours = nightMs / 3_600_000;
  const totalHours = regularHours + nightHours;
  const payYen =
    hourlyRate * regularHours + hourlyRate * 1.25 * nightHours;

  return {
    regularHours,
    nightHours,
    totalHours,
    payYen,
    breakHours,
  };
}

export function completedBreakMs(breaks: BreakEntry[]): number {
  return totalBillableBreakMs(breaks);
}

function workMsAfterBreaks(
  clockIn: Date,
  clockOut: Date,
  breaks: BreakEntry[],
): { regularMs: number; nightMs: number } {
  let { regularMs, nightMs } = splitWorkMs(clockIn, clockOut);
  for (const b of breaks) {
    const interval = billableBreakInterval(b, clockIn, clockOut);
    if (!interval) continue;
    const sub = splitWorkMs(interval.start, interval.end);
    regularMs = Math.max(0, regularMs - sub.regularMs);
    nightMs = Math.max(0, nightMs - sub.nightMs);
  }
  return { regularMs, nightMs };
}

export function summarizeShift(
  hourlyRate: number,
  clockInIso: string,
  clockOutIso: string | null,
  breaks: BreakEntry[] = [],
  now = new Date(),
): WorkSummary {
  const { clockIn, clockOut } = roundedShiftBounds(clockInIso, clockOutIso, now);
  const breakHours = completedBreakMs(breaks) / 3_600_000;
  if (clockOut.getTime() <= clockIn.getTime()) {
    return {
      regularHours: 0,
      nightHours: 0,
      totalHours: 0,
      payYen: 0,
      breakHours,
    };
  }
  const { regularMs, nightMs } = workMsAfterBreaks(clockIn, clockOut, breaks);
  return calculatePay(hourlyRate, regularMs, nightMs, breakHours);
}
