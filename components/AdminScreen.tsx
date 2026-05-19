"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addStaffAction,
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
  staffForAdminList,
} from "@/lib/admin-stats";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";
import { getEntryWorkSummary } from "@/lib/entry-pay";
import { formatDateTime, formatDuration, formatYen } from "@/lib/format";
import type { Staff, TimeEntry } from "@/types/timecard";

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
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [detailStaffId, setDetailStaffId] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => monthOptionsFromEntries(completedEntries),
    [completedEntries],
  );

  const monthEntries = useMemo(
    () => filterCompletedByMonth(completedEntries, monthKey),
    [completedEntries, monthKey],
  );

  const allTotals = useMemo(
    () => aggregateCompleted(monthEntries),
    [monthEntries],
  );

  const detailStaff = staff.find((p) => p.id === detailStaffId) ?? null;
  const detailEntries = useMemo(() => {
    if (!detailStaffId) return [];
    return monthEntries
      .filter((e) => e.staffId === detailStaffId)
      .sort(
        (a, b) =>
          new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
      );
  }, [monthEntries, detailStaffId]);

  const detailTotals = useMemo(
    () => aggregateCompleted(detailEntries),
    [detailEntries],
  );

  const listStaff = useMemo(() => staffForAdminList(staff), [staff]);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await addStaffAction(name, Number(hourlyRate) || 0);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage("保存しました");
    setName("");
    setHourlyRate("");
    await load();
  }

  function openDetail(person: Staff) {
    setDetailStaffId(person.id);
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
          <h2 className="text-base font-semibold text-slate-900">全スタッフ合計</h2>
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
          {formatMonthLabel(monthKey)}の退店済み勤務を集計
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/90 px-2 py-3">
            <p className="text-[11px] text-slate-500">合計金額</p>
            <p className="mt-0.5 font-semibold tabular-nums text-sky-700">
              {formatYen(allTotals.totalPay)}
            </p>
          </div>
          <div className="rounded-xl bg-white/90 px-2 py-3">
            <p className="text-[11px] text-slate-500">合計勤務時間</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {formatDuration(allTotals.totalHours)}
            </p>
          </div>
          <div className="rounded-xl bg-white/90 px-2 py-3">
            <p className="text-[11px] text-slate-500">合計出勤日数</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {allTotals.dayCount}日
            </p>
          </div>
        </div>
      </section>

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
              required
              type="number"
              min={1}
              step={1}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="例：1200"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
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

      <section className="space-y-3">
        <h2 className="px-1 text-base font-semibold text-slate-900">スタッフ一覧</h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>
        ) : listStaff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            スタッフを登録してください
          </p>
        ) : (
          listStaff.map((person) => {
            const isWorking = openByStaff.has(person.id);
            const isDetail = detailStaffId === person.id;

            return (
              <article key={person.id}>
                <button
                  type="button"
                  onClick={() => openDetail(person)}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40 ${
                    isDetail
                      ? "border-sky-300 ring-1 ring-sky-100"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    <p
                      className={`text-lg font-semibold ${
                        person.isActive ? "text-slate-900" : "text-red-600"
                      }`}
                    >
                      {person.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      時給 {formatYen(person.hourlyRate)}
                      {!person.isActive ? (
                        <span className="ml-2 text-red-600">退職済み</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isWorking ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        出勤中
                      </span>
                    ) : null}
                    {!person.isActive ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        退職済み
                      </span>
                    ) : null}
                  </div>
                </button>
              </article>
            );
          })
        )}
      </section>

      {detailStaff && (
        <StaffDetailPanel
          staff={detailStaff}
          monthLabel={formatMonthLabel(monthKey)}
          totals={detailTotals}
          entries={detailEntries}
          onClose={() => setDetailStaffId(null)}
          onReload={() => load({ silent: true })}
          onPatchStaff={patchStaff}
          onError={setError}
          onMessage={setMessage}
        />
      )}

      {monthEntries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            勤務履歴（{formatMonthLabel(monthKey)}）
          </h2>
          <ul className="mt-3 space-y-3">
            {monthEntries.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

function StaffDetailPanel({
  staff,
  monthLabel,
  totals,
  entries,
  onClose,
  onReload,
  onPatchStaff,
  onError,
  onMessage,
}: {
  staff: Staff;
  monthLabel: string;
  totals: ReturnType<typeof aggregateCompleted>;
  entries: TimeEntry[];
  onClose: () => void;
  onReload: () => Promise<void>;
  onPatchStaff: (staffId: string, patch: Partial<Staff>) => void;
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const [editingStaff, setEditingStaff] = useState(false);
  const [editName, setEditName] = useState(staff.name);
  const [editHourlyRate, setEditHourlyRate] = useState(String(staff.hourlyRate));
  const [savingStaff, setSavingStaff] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [isActiveView, setIsActiveView] = useState(staff.isActive);

  useEffect(() => {
    setIsActiveView(staff.isActive);
  }, [staff.id, staff.isActive]);

  function startStaffEdit() {
    setEditName(staff.name);
    setEditHourlyRate(String(staff.hourlyRate));
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
      Number(editHourlyRate) || 0,
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
            {!isActiveView ? (
              <span className="ml-2 text-sm font-medium text-red-600">退職済み</span>
            ) : null}
          </h2>
          <p className="text-sm text-slate-600">
            {monthLabel} · 時給 {formatYen(staff.hourlyRate)}
          </p>
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
      <h3 className="mt-4 text-sm font-semibold text-slate-900">出勤履歴</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">この月の履歴はありません</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.map((entry) => (
            <DetailHistoryRow
              key={entry.id}
              entry={entry}
              onReload={onReload}
              onError={onError}
              onMessage={onMessage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ entry }: { entry: TimeEntry }) {
  const summary = getEntryWorkSummary(entry);
  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm">
      <p className="font-medium text-slate-900">{entry.staffName}</p>
      <p className="mt-1 text-xs text-slate-600">
        {formatDateTime(entry.clockIn)} 〜{" "}
        {entry.clockOut ? formatDateTime(entry.clockOut) : "—"}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-700">
        <span>通常 {formatDuration(summary.regularHours)}</span>
        <span>深夜 {formatDuration(summary.nightHours)}</span>
        <span>合計 {formatDuration(summary.totalHours)}</span>
        <span className="font-semibold text-slate-900">
          {formatYen(summary.payYen)}
        </span>
      </div>
    </li>
  );
}

function DetailHistoryRow({
  entry,
  onReload,
  onError,
  onMessage,
}: {
  entry: TimeEntry;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const summary = getEntryWorkSummary(entry);
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
        {formatDateTime(entry.clockIn)} 〜{" "}
        {entry.clockOut ? formatDateTime(entry.clockOut) : "—"}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-700">
        <span>通常 {formatDuration(summary.regularHours)}</span>
        <span>深夜 {formatDuration(summary.nightHours)}</span>
        <span>合計 {formatDuration(summary.totalHours)}</span>
        <span className="font-semibold text-slate-900">
          {formatYen(summary.payYen)}
        </span>
      </div>
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
