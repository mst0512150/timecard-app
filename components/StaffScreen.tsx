"use client";

import { useEffect, useMemo, useState } from "react";
import { clockInAction, clockOutAction } from "@/actions/timecard";
import { Alerts } from "@/components/shared/Alerts";
import { PageShell } from "@/components/shared/PageShell";
import { Stat } from "@/components/shared/Stat";
import { useTimecardBootstrap } from "@/hooks/useTimecardBootstrap";
import {
  aggregateCompleted,
  currentMonthKey,
  filterCompletedByMonth,
  formatMonthLabel,
} from "@/lib/admin-stats";
import { formatDateTime, formatDuration, formatYen } from "@/lib/format";
import { summarizeShift } from "@/lib/pay-calculation";
import type { Staff } from "@/types/timecard";

export function StaffScreen() {
  const {
    staff,
    loading,
    error,
    message,
    setError,
    setMessage,
    load,
    openByStaff,
    completedEntries,
  } = useTimecardBootstrap();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const activeStaff = useMemo(
    () => staff.filter((p) => p.isActive),
    [staff],
  );

  const selected = activeStaff.find((p) => p.id === selectedId) ?? null;
  const open = selected ? openByStaff.get(selected.id) : undefined;
  const summary =
    selected && open
      ? summarizeShift(selected.hourlyRate, open.clockIn, null, now)
      : null;

  const monthKey = currentMonthKey();

  const myHistory = useMemo(() => {
    if (!selectedId) return [];
    return filterCompletedByMonth(
      completedEntries.filter((e) => e.staffId === selectedId),
      monthKey,
    ).sort(
      (a, b) =>
        new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
    );
  }, [completedEntries, selectedId, monthKey]);

  const myTotals = useMemo(
    () => aggregateCompleted(myHistory),
    [myHistory],
  );

  useEffect(() => {
    if (!selected || !open) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [selected, open]);

  async function runClock(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    if (!selected) return;
    setMessage(null);
    setError(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage("保存しました");
    await load();
  }

  return (
    <PageShell
      badge="STAFF"
      title="スタッフ画面"
      subtitle="自分の名前を選んで、出勤・退店してください"
    >
      <Alerts error={error} message={message} />

      {!selected ? (
        <section className="space-y-3">
          <h2 className="px-1 text-base font-semibold text-slate-900">
            あなたの名前を選ぶ
          </h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>
          ) : activeStaff.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
              スタッフが登録されていません。管理者に登録を依頼してください。
            </p>
          ) : (
            <ul className="space-y-2">
              {activeStaff.map((person) => (
                <StaffPickButton
                  key={person.id}
                  person={person}
                  isWorking={openByStaff.has(person.id)}
                  onSelect={() => setSelectedId(person.id)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
              <p className="text-sm text-slate-600">時給 {formatYen(selected.hourlyRate)}</p>
            </div>
            {open ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                出勤中
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                退店済
              </span>
            )}
          </div>

          {open && summary && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <Stat label="通常勤務" value={formatDuration(summary.regularHours)} />
              <Stat label="深夜勤務" value={formatDuration(summary.nightHours)} />
              <Stat label="合計" value={formatDuration(summary.totalHours)} />
              <Stat
                label="支給額（見込）"
                value={formatYen(summary.payYen)}
                highlight
              />
              <p className="col-span-2 text-xs text-slate-500">
                出勤 {formatDateTime(open.clockIn)} 〜
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {!open ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runClock(() => clockInAction(selected.id))
                }
                className="w-full rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white disabled:opacity-50"
              >
                出勤
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runClock(() => clockOutAction(selected.id))
                }
                className="w-full rounded-xl bg-amber-600 py-4 text-base font-semibold text-white disabled:opacity-50"
              >
                退店
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setMessage(null);
                setError(null);
              }}
              className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              別の人を選ぶ
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            {formatMonthLabel(monthKey)}の退店済み勤務
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
            <div>
              <p className="text-[11px] text-slate-500">通常勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatDuration(myTotals.regularHours)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">通常勤務分の給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatYen(myTotals.regularPay)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">深夜勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatDuration(myTotals.nightHours)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">深夜勤務分の給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatYen(myTotals.nightPay)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">合計勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatDuration(myTotals.totalHours)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">合計給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-sky-700">
                {formatYen(myTotals.totalPay)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-slate-600">
            出勤回数{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {myTotals.dayCount}回
            </span>
          </p>
          <section className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">
              自分の勤務履歴（{formatMonthLabel(monthKey)}）
            </h3>
            {myHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                今月の履歴はまだありません
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {myHistory.map((entry) => {
                  const shift = summarizeShift(
                    entry.hourlyRate,
                    entry.clockIn,
                    entry.clockOut,
                  );
                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm"
                    >
                      <p className="text-xs text-slate-600">
                        {formatDateTime(entry.clockIn)} 〜{" "}
                        {entry.clockOut ? formatDateTime(entry.clockOut) : "—"}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-700">
                        <span>合計 {formatDuration(shift.totalHours)}</span>
                        <span className="font-semibold text-slate-900">
                          {formatYen(shift.payYen)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      )}
    </PageShell>
  );
}

function StaffPickButton({
  person,
  isWorking,
  onSelect,
}: {
  person: Staff;
  isWorking: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:border-emerald-300 hover:bg-emerald-50/50"
      >
        <span className="text-base font-semibold text-slate-900">{person.name}</span>
        {isWorking ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
            出勤中
          </span>
        ) : null}
      </button>
    </li>
  );
}
