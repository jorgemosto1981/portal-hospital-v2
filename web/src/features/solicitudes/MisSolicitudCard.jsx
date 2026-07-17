import { TICKETERA } from "./ticketeraUi.js";
import { chipToneClass, chipToneEstado } from "./misSolicitudesUi.js";

/**
 * @param {{
 *   sol: Record<string, unknown> & {
 *     _titulo?: string;
 *     _fechasTexto?: string;
 *     _estadoLabel?: string;
 *     _gdtLabel?: string;
 *     _requiereAcuse?: boolean;
 *     _motivoRechazo?: string;
 *     _actorRechazoRol?: string;
 *     _bucket?: string;
 *     _relatoInasistenciaInjustificada?: string;
 *   };
 * }} props
 */
export default function MisSolicitudCard({ sol }) {
  const tone = chipToneEstado(sol.estado_solicitud_id, sol);
  const estado = String(sol._estadoLabel || "—");
  const isCierreNegativo = sol._bucket === "rechazada" || sol._bucket === "observada";
  const relato770 = String(sol._relatoInasistenciaInjustificada || "").trim();

  return (
    <li className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{String(sol._titulo || "Solicitud")}</p>
          <p className="mt-1 text-sm text-slate-700">{String(sol._fechasTexto || "—")}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${chipToneClass(tone)}`}
        >
          {estado}
        </span>
      </div>

      <p className={`${TICKETERA.muted} mt-2`}>Grupo: {String(sol._gdtLabel || "—")}</p>

      {isCierreNegativo ? (
        <div className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <p className="text-sm text-slate-800">
            <span className="font-medium">Responsable:</span> {String(sol._actorRechazoRol || "—")}
          </p>
          {sol._motivoRechazo ? (
            <p className="text-sm text-slate-700">
              <span className="font-medium">Motivo:</span> {String(sol._motivoRechazo)}
            </p>
          ) : null}
          {relato770 ? (
            <p className="text-sm font-medium text-rose-900">{relato770}</p>
          ) : null}
          {sol._requiereAcuse ? (
            <p className="text-sm font-medium text-rose-800">
              Pendiente de toma de conocimiento
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
