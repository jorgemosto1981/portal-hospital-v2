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

/** @param {string} ymd */
function formatYmdCorto(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

/** @param {{ codigo_grilla?: string }} row */
function etiquetaArticuloHistorial(row) {
  const cod = String(row?.codigo_grilla || "").trim();
  if (cod === "14") return "14 (LM)";
  return cod || "LM";
}

/**
 * @param {{ historial?: Array<Record<string, unknown>>, anio?: number }} props
 */
function HistorialConsumoCorta({ historial, anio }) {
  const rows = Array.isArray(historial) ? historial : [];
  if (!rows.length) {
    return (
      <p className="text-xs text-slate-500">
        Sin licencias previas en el año{anio ? ` ${anio}` : ""}.
      </p>
    );
  }

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="flex min-h-[44px] cursor-pointer touch-manipulation list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span>Licencias aprobadas en {anio || "—"}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium tabular-nums text-slate-600">
          {rows.length}
        </span>
      </summary>
      <ul className="space-y-1 border-t border-slate-200 px-3 py-2">
        {rows.map((row) => {
          const solId = String(row.sol_id || "");
          const dias = Number(row.dias) || 0;
          const fd = formatYmdCorto(String(row.fecha_desde || ""));
          const fh = formatYmdCorto(String(row.fecha_hasta || ""));
          return (
            <li key={solId} className="text-xs text-slate-700">
              <span className="font-medium">{etiquetaArticuloHistorial(row)}</span>
              {" | "}
              <span className="tabular-nums">
                {fd} al {fh}
              </span>
              {" | "}
              <span className="font-medium tabular-nums">
                {dias} día{dias === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * @param {{ sel: Record<string, unknown> | null, imputacionArticulo?: { articulo_id?: string, version_id_aplicada?: string } | null, causalLargaDuracionId?: string }} props
 */
export default function BandejaAuditorPreviewTramos({ sel, imputacionArticulo, causalLargaDuracionId = "" }) {
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
          causal_larga_duracion_id:
            /^cfg_cld_/i.test(String(causalLargaDuracionId || ""))
              ? String(causalLargaDuracionId).trim()
              : sel?.causal_larga_duracion_id || undefined,
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
    causalLargaDuracionId,
    sel?.es_licencia_incompleta,
  ]);

  if (sel?.es_licencia_incompleta === true) {
    return null;
  }

  const anioHistorial =
    data?.preview?.anio_calendario ??
    (typeof data?.fecha_desde === "string" ? Number(data.fecha_desde.slice(0, 4)) : null);

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
            <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="space-y-1">
                {filaTramo("Al 100%", data.preview.tramos_haberes["100"])}
                {filaTramo("Al 60%", data.preview.tramos_haberes["60"])}
                {filaTramo("Sin remuneración", data.preview.tramos_haberes["0"])}
              </div>
              {typeof data.preview.dias_acumulados_previos === "number" ? (
                <p className="border-t border-slate-200 pt-2 text-xs text-slate-600">
                  Consumo aprobado previo en {data.preview.anio_calendario}:{" "}
                  <strong>{data.preview.dias_acumulados_previos}</strong> días
                </p>
              ) : null}
              <HistorialConsumoCorta
                historial={data.historial_consumo_corta}
                anio={anioHistorial}
              />
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
