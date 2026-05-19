export function Alerts({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {message && !error && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
    </>
  );
}
