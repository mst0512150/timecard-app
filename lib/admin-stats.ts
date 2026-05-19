import { summarizeShift } from "@/lib/pay-calculation";
import type { Staff, TimeEntry } from "@/types/timecard";

export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}年${Number(m)}月`;
}

export function entryInMonth(clockInIso: string, monthKey: string): boolean {
  return monthKeyFromDate(new Date(clockInIso)) === monthKey;
}

export function filterCompletedByMonth(
  entries: TimeEntry[],
  monthKey: string,
): TimeEntry[] {
  return entries.filter(
    (e) => e.clockOut && entryInMonth(e.clockIn, monthKey),
  );
}

/** 管理画面のスタッフ一覧: 在籍・退職済を両方表示（在籍を先に） */
export function staffForAdminList(staff: Staff[]): Staff[] {
  return [...staff].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
}

export function aggregateCompleted(entries: TimeEntry[]) {
  let regularHours = 0;
  let nightHours = 0;
  let totalHours = 0;
  let regularPay = 0;
  let nightPay = 0;
  let totalPay = 0;
  let dayCount = 0;
  for (const e of entries) {
    if (!e.clockOut) continue;
    const s = summarizeShift(e.hourlyRate, e.clockIn, e.clockOut);
    regularHours += s.regularHours;
    nightHours += s.nightHours;
    totalHours += s.totalHours;
    regularPay += e.hourlyRate * s.regularHours;
    nightPay += e.hourlyRate * 1.25 * s.nightHours;
    totalPay += s.payYen;
    dayCount += 1;
  }
  return {
    regularHours,
    nightHours,
    totalHours,
    regularPay,
    nightPay,
    totalPay,
    dayCount,
  };
}

export function monthOptionsFromEntries(entries: TimeEntry[]): string[] {
  const set = new Set<string>([currentMonthKey()]);
  for (const e of entries) {
    set.add(monthKeyFromDate(new Date(e.clockIn)));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}
