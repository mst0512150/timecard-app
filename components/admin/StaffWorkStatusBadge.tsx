import type { StaffWorkStatus } from "@/lib/staff-work-status";

const STYLES: Record<
  StaffWorkStatus,
  { label: string; className: string }
> = {
  working: {
    label: "🟢 出勤中",
    className: "bg-emerald-100 text-emerald-800",
  },
  on_break: {
    label: "🟡 休憩中",
    className: "bg-amber-100 text-amber-900",
  },
  off: {
    label: "⚪ 退勤済",
    className: "bg-slate-100 text-slate-600",
  },
};

export function StaffWorkStatusBadge({ status }: { status: StaffWorkStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
