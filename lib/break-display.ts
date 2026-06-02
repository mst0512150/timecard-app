import { completedBreakMs } from "@/lib/pay-calculation";
import type { BreakEntry } from "@/types/timecard";

export function formatBreakLabel(breaks: BreakEntry[]): string | null {
  const ms = completedBreakMs(breaks);
  const hasCompletedBreak = breaks.some((b) => !!b.breakEnd);
  if (ms <= 0) return hasCompletedBreak ? "休憩 0分" : null;
  const minutes = Math.round(ms / 60_000);
  // msはbillableBreakMsの都合で15分刻みになっているはずです
  return `休憩 ${minutes}分`;
}
