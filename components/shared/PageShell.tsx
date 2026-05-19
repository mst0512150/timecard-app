import Link from "next/link";

export function PageShell({
  title,
  subtitle,
  badge,
  backHref = "/",
  headerEnd,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  backHref?: string;
  headerEnd?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 pb-8">
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {badge ?? "TIMECARD"}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
            {headerEnd}
            <Link
              href={backHref}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              トップへ
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
