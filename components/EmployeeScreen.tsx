"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  breakEndAction,
  breakStartAction,
  clockInAction,
  clockOutAction,
} from "@/actions/timecard";
import { Alerts } from "@/components/shared/Alerts";
import { PageShell } from "@/components/shared/PageShell";
import { useTimecardBootstrap } from "@/hooks/useTimecardBootstrap";
import {
  BREAK_DURATION_OPTIONS,
  formatBreakUntilLabel,
  getPlannedBreakEnd,
  type BreakDurationMinutes,
} from "@/lib/break-billing";
import { roundClockInUp15 } from "@/lib/pay-calculation";
import type { Staff } from "@/types/timecard";

export function EmployeeScreen() {
  const {
    staff,
    loading,
    error,
    message,
    setError,
    setMessage,
    load,
    openByStaff,
  } = useTimecardBootstrap();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBreakPicker, setShowBreakPicker] = useState(false);

  const activeStaff = useMemo(
    () => staff.filter((p) => p.isActive && p.employmentType === "employee"),
    [staff],
  );

  const sortedActiveStaff = useMemo(() => {
    return [...activeStaff].sort((a, b) => {
      const aOpen = openByStaff.get(a.id);
      const bOpen = openByStaff.get(b.id);
      const aOnBreak = !!aOpen?.breaks.find((br) => !br.breakEnd);
      const bOnBreak = !!bOpen?.breaks.find((br) => !br.breakEnd);

      const rank = (isOpen: boolean, isOnBreak: boolean) => {
        if (isOpen && isOnBreak) return 0;
        if (isOpen && !isOnBreak) return 1;
        return 2;
      };

      const rankDiff = rank(!!aOpen, aOnBreak) - rank(!!bOpen, bOnBreak);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [activeStaff, openByStaff]);

  const selected = activeStaff.find((p) => p.id === selectedId) ?? null;
  const open = selected ? openByStaff.get(selected.id) : undefined;
  const openBreak = open?.breaks.find((b) => !b.breakEnd);
  const breakUntil = openBreak ? getPlannedBreakEnd(openBreak) : null;

  const refreshSilent = useCallback(() => load({ silent: true }), [load]);
  useEffect(() => {
    if (!openBreak || !breakUntil) return;
    const ms = breakUntil.getTime() - Date.now();
    if (ms <= 0) {
      void refreshSilent();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void refreshSilent();
    }, ms + 300);
    return () => window.clearTimeout(timeoutId);
  }, [openBreak?.id, openBreak?.breakStart, openBreak?.plannedMinutes, breakUntil, refreshSilent]);

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
    setShowBreakPicker(false);
    setSelectedId(null);
    await load();
  }

  async function startBreak(minutes: BreakDurationMinutes) {
    if (!selected) return;
    await runClock(() => breakStartAction(selected.id, minutes));
  }

  return (
    <PageShell
      badge="EMPLOYEE"
      title="社員勤退"
      subtitle="自分の名前を選んで、出勤・退勤してください"
    >
      <Alerts error={error} message={message} />

      {!selected ? (
        <section className="space-y-4 pb-4">
          <h2 className="px-1 text-base font-semibold text-slate-900">
            あなたの名前を選ぶ
          </h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>
          ) : activeStaff.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
              社員が登録されていません。管理者に登録を依頼してください。
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedActiveStaff.map((person) => {
                const openEntry = openByStaff.get(person.id);
                const isOnBreak = !!openEntry?.breaks.find((br) => !br.breakEnd);
                const status: "on_break" | "working" | "other" = isOnBreak
                  ? "on_break"
                  : openEntry
                    ? "working"
                    : "other";
                return (
                  <StaffPickButton
                    key={person.id}
                    person={person}
                    status={status}
                    onSelect={() => setSelectedId(person.id)}
                  />
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-3xl font-bold tracking-wide text-slate-900 md:text-4xl">
                {selected.name}
              </h2>
              {open ? (
                <p className="mt-2 text-base text-slate-600 md:text-lg">
                  本日{" "}
                  {selected.basicStartTime
                    ? selected.basicStartTime.slice(0, 5)
                    : roundClockInUp15(new Date(open.clockIn)).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  〜
                </p>
              ) : null}
            </div>
            {open ? (
              <span
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  openBreak ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {openBreak ? "休憩中" : "出勤中"}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                退勤済
              </span>
            )}
          </div>

          {openBreak && breakUntil ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-base font-semibold text-amber-900">
              {formatBreakUntilLabel(breakUntil)}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {!open ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runClock(() => clockInAction(selected.id))}
                className="w-full touch-manipulation rounded-xl bg-emerald-600 py-5 text-xl font-bold text-white disabled:opacity-50"
              >
                出勤
              </button>
            ) : (
              <>
                {openBreak ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runClock(() => breakEndAction(selected.id))}
                    className="w-full touch-manipulation rounded-xl bg-sky-600 py-5 text-xl font-bold text-white disabled:opacity-50"
                  >
                    再開
                  </button>
                ) : showBreakPicker ? (
                  <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                    <p className="text-center text-base font-semibold text-sky-900">休憩時間を選ぶ</p>
                    <div className="grid grid-cols-2 gap-2">
                      {BREAK_DURATION_OPTIONS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          disabled={busy}
                          onClick={() => void startBreak(minutes)}
                          className="touch-manipulation rounded-lg border border-sky-300 bg-white py-4 text-base font-bold text-sky-800 disabled:opacity-50"
                        >
                          {minutes}分休憩
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowBreakPicker(false)}
                      className="w-full touch-manipulation rounded-lg border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setShowBreakPicker(true);
                      setError(null);
                    }}
                    className="w-full touch-manipulation rounded-xl border border-sky-300 bg-sky-50 py-5 text-xl font-bold text-sky-800 disabled:opacity-50"
                  >
                    休憩開始
                  </button>
                )}
                {!openBreak ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runClock(() => clockOutAction(selected.id))}
                    className="w-full touch-manipulation rounded-xl bg-amber-600 py-5 text-xl font-bold text-white disabled:opacity-50"
                  >
                    退勤
                  </button>
                ) : null}
              </>
            )}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function StaffPickButton({
  person,
  status,
  onSelect,
}: {
  person: Staff;
  status: "on_break" | "working" | "other";
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full touch-manipulation items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-left shadow-sm hover:border-emerald-300 hover:bg-emerald-50/50 md:px-6 md:py-7"
      >
        <span className="text-2xl font-bold text-slate-900 md:text-3xl">{person.name}</span>
        {status === "on_break" ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
            休憩中
          </span>
        ) : status === "working" ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
            出勤中
          </span>
        ) : null}
      </button>
    </li>
  );
}

