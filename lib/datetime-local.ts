/** ISO文字列を input[type=datetime-local] 用の値に変換（ローカル時刻） */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local の値を ISO 文字列に変換 */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
