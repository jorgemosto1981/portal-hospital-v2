/**
 * Cómo llegó el trámite a su artículo final.
 *
 * El cruce de modalidad reescribe el artículo del documento, así que sin este
 * bloque RRHH ve un 64-B y no tiene forma de saber que nació como 64-A. Lo
 * mismo con el 77-0: es un trámite aparte y el vínculo con el rechazo que lo
 * originó solo vive en un campo.
 *
 * @param {{
 *   trazabilidad?: Record<string, unknown> | null,
 *   onAbrirRelacionada?: (solicitudId: string) => void,
 * }} props
 */
export default function BandejaRrhhTrazabilidad({ trazabilidad, onAbrirRelacionada }) {
  if (!trazabilidad || typeof trazabilidad !== "object") return null;

  const cruce = trazabilidad.modalidad_64;
  const derivada = String(trazabilidad.art_77_0_derivada_id || "").trim();
  const origen = String(trazabilidad.origen_rechazo_sol_id || "").trim();
  const derivacionPendiente = trazabilidad.art_77_0_derivacion_pendiente === true;

  const linkSolicitud = (id, texto) =>
    typeof onAbrirRelacionada === "function" ? (
      <button
        type="button"
        onClick={() => onAbrirRelacionada(id)}
        className="min-h-[44px] touch-manipulation rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-violet-800 underline-offset-2 active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        {texto}
      </button>
    ) : (
      <span className="break-all font-mono text-xs text-slate-700">{id}</span>
    );

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Trazabilidad del trámite
      </p>

      {cruce ? (
        <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5 text-sm text-slate-800">
          <p>
            Jefatura resolvió <strong>{etiquetaModalidad(cruce.a)}</strong>: el trámite pasó de{" "}
            <strong>{cruce.codigo_origen || "—"}</strong> a{" "}
            <strong>{cruce.codigo_destino || "—"}</strong>.
          </p>
          {cruce.dias ? (
            <p className="text-xs text-slate-600">
              Se devolvieron {textoDias(cruce.dias)} a la bolsa {etiquetaModalidad(cruce.de)} y se
              descontaron de la bolsa {etiquetaModalidad(cruce.a)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {origen ? (
        <div className="space-y-2 text-sm text-slate-800">
          <p>Este trámite se generó por el rechazo de otra solicitud.</p>
          {linkSolicitud(origen, "Ver la solicitud rechazada que lo originó")}
        </div>
      ) : null}

      {derivada ? (
        <div className="space-y-2 text-sm text-slate-800">
          <p>El rechazo derivó en una inasistencia injustificada (Art. 77-0).</p>
          {linkSolicitud(derivada, "Ver el Art. 77-0 derivado")}
        </div>
      ) : null}

      {derivacionPendiente ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          La derivación a Art. 77-0 no se pudo completar
          {trazabilidad.art_77_0_derivacion_error
            ? ` (${trazabilidad.art_77_0_derivacion_error})`
            : ""}
          . El trámite quedó rechazado pero la inasistencia no se registró: hay que darla de alta a
          mano.
        </p>
      ) : null}
    </div>
  );
}

/** @param {unknown} m */
function etiquetaModalidad(m) {
  const v = String(m || "").trim();
  if (v === "con_goce") return "con goce";
  if (v === "sin_goce") return "sin goce";
  return v || "—";
}

/** @param {number} n */
function textoDias(n) {
  return n === 1 ? "1 día" : `${n} días`;
}
