export type EmploymentType = "part_time" | "employee";

export type Staff = {
  id: string;
  name: string;
  hourlyRate: number;
  isActive: boolean;
  employmentType: EmploymentType;
  basicStartTime: string | null;
  basicEndTime: string | null;
};

export type BreakEntry = {
  id: string;
  timeEntryId: string;
  breakStart: string;
  breakEnd: string | null;
  /** 選択した休憩分数（15/30/45/60）。未設定は従来データ */
  plannedMinutes: number | null;
  /** 管理者の手動終了、または退勤時の未完了休憩 */
  manualEnd: boolean;
};

export type TimeEntry = {
  id: string;
  staffId: string;
  staffName: string;
  hourlyRate: number;
  clockIn: string;
  clockOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  breaks: BreakEntry[];
};

export type WorkSummary = {
  regularHours: number;
  nightHours: number;
  totalHours: number;
  payYen: number;
  breakHours: number;
};
