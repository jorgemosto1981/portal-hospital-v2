import { patronSaldoLabel } from "./resolvePatronSaldo.js";

export function CheckinArticuloPatronBadge({ loading, patron, versionId, error }) {
  if (loading) {
    return <p className="text-xs text-slate-500">Leyendo versión publicada del artículo…</p>;
  }
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{error}</p>;
  }
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <span className="font-medium text-slate-900">{patronSaldoLabel(patron)}</span>
      {versionId ? (
        <>
          {" "}
          · <span className="font-mono text-[11px]">{versionId}</span>
        </>
      ) : null}
    </p>
  );
}
