export function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${
          highlight ? "text-sky-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
