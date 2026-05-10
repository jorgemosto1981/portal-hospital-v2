import ContextNote from "../ContextNote.jsx";
import { useArticulosListaResumen } from "../hooks/useArticulosListaResumen.js";

/**
 * `articulos_interrupcion_permitida_ids`: otros artículos que pueden interrumpir / prevalecer según política.
 */
export default function ArticulosInterrupcionSection({ data, update, fieldError }) {
  const { rows, status, error, recargar } = useArticulosListaResumen();

  const seleccionados = new Set(
    Array.isArray(data.articulos_interrupcion_permitida_ids)
      ? data.articulos_interrupcion_permitida_ids.map(String)
      : [],
  );

  const selfId =
    typeof data.id === "string" && data.id.startsWith("art_") ? data.id : null;

  const candidatos = [...rows]
    .filter((r) => !selfId || r.id !== selfId)
    .sort((a, b) =>
      (a.titulo || "").localeCompare(b.titulo || "", "es", { sensitivity: "base" }),
    );

  const toggle = (artId) => {
    const next = new Set(seleccionados);
    if (next.has(artId)) next.delete(artId);
    else next.add(artId);
    const arr = [...next];
    update.field("articulos_interrupcion_permitida_ids", arr.length ? arr : undefined);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Interrupción por otros artículos</h3>
        <button
          type="button"
          onClick={() => void recargar()}
          disabled={status === "loading"}
          className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50 disabled:opacity-50"
        >
          Recargar lista
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <p className="mb-3 text-xs text-slate-600">
          Marcá artículos que pueden <strong>interrumpir o prevalecer</strong> frente a este trámite cuando
          la política de superposición lo habilita (
          <span className="font-mono text-[11px]">CFG_PS_INTERRUPCION_LISTA_ARTICULO</span>).
        </p>

        {status === "loading" ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : status === "error" ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay otros artículos o falta guardar este documento con id.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
            {candidatos.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 rounded-lg px-2 py-1 text-sm text-slate-800 active:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={seleccionados.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block font-medium">{r.titulo || "(sin título)"}</span>
                    <span className="font-mono text-[11px] text-slate-400">{r.id}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <ContextNote>
          Distinto de <strong>incompatibles</strong>: aquí definís quién puede cortar o sustituir este
          artículo en conflicto operativo.
        </ContextNote>

        {fieldError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {fieldError}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-slate-500">
          Seleccionados: <strong>{seleccionados.size}</strong>.
        </p>
      </div>
    </section>
  );
}
