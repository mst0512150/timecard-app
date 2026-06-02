import { summarizeShift } from "@/lib/pay-calculation";
import type { Staff, TimeEntry, WorkSummary } from "@/types/timecard";

function parseTimeToDate(base: Date, hhmm: string): Date | null {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function getEmployeeBasicWindow(
  basicStartTime: string | null,
  basicEndTime: string | null,
  referenceDate: Date,
): { start: Date; end: Date } | null {
  if (!basicStartTime || !basicEndTime) return null;
  const start = parseTimeToDate(referenceDate, basicStartTime);
  const end = parseTimeToDate(referenceDate, basicEndTime);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

function getEffectiveBounds(
  entry: TimeEntry,
  staff: Staff,
  now = new Date(),
): { start: Date; end: Date; window: { start: Date; end: Date } | null } {
  const actualStart = new Date(entry.clockIn);
  const actualEnd = entry.clockOut ? new Date(entry.clockOut) : now;
  const reference = entry.clockOut ? new Date(entry.clockOut) : new Date(now);
  const window = getEmployeeBasicWindow(
    staff.basicStartTime,
    staff.basicEndTime,
    reference,
  );
  if (!window) {
    return { start: actualStart, end: actualEnd, window: null };
  }
  const start = new Date(Math.max(actualStart.getTime(), window.start.getTime()));
  const end = new Date(Math.min(actualEnd.getTime(), window.end.getTime()));
  return { start, end, window };
}

export function getEmployeeWorkSummary(
  entry: TimeEntry,
  staff: Staff,
  now = new Date(),
): WorkSummary {
  const { start, end } = getEffectiveBounds(entry, staff, now);
  if (end.getTime() <= start.getTime()) {
    return {
      regularHours: 0,
      nightHours: 0,
      totalHours: 0,
      payYen: 0,
      breakHours: 0,
    };
  }
  return summarizeShift(
    entry.hourlyRate,
    start.toISOString(),
    end.toISOString(),
    entry.breaks,
    now,
  );
}

export function getEmployeeDisplayRange(
  entry: TimeEntry,
  staff: Staff,
  now = new Date(),
): { start: Date; end: Date } {
  const { start, end, window } = getEffectiveBounds(entry, staff, now);
  if (window) {
    return { start: window.start, end: window.end };
  }
  return { start, end };
}
