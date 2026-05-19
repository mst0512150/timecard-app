export const ADMIN_AUTH_STORAGE_KEY = "timecard-admin-auth";
export const ADMIN_PASSWORD = "0512";

export function isAdminAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "1";
}

export function setAdminAuthed(): void {
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "1");
}

export function clearAdminAuthed(): void {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}
