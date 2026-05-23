import {
  buildResumenEjecutivo,
  claseBadgeFase,
  claseItemCheck,
  claseShellFase,
  etiquetaNivel,
  faseAbiertaPorDefecto,
  groupChecksByFase,
  resolveWorstNivel,
} from "./laoAuditoriaDisplayUtils.js";

function ResumenEjecutivo({ resumen }) {
  if (!resumen) return null;
  const shell =
    resumen.tipo === "bloqueante"
      ? "border-red-200 bg-red-50 text-red-950"
      : resumen.tipo === "advertencia"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";
  return (
    <div className={`rounded-xl border p-3 text-sm ${shell}`} role="status" aria-live="polite">
      <p className="font-semibold">{resumen.titulo}</p>
      <p className="mt-1">{resumen.mensaje}</p>
    </div>
  );
}

function FaseAccordion({ grupo }) {
  const abierta = faseAbiertaPorDefecto(grupo.peorNivel);
  return (
    <details
      className={`rounded-xl border p-3 ${claseShellFase(grupo.peorNivel)}`}
      open={abierta}
    >
      <summary className="flex min-h-[44px] cursor-pointer touch-manipulation list-none items-start justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            <span className="font-mono text-sky-800">{grupo.id}</span>
            {" · "}
            {grupo.titulo}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{grupo.subtitulo}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${claseBadgeFase(grupo.peorNivel)}`}
        >
          {etiquetaNivel(grupo.peorNivel)}
        </span>
      </summary>
      <ul className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
        {grupo.checks.map((c, idx) => {
          const nivel = resolveWorstNivel(c?.nivel);
          return (
            <li
              key={`${String(c?.codigo || "check")}-${idx}`}
              className={`rounded-lg border p-2.5 text-sm ${claseItemCheck(nivel)}`}
            >
              <p className="font-medium">{String(c?.codigo || "SIN_CODIGO")}</p>
              {c?.detalle ? <p className="mt-0.5 text-sm opacity-90">{String(c.detalle)}</p> : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * Render pasivo del `motor_snapshot` LAO — agrupado A→E→W→L→S (RFC eje 3).
 * @param {{ snapshot?: Record<string, unknown> | null, compacto?: boolean, variant?: 'wizard' | 'rrhh' }} props
 */
export default function LaoAuditoriaDisplay({ snapshot = null, compacto = false, variant = "wizard" }) {
  if (!snapshot || typeof snapshot !== "object") return null;

  const checks = Array.isArray(snapshot.checks) ? snapshot.checks : [];
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
  const grupos = groupChecksByFase(checks);
  const resumen = buildResumenEjecutivo(checks, warnings);
  const contexto = snapshot.contexto_auditoria && typeof snapshot.contexto_auditoria === "object"
    ? snapshot.contexto_auditoria
    : null;
  const asignacion = snapshot.asignacion && typeof snapshot.asignacion === "object" ? snapshot.asignacion : null;
  const esRrhh = variant === "rrhh";
  const sectionClass = esRrhh
    ? "space-y-3 rounded-xl border border-violet-100 bg-violet-50/20 p-3"
    : "space-y-3 rounded-xl border border-slate-200 bg-white p-4";

  return (
    <section className={sectionClass}>
      {!esRrhh ? (
        <div>
          <h3 className="text-base font-semibold text-slate-900">Auditoría del motor</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Lectura pasiva del snapshot — sin recálculo en pantalla.
          </p>
        </div>
      ) : null}

      <ResumenEjecutivo resumen={resumen} />

      {warnings.length > 0 ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950"
          role="note"
        >
          <p className="font-semibold">Advertencias normativas</p>
          <ul className="mt-2 space-y-2">
            {warnings.map((w, idx) => (
              <li key={`${String(w?.codigo || "warn")}-${idx}`}>
                <span className="font-medium">{String(w?.codigo || "ADVERTENCIA")}:</span>{" "}
                {String(w?.copy || "Revisá el detalle en la fase correspondiente.")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {grupos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Gates por fase</p>
          {grupos.map((g) => (
            <FaseAccordion key={g.id} grupo={g} />
          ))}
        </div>
      ) : null}

      {!compacto && asignacion ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <summary className="min-h-[44px] cursor-pointer touch-manipulation list-none text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 [&::-webkit-details-marker]:hidden">
            Asignación aplicada
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
            <dt>Camino bolsa</dt>
            <dd className="font-mono">{String(asignacion.camino_bolsa ?? asignacion.camino ?? "—")}</dd>
            <dt>Camino asignación</dt>
            <dd className="font-mono">{String(asignacion.camino_asignacion ?? "—")}</dd>
            <dt>Cupo</dt>
            <dd className="tabular-nums">{String(asignacion.cupo ?? "—")}</dd>
            <dt>TSE</dt>
            <dd className="tabular-nums">
              {String(asignacion.dias_tse ?? "—")} / {String(asignacion.tse_minimo_aplicado ?? "—")}
            </dd>
          </dl>
        </details>
      ) : null}

      {!compacto && contexto?.display ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <summary className="min-h-[44px] cursor-pointer touch-manipulation list-none text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 [&::-webkit-details-marker]:hidden">
            Marco normativo (display)
          </summary>
          <div className="mt-2 text-sm text-slate-700">
            <p>
              {String(contexto.display.codigo || "—")} — {String(contexto.display.nombre || "—")}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Inciso: {String(contexto.display.inciso_normativo || "—")}
            </p>
          </div>
        </details>
      ) : null}

      {!compacto ? (
        <p className="text-[10px] text-slate-400">
          Motor {String(snapshot.motor_version || "—")} · Versión{" "}
          <span className="font-mono">{String(snapshot.version_aplicada_id || "—")}</span>
        </p>
      ) : null}
    </section>
  );
}
