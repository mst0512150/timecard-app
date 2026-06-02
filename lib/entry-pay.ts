import { summarizeShift } from "@/lib/pay-calculation";
import type { TimeEntry, WorkSummary } from "@/types/timecard";

export function getEntryWorkSummary(entry: TimeEntry): WorkSummary {
  if (!entry.clockOut) {
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
    entry.clockIn,
    entry.clockOut,
    entry.breaks,
  );
}
