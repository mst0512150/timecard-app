import type { WorkSummary } from "@/types/timecard";

const MS_PER_MINUTE = 60_000;

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
  };
}

export function summarizeShift(
  hourlyRate: number,
  clockInIso: string,
  clockOutIso: string | null,
  now = new Date(),
): WorkSummary {
  const clockIn = new Date(clockInIso);
  const clockOut = clockOutIso ? new Date(clockOutIso) : now;
  const { regularMs, nightMs } = splitWorkMs(clockIn, clockOut);
  return calculatePay(hourlyRate, regularMs, nightMs);
}
