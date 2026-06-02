import type { TimeEntry } from "@/types/timecard";

export type StaffWorkStatus = "working" | "on_break" | "off";

export function getStaffWorkStatus(
  staffId: string,
  openByStaff: Map<string, TimeEntry>,
): StaffWorkStatus {
  const open = openByStaff.get(staffId);
  if (!open) return "off";
  if (open.breaks.some((b) => !b.breakEnd)) return "on_break";
  return "working";
}
