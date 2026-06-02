import Link from "next/link";

export function HomeMenu() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-4 px-4 py-8">
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          TIMECARD
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">タイムカード</h1>
        <p className="mt-2 text-sm text-slate-600">使う画面を選んでください</p>
      </header>

      <Link
        href="/staff"
        className="block rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100/80"
      >
        <p className="text-lg font-semibold text-emerald-900">アルバイト勤怠</p>
        <p className="mt-1 text-sm text-emerald-800/90">
          自分の名前を選んで、出勤・退勤する
        </p>
      </Link>

      <Link
        href="/employee"
        className="block rounded-2xl border border-sky-200 bg-sky-50 px-5 py-6 shadow-sm transition hover:border-sky-300 hover:bg-sky-100/80"
      >
        <p className="text-lg font-semibold text-sky-900">社員勤退</p>
        <p className="mt-1 text-sm text-sky-800/90">
          自分の名前を選んで、出勤・退勤する
        </p>
      </Link>

      <Link
        href="/admin"
        className="block rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <p className="text-lg font-semibold text-slate-900">管理画面</p>
        <p className="mt-1 text-sm text-slate-600">
          スタッフ登録・一覧・勤務履歴を確認する
        </p>
      </Link>
    </div>
  );
}
