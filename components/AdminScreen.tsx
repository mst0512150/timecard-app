"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addStaffAction,
  adminManualBreakEndAction,
  deleteRetiredStaffAction,
  setStaffActiveAction,
  updateStaffAction,
  updateTimeEntryAction,
} from "@/actions/timecard";
import { Alerts } from "@/components/shared/Alerts";
import { PageShell } from "@/components/shared/PageShell";
import { useTimecardBootstrap } from "@/hooks/useTimecardBootstrap";
import {
  aggregateCompleted,
  currentMonthKey,
  filterCompletedByMonth,
  formatMonthLabel,
  monthOptionsFromEntries,
} from "@/lib/admin-stats";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";
import { EntryHistoryStats } from "@/components/admin/EntryHistoryStats";
import { StaffWorkStatusBadge } from "@/components/admin/StaffWorkStatusBadge";
import {
  getEmployeeDisplayRange,
  getEmployeeWorkSummary,
} from "@/lib/employee-work";
import { formatDateTime, formatDuration, formatYen } from "@/lib/format";
import { summarizeShift } from "@/lib/pay-calculation";
import { getStaffWorkStatus } from "@/lib/staff-work-status";
import type { EmploymentType, Staff, TimeEntry } from "@/types/timecard";

export function AdminScreen({ onLogout }: { onLogout?: () => void }) {
  const {
    staff,
    loading,
    error,
    message,
    setError,
    setMessage,
    load,
    patchStaff,
    openByStaff,
    completedEntries,
  } = useTimecardBootstrap();

  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("part_time");
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [detailStaffId, setDetailStaffId] = useState<string | null>(null);
  const [detailMonthKey, setDetailMonthKey] = useState(() => currentMonthKey());
  const [showOtherStaff, setShowOtherStaff] = useState(false);
  const [showOtherPartTime, setShowOtherPartTime] = useState(false);
  const [showOtherEmployee, setShowOtherEmployee] = useState(false);
  const [showRetiredStaff, setShowRetiredStaff] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStaffRegister, setShowStaffRegister] = useState(false);
  const [showPartTimeMonthlyList, setShowPartTimeMonthlyList] = useState(false);

  const monthOptions = useMemo(
    () => monthOptionsFromEntries(completedEntries),
    [completedEntries],
  );

  const monthEntries = useMemo(
    () => filterCompletedByMonth(completedEntries, monthKey),
    [completedEntries, monthKey],
  );

  const partTimeTotals = useMemo(
    () =>
      aggregateCompleted(
        monthEntries.filter((e) => {
          const s = staff.find((p) => p.id === e.staffId);
          return s?.employmentType !== "employee";
        }),
      ),
    [monthEntries, staff],
  );
  const partTimeMonthlyList = useMemo(() => {
    const byStaff = new Map<
      string,
      {
        staffId: string;
        name: string;
        totalHours: number;
        totalPay: number;
        dayCount: number;
      }
    >();

    for (const entry of monthEntries) {
      const person = staff.find((s) => s.id === entry.staffId);
      if (!person || person.employmentType === "employee") continue;
      if (!entry.clockOut) continue;
      const row = byStaff.get(entry.staffId) ?? {
        staffId: entry.staffId,
        name: entry.staffName,
        totalHours: 0,
        totalPay: 0,
        dayCount: 0,
      };
      const summary = summarizeShift(
        entry.hourlyRate,
        entry.clockIn,
        entry.clockOut,
        entry.breaks,
      );
      row.totalHours += summary.totalHours;
      row.totalPay += summary.payYen;
      row.dayCount += 1;
      byStaff.set(entry.staffId, row);
    }

    return [...byStaff.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [monthEntries, staff]);
  const currentAttendance = useMemo(() => {
    let workingPartTime = 0;
    let workingEmployee = 0;
    let onBreak = 0;

    for (const person of staff) {
      const open = openByStaff.get(person.id);
      if (!open) continue;
      const isOnBreak = open.breaks.some((b) => !b.breakEnd);
      if (isOnBreak) {
        onBreak += 1;
        continue;
      }
      if (person.employmentType === "employee") {
        workingEmployee += 1;
      } else {
        workingPartTime += 1;
      }
    }

    return { workingPartTime, workingEmployee, onBreak };
  }, [staff, openByStaff]);
  const totalWorkingCount =
    currentAttendance.workingPartTime +
    currentAttendance.workingEmployee +
    currentAttendance.onBreak;

  const detailStaff = staff.find((p) => p.id === detailStaffId) ?? null;
  const detailStaffCompletedEntries = useMemo(() => {
    if (!detailStaffId) return [];
    return completedEntries
      .filter((e) => e.staffId === detailStaffId)
      .sort(
        (a, b) =>
          new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
      );
  }, [completedEntries, detailStaffId]);

  const detailMonthOptions = useMemo(
    () => monthOptionsFromEntries(detailStaffCompletedEntries),
    [detailStaffCompletedEntries],
  );

  const detailEntries = useMemo(() => {
    return filterCompletedByMonth(detailStaffCompletedEntries, detailMonthKey);
  }, [detailStaffCompletedEntries, detailMonthKey]);

  const detailTotals = useMemo(
    () => aggregateCompleted(detailEntries),
    [detailEntries],
  );

  const activeSortedStaff = useMemo(() => {
    const rank = (person: Staff) => {
      const status = getStaffWorkStatus(person.id, openByStaff);
      if (status === "on_break") return 0;
      if (status === "working") return 1;
      return 2;
    };
    return staff
      .filter((s) => s.isActive)
      .sort((a, b) => {
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [staff, openByStaff]);

  const priorityStaff = useMemo(
    () =>
      activeSortedStaff.filter((s) =>
        ["on_break", "working"].includes(getStaffWorkStatus(s.id, openByStaff)),
      ),
    [activeSortedStaff, openByStaff],
  );
  const otherStaff = useMemo(
    () =>
      activeSortedStaff.filter(
        (s) => getStaffWorkStatus(s.id, openByStaff) === "off",
      ),
    [activeSortedStaff, openByStaff],
  );
  const otherPartTimeStaff = useMemo(
    () => otherStaff.filter((s) => s.employmentType !== "employee"),
    [otherStaff],
  );
  const otherEmployeeStaff = useMemo(
    () => otherStaff.filter((s) => s.employmentType === "employee"),
    [otherStaff],
  );
  const retiredStaff = useMemo(
    () =>
      staff
        .filter((s) => !s.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [staff],
  );

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await addStaffAction(
      name,
      Number(hourlyRate) || 0,
      employmentType,
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage("保存しました");
    setName("");
    setHourlyRate("");
    setEmploymentType("part_time");
    await load();
  }

  function openDetail(person: Staff) {
    setDetailStaffId((prev) => {
      if (prev === person.id) {
        return null;
      }
      setDetailMonthKey(currentMonthKey());
      return person.id;
    });
  }

  function openDetailByStaffId(staffId: string) {
    setDetailStaffId(staffId);
  }

  async function handleDeleteRetired(person: Staff) {
    const ok = window.confirm(
      "このスタッフを削除しますか？勤務履歴も削除される可能性があります。",
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    const res = await deleteRetiredStaffAction(person.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (detailStaffId === person.id) {
      setDetailStaffId(null);
    }
    setMessage("退職済みスタッフを削除しました");
    await load({ silent: true });
  }

  return (
    <PageShell
      badge="ADMIN"
      title="管理画面"
      subtitle="スタッフ登録・出勤状況・勤務履歴"
      headerEnd={
        onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ログアウト
          </button>
        ) : undefined
      }
    >
      <Alerts error={error} message={message} />

      <section className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">アルバイト合計金額</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">表示月</span>
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-sky-400"
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                  {key === currentMonthKey() ? "（今月）" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {formatMonthLabel(monthKey)}のアルバイト退店済み勤務を集計
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/90 px-2 py-3">
            <p className="text-[11px] text-slate-500">合計金額</p>
            <button
              type="button"
              onClick={() => setShowPartTimeMonthlyList((prev) => !prev)}
              className="mt-0.5 w-full font-semibold tabular-nums text-sky-700 hover:underline"
            >
              {formatYen(partTimeTotals.totalPay)}
            </button>
          </div>
        </div>
        {showPartTimeMonthlyList ? (
          partTimeMonthlyList.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white py-4 text-center text-sm text-slate-500">
              この月のアルバイト勤務はありません
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {partTimeMonthlyList.map((row) => (
                <li
                  key={row.staffId}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-600">
                    合計勤務時間 {formatDuration(row.totalHours)} / 合計給料{" "}
                    {formatYen(row.totalPay)} / 出勤日数 {row.dayCount}日
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">現在の出勤状況</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">総出勤人数</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {totalWorkingCount}人
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">出勤中アルバイト</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {currentAttendance.workingPartTime}人
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">出勤中社員</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {currentAttendance.workingEmployee}人
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">休憩中</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {currentAttendance.onBreak}人
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowStaffRegister((prev) => !prev)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          スタッフ登録を開く
        </button>
        {showStaffRegister ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">スタッフ登録</h2>
            <form onSubmit={handleAddStaff} className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">名前</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：田中"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">時給（円）</span>
            <input
              required={employmentType === "part_time"}
              type="number"
              min={employmentType === "part_time" ? 1 : 0}
              step={1}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder={
                employmentType === "part_time"
                  ? "例：1200"
                  : "社員は入力不要"
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">雇用区分</span>
            <select
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as EmploymentType)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="part_time">アルバイト</option>
              <option value="employee">社員</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            登録する
          </button>
            </form>
          </section>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-base font-semibold text-slate-900">スタッフ一覧</h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>
        ) : activeSortedStaff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            スタッフを登録してください
          </p>
        ) : (
          <>
            {priorityStaff.map((person) => (
              <StaffListItem
                key={person.id}
                person={person}
                detailStaffId={detailStaffId}
                openByStaff={openByStaff}
                onOpenDetail={openDetail}
              />
            ))}

            {otherStaff.length > 0 ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherStaff((prev) => {
                      const next = !prev;
                      if (!next) {
                        setShowOtherPartTime(false);
                        setShowOtherEmployee(false);
                      }
                      return next;
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  その他のスタッフを見る
                </button>
                {showOtherStaff ? (
                  <div className="space-y-2">
                    {otherPartTimeStaff.length > 0 ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowOtherPartTime((prev) => !prev)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          アルバイト一覧
                        </button>
                        {showOtherPartTime ? (
                          <div className="space-y-2">
                            {otherPartTimeStaff.map((person) => (
                              <StaffListItem
                                key={person.id}
                                person={person}
                                detailStaffId={detailStaffId}
                                openByStaff={openByStaff}
                                onOpenDetail={openDetail}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {otherEmployeeStaff.length > 0 ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowOtherEmployee((prev) => !prev)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          社員一覧
                        </button>
                        {showOtherEmployee ? (
                          <div className="space-y-2">
                            {otherEmployeeStaff.map((person) => (
                              <StaffListItem
                                key={person.id}
                                person={person}
                                detailStaffId={detailStaffId}
                                openByStaff={openByStaff}
                                onOpenDetail={openDetail}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowRetiredStaff((prev) => !prev)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          退職済みスタッフ一覧
        </button>
        {showRetiredStaff ? (
          retiredStaff.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
              退職済みスタッフはいません
            </p>
          ) : (
            <div className="space-y-2">
              {retiredStaff.map((person) => (
                <RetiredStaffItem
                  key={person.id}
                  person={person}
                  detailStaffId={detailStaffId}
                  openByStaff={openByStaff}
                  onOpenDetail={openDetail}
                  onDelete={() => void handleDeleteRetired(person)}
                />
              ))}
            </div>
          )
        ) : null}
      </section>

      {detailStaff && (
        <StaffDetailPanel
          staff={detailStaff}
          openEntry={openByStaff.get(detailStaff.id)}
          detailMonthKey={detailMonthKey}
          detailMonthOptions={detailMonthOptions}
          totals={detailTotals}
          entries={detailEntries}
          onDetailMonthChange={setDetailMonthKey}
          onClose={() => setDetailStaffId(null)}
          onReload={() => load({ silent: true })}
          onPatchStaff={patchStaff}
          onError={setError}
          onMessage={setMessage}
        />
      )}

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          勤務履歴を見る
        </button>
        {showHistory ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              勤務履歴（{formatMonthLabel(monthKey)}）
            </h2>
            {monthEntries.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {monthEntries.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    onOpenDetail={() => openDetailByStaffId(entry.staffId)}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">この月の履歴はありません</p>
            )}
          </section>
        ) : null}
      </section>
    </PageShell>
  );
}

function StaffListItem({
  person,
  detailStaffId,
  openByStaff,
  onOpenDetail,
}: {
  person: Staff;
  detailStaffId: string | null;
  openByStaff: Map<string, TimeEntry>;
  onOpenDetail: (person: Staff) => void;
}) {
  const workStatus = getStaffWorkStatus(person.id, openByStaff);
  const isDetail = detailStaffId === person.id;
  return (
    <article>
      <button
        type="button"
        onClick={() => onOpenDetail(person)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40 ${
          isDetail ? "border-sky-300 ring-1 ring-sky-100" : "border-slate-200"
        }`}
      >
        <div>
          <p className="text-lg font-semibold text-slate-900">{person.name}</p>
          <p className="text-sm text-slate-600">
            {person.employmentType === "employee" ? "社員" : "アルバイト"} · 時給{" "}
            {formatYen(person.hourlyRate)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StaffWorkStatusBadge status={workStatus} />
        </div>
      </button>
    </article>
  );
}

function RetiredStaffItem({
  person,
  detailStaffId,
  openByStaff,
  onOpenDetail,
  onDelete,
}: {
  person: Staff;
  detailStaffId: string | null;
  openByStaff: Map<string, TimeEntry>;
  onOpenDetail: (person: Staff) => void;
  onDelete: () => void;
}) {
  const workStatus = getStaffWorkStatus(person.id, openByStaff);
  const isDetail = detailStaffId === person.id;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail(person)}
          className={`flex-1 rounded-xl border p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/40 ${
            isDetail ? "border-sky-300 ring-1 ring-sky-100" : "border-slate-200"
          }`}
        >
          <p className="text-lg font-semibold text-red-600">{person.name}</p>
          <p className="text-sm text-slate-600">
            {person.employmentType === "employee" ? "社員" : "アルバイト"} · 時給{" "}
            {formatYen(person.hourlyRate)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              退職済み
            </span>
            <StaffWorkStatusBadge status={workStatus} />
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          削除
        </button>
      </div>
    </article>
  );
}

function StaffDetailPanel({
  staff,
  openEntry,
  detailMonthKey,
  detailMonthOptions,
  totals,
  entries,
  onDetailMonthChange,
  onClose,
  onReload,
  onPatchStaff,
  onError,
  onMessage,
}: {
  staff: Staff;
  openEntry?: TimeEntry;
  detailMonthKey: string;
  detailMonthOptions: string[];
  totals: ReturnType<typeof aggregateCompleted>;
  entries: TimeEntry[];
  onDetailMonthChange: (next: string) => void;
  onClose: () => void;
  onReload: () => Promise<void>;
  onPatchStaff: (staffId: string, patch: Partial<Staff>) => void;
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const [editingStaff, setEditingStaff] = useState(false);
  const [editName, setEditName] = useState(staff.name);
  const [editHourlyRate, setEditHourlyRate] = useState(String(staff.hourlyRate));
  const [editBasicStartTime, setEditBasicStartTime] = useState(
    staff.basicStartTime ? staff.basicStartTime.slice(0, 5) : "",
  );
  const [editBasicEndTime, setEditBasicEndTime] = useState(
    staff.basicEndTime ? staff.basicEndTime.slice(0, 5) : "",
  );
  const [savingStaff, setSavingStaff] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [breakEndBusy, setBreakEndBusy] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const [isActiveView, setIsActiveView] = useState(staff.isActive);

  const openBreak = openEntry?.breaks.find((b) => !b.breakEnd);
  const isEmployee = staff.employmentType === "employee";
  const employeeBreakHours = useMemo(
    () =>
      entries.reduce((acc, entry) => {
        if (!entry.clockOut) return acc;
        return (
          acc +
          getEmployeeWorkSummary(entry, staff).breakHours
        );
      }, 0),
    [entries, staff],
  );
  const employeeTotals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          if (!entry.clockOut) return acc;
          const s = getEmployeeWorkSummary(entry, staff);
          return {
            totalHours: acc.totalHours + s.totalHours,
            dayCount: acc.dayCount + 1,
          };
        },
        { totalHours: 0, dayCount: 0 },
      ),
    [entries, staff],
  );
  const employeeLateTotals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          const late = Math.max(0, entry.lateMinutes ?? 0);
          return {
            totalLateMinutes: acc.totalLateMinutes + late,
            lateCount: acc.lateCount + (late > 0 ? 1 : 0),
          };
        },
        { totalLateMinutes: 0, lateCount: 0 },
      ),
    [entries],
  );
  const employeeEarlyTotals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          const early = Math.max(0, entry.earlyLeaveMinutes ?? 0);
          return {
            totalEarlyMinutes: acc.totalEarlyMinutes + early,
            earlyCount: acc.earlyCount + (early > 0 ? 1 : 0),
          };
        },
        { totalEarlyMinutes: 0, earlyCount: 0 },
      ),
    [entries],
  );

  useEffect(() => {
    setIsActiveView(staff.isActive);
  }, [staff.id, staff.isActive]);

  useEffect(() => {
    setShowEntries(false);
  }, [staff.id, detailMonthKey]);

  function startStaffEdit() {
    setEditName(staff.name);
    setEditHourlyRate(String(staff.hourlyRate));
    setEditBasicStartTime(staff.basicStartTime ? staff.basicStartTime.slice(0, 5) : "");
    setEditBasicEndTime(staff.basicEndTime ? staff.basicEndTime.slice(0, 5) : "");
    setEditingStaff(true);
    onError(null);
  }

  async function handleStaffSave(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onMessage(null);
    setSavingStaff(true);
    const res = await updateStaffAction(
      staff.id,
      editName,
      isEmployee ? staff.hourlyRate : Number(editHourlyRate) || 0,
      isEmployee ? editBasicStartTime || null : null,
      isEmployee ? editBasicEndTime || null : null,
    );
    setSavingStaff(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setEditingStaff(false);
    onMessage("スタッフ情報を更新しました");
    await onReload();
  }

  async function handleStatusChange(nextActive: boolean) {
    if (nextActive === isActiveView) return;

    const ok = window.confirm(
      nextActive
        ? `${staff.name} を在籍中に戻しますか？\n\nスタッフ画面の名前一覧に再表示されます。`
        : `${staff.name} を退職扱いにしますか？\n\n過去の勤務履歴は残ります。スタッフ画面の名前一覧からは非表示になり、今月以降の通常の一覧にも出なくなります。`,
    );
    if (!ok) return;

    const previous = isActiveView;
    onError(null);
    onMessage(null);
    setIsActiveView(nextActive);
    setStatusBusy(true);
    const res = await setStaffActiveAction(staff.id, nextActive);
    setStatusBusy(false);
    if (!res.ok) {
      setIsActiveView(previous);
      onError(res.error);
      return;
    }
    const savedActive = res.isActive;
    setIsActiveView(savedActive);
    onPatchStaff(staff.id, { isActive: savedActive });
    onMessage(savedActive ? "在籍中に変更しました" : "退職扱いにしました");
    await onReload();
  }

  async function handleManualBreakEnd() {
    onError(null);
    onMessage(null);
    setBreakEndBusy(true);
    const res = await adminManualBreakEndAction(staff.id);
    setBreakEndBusy(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onMessage("休憩を手動終了しました");
    await onReload();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2
            className={`text-base font-semibold ${
              isActiveView ? "text-slate-900" : "text-red-600"
            }`}
          >
            {staff.name}
            <span className="ml-1">（{isEmployee ? "社員" : "アルバイト"}）</span>
            {!isActiveView ? (
              <span className="ml-2 text-sm font-medium text-red-600">退職済み</span>
            ) : null}
          </h2>
          {isEmployee ? (
            <p className="text-sm text-slate-600">{formatMonthLabel(detailMonthKey)}</p>
          ) : (
            <p className="text-sm text-slate-600">
              {formatMonthLabel(detailMonthKey)} · 時給 {formatYen(staff.hourlyRate)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          閉じる
        </button>
      </div>
      {!editingStaff ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">スタッフ状態</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => void handleStatusChange(true)}
                className={`rounded-xl py-3.5 text-sm font-semibold transition disabled:opacity-50 ${
                  isActiveView
                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                在籍中
              </button>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => void handleStatusChange(false)}
                className={`rounded-xl py-3.5 text-sm font-semibold transition disabled:opacity-50 ${
                  !isActiveView
                    ? "bg-red-600 text-white shadow-sm ring-2 ring-red-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                退職済
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={startStaffEdit}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            スタッフ情報編集
          </button>
          {openBreak ? (
            <button
              type="button"
              disabled={breakEndBusy}
              onClick={() => void handleManualBreakEnd()}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              休憩を手動終了
            </button>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleStaffSave} className="mt-3 space-y-2">
          <label className="block text-xs text-slate-600">
            名前
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          {!isEmployee ? (
            <label className="block text-xs text-slate-600">
              時給（円）
              <input
                required
                type="number"
                min={1}
                step={1}
                value={editHourlyRate}
                onChange={(e) => setEditHourlyRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          ) : null}
          {isEmployee ? (
            <>
              <label className="block text-xs text-slate-600">
                基本出勤時間
                <input
                  type="time"
                  value={editBasicStartTime}
                  onChange={(e) => setEditBasicStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="block text-xs text-slate-600">
                基本退勤時間
                <input
                  type="time"
                  value={editBasicEndTime}
                  onChange={(e) => setEditBasicEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingStaff}
              className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              disabled={savingStaff}
              onClick={() => setEditingStaff(false)}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
      <div className="mt-3">
        <label className="text-xs text-slate-600">
          表示月
          <select
            value={detailMonthKey}
            onChange={(e) => onDetailMonthChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            {detailMonthOptions.map((key) => (
              <option key={key} value={key}>
                {formatMonthLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isEmployee ? (
        <div className="mt-3 grid grid-cols-1 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">合計勤務時間</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatDuration(employeeTotals.totalHours)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">出勤日数</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {employeeTotals.dayCount}日
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="text-[11px] text-slate-500">休憩時間</p>
            <p className="mt-0.5 font-semibold tabular-nums">
              {formatDuration(employeeBreakHours)}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 px-2 py-3">
            <p className="text-[11px] text-red-600">合計遅刻時間</p>
            <p className="mt-0.5 font-semibold tabular-nums text-red-700">
              {formatDuration(employeeLateTotals.totalLateMinutes / 60)}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 px-2 py-3">
            <p className="text-[11px] text-red-600">遅刻回数</p>
            <p className="mt-0.5 font-semibold tabular-nums text-red-700">
              {employeeLateTotals.lateCount}回
            </p>
          </div>
          <div className="rounded-xl bg-red-50 px-2 py-3">
            <p className="text-[11px] text-red-600">合計早退時間</p>
            <p className="mt-0.5 font-semibold tabular-nums text-red-700">
              {formatDuration(employeeEarlyTotals.totalEarlyMinutes / 60)}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 px-2 py-3">
            <p className="text-[11px] text-red-600">早退回数</p>
            <p className="mt-0.5 font-semibold tabular-nums text-red-700">
              {employeeEarlyTotals.earlyCount}回
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">通常勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatDuration(totals.regularHours)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">通常勤務分の給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatYen(totals.regularPay)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">深夜勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatDuration(totals.nightHours)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">深夜勤務分の給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {formatYen(totals.nightPay)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">合計勤務時間</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatDuration(totals.totalHours)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2 py-3">
              <p className="text-[11px] text-slate-500">合計給料</p>
              <p className="mt-0.5 font-semibold tabular-nums text-sky-700">
                {formatYen(totals.totalPay)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-slate-600">
            出勤日数{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {totals.dayCount}日
            </span>
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => setShowEntries((prev) => !prev)}
        className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        出勤履歴を見る
      </button>
      {showEntries ? (
        entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">この月の履歴はありません</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {entries.map((entry) => (
              <DetailHistoryRow
                key={entry.id}
                staff={staff}
                entry={entry}
                onReload={onReload}
                onError={onError}
                onMessage={onMessage}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function HistoryRow({
  entry,
  onOpenDetail,
}: {
  entry: TimeEntry;
  onOpenDetail: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpenDetail}
        className="w-full rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left text-sm hover:border-sky-300 hover:bg-sky-50/40"
      >
        <p className="font-medium text-slate-900">{entry.staffName}</p>
        <p className="mt-1 text-xs text-slate-600">
          {formatDateTime(entry.clockIn)} 〜{" "}
          {entry.clockOut ? formatDateTime(entry.clockOut) : "—"}
        </p>
        <EntryHistoryStats entry={entry} />
      </button>
    </li>
  );
}

function DetailHistoryRow({
  staff,
  entry,
  onReload,
  onError,
  onMessage,
}: {
  staff: Staff;
  entry: TimeEntry;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const isEmployee = staff.employmentType === "employee";
  const employeeSummary = isEmployee ? getEmployeeWorkSummary(entry, staff) : null;
  const employeeRange = isEmployee ? getEmployeeDisplayRange(entry, staff) : null;
  const [editing, setEditing] = useState(false);
  const [clockInLocal, setClockInLocal] = useState("");
  const [clockOutLocal, setClockOutLocal] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    if (!entry.clockOut) return;
    setClockInLocal(toDatetimeLocalValue(entry.clockIn));
    setClockOutLocal(toDatetimeLocalValue(entry.clockOut));
    setEditing(true);
    onError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onMessage(null);
    setSaving(true);
    const res = await updateTimeEntryAction(
      entry.id,
      fromDatetimeLocalValue(clockInLocal),
      fromDatetimeLocalValue(clockOutLocal),
    );
    setSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    setEditing(false);
    onMessage("勤務時間を更新しました");
    await onReload();
  }

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-sm">
      <p className="text-xs text-slate-600">
        {isEmployee && employeeRange
          ? `${employeeRange.start.toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })} 〜 ${employeeRange.end.toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : `${formatDateTime(entry.clockIn)} 〜 ${
              entry.clockOut ? formatDateTime(entry.clockOut) : "—"
            }`}
      </p>
      {isEmployee ? (
        <p className="mt-1 text-[11px] text-slate-500">
          実打刻 {formatDateTime(entry.clockIn)} 〜{" "}
          {entry.clockOut ? formatDateTime(entry.clockOut) : "—"}
        </p>
      ) : null}
      {entry.lateMinutes > 0 ? (
        <p className="mt-1 text-xs font-medium text-red-700">
          遅刻 {entry.lateMinutes}分
        </p>
      ) : null}
      {entry.earlyLeaveMinutes > 0 ? (
        <p className="mt-1 text-xs font-medium text-red-700">
          早退 {entry.earlyLeaveMinutes}分
        </p>
      ) : null}
      {isEmployee && employeeSummary ? (
        <div className="mt-2 space-y-1 text-xs text-slate-700">
          <p>通常勤務時間 {formatDuration(employeeSummary.regularHours)}</p>
          <p>深夜勤務時間 {formatDuration(employeeSummary.nightHours)}</p>
          <p>合計勤務時間 {formatDuration(employeeSummary.totalHours)}</p>
        </div>
      ) : (
        <EntryHistoryStats entry={entry} />
      )}
      {!editing ? (
        <button
          type="button"
          onClick={startEdit}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          時間修正
        </button>
      ) : (
        <form onSubmit={handleSave} className="mt-2 space-y-2">
          <label className="block text-xs text-slate-600">
            出勤日時
            <input
              required
              type="datetime-local"
              value={clockInLocal}
              onChange={(e) => setClockInLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="block text-xs text-slate-600">
            退店日時
            <input
              required
              type="datetime-local"
              value={clockOutLocal}
              onChange={(e) => setClockOutLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
