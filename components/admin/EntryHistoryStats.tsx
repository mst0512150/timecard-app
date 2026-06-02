import { formatBreakLabel } from "@/lib/break-display";
import { getEntryWorkSummary } from "@/lib/entry-pay";
import { formatDuration, formatYen } from "@/lib/format";
import type { TimeEntry } from "@/types/timecard";

export function EntryHistoryStats({ entry }: { entry: TimeEntry }) {
  const summary = getEntryWorkSummary(entry);
  const breakLabel = formatBreakLabel(entry.breaks);

  return (
    <div className="mt-2 space-y-1 text-xs text-slate-700">
      {breakLabel ? <p className="text-slate-600">{breakLabel}</p> : null}
      <p>通常勤務時間 {formatDuration(summary.regularHours)}</p>
      <p>深夜勤務時間 {formatDuration(summary.nightHours)}</p>
      <p>合計勤務時間 {formatDuration(summary.totalHours)}</p>
      <p className="font-semibold text-slate-900">給料 {formatYen(summary.payYen)}</p>
    </div>
  );
}
