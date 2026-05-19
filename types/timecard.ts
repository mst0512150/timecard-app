export type Staff = {
  id: string;
  name: string;
  hourlyRate: number;
  isActive: boolean;
};

export type TimeEntry = {
  id: string;
  staffId: string;
  staffName: string;
  hourlyRate: number;
  clockIn: string;
  clockOut: string | null;
};

export type WorkSummary = {
  regularHours: number;
  nightHours: number;
  totalHours: number;
  payYen: number;
};
