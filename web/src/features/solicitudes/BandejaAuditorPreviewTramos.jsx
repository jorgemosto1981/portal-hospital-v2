import { useEffect, useState } from "react";

import { callPrevisualizarClasificacionMedicaAuditor } from "../../services/callables.js";

function filaTramo(label, dias) {
  const n = Number(dias) || 0;
  if (n <= 0) return null;
  return (
    <div className="flex justify-between gap-4 text-sm text-slate-800">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium tabular-nums">{n} día{n === 1 ? "" : "s"}</span>
    </div>
  );
}

/**
 * @param {{ sel: Record<string, unknown> | null, imputacionArticulo?: { articulo_id?: string, version_id_aplicada?: string } | null }} props
 */
export default function BandejaAuditorPreviewTramos({ sel, imputacionArticulo }) {
  const solicitudId = String(sel?.solicitud_id || "").trim();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!/^sol_/i.test(solicitudId) || sel?.es_licencia_incompleta === true) {
      setData(null);
      setError("");
      setCargando(false);
      return undefined;
    }

    let cancelled = false;
    setCargando(true);
    setError("");
    setData(null);

    (async () => {
      try {
        const res = await callPrevisualizarClasificacionMedicaAuditor({
          solicitud_id: solicitudId,
          fecha_desde: sel?.fecha_desde || undefined,
          fecha_hasta: sel?.fecha_hasta || undefined,
          articulo_id: imputacionArticulo?.articulo_id || sel?.articulo_id || undefined,
          version_id_aplicada:
            imputacionArticulo?.version_id_aplicada || sel?.version_aplicada_id || undefined,
          causal_larga_duracion_id: sel?.causal_larga_duracion_id || undefined,
        });
        if (!cancelled) setData(res?.data || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || "No se pudo calcular el preview.");
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    solicitudId,
    sel?.fecha_desde,
    sel?.fecha_hasta,
    imputacionArticulo?.articulo_id,
    imputacionArticulo?.version_id_aplicada,
    sel?.articulo_id,
    sel?.version_aplicada_id,
    sel?.causal_larga_duracion_id,
    sel?.es_licencia_incompleta,
  ]);

  if (sel?.es_licencia_incompleta === true) {
    return null;
  }

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Preview normativo (Art. 14 / episodio)
      </p>
      <p className="text-xs text-slate-500">Solo informativo — no registra dictamen ni consume cupo.</p>

      {cargando ? <p className="text-sm text-slate-600">Calculando tramos…</p> : null}
      {error ? <p className="text-sm text-amber-900">{error}</p> : null}

      {data?.ok !== false && data?.preview ? (
        <div className="space-y-2">
          {data.modo_preview === "corta_anual" && data.preview.tramos_haberes ? (
            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2">
              {filaTramo("Al 100%", data.preview.tramos_haberes["100"])}
              {filaTramo("Al 60%", data.preview.tramos_haberes["60"])}
              {filaTramo("Sin remuneración", data.preview.tramos_haberes["0"])}
              {typeof data.preview.dias_acumulados_previos === "number" ? (
                <p className="border-t border-slate-200 pt-2 text-xs text-slate-600">
                  Consumo aprobado previo en {data.preview.anio_calendario}:{" "}
                  <strong>{data.preview.dias_acumulados_previos}</strong> días
                </p>
              ) : null}
            </div>
          ) : null}
          {data.mensaje_ui ? <p className="text-sm text-slate-800">{data.mensaje_ui}</p> : null}
          {data.requiere_junta_medica === true ? (
            <p className="text-xs font-medium text-violet-800">Derivación a junta médica (&gt;15 días).</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
