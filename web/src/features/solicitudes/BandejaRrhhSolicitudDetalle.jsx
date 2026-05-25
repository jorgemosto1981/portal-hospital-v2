import { useCallback, useRef } from "react";

import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";
import BandejaRrhhMotorAuditoria from "./BandejaRrhhMotorAuditoria.jsx";
import { snapshotTieneAdvertencias } from "../lao/laoAuditoriaDisplayUtils.js";

/**
 * Panel de acción / detalle dentro del ítem expandido (bandeja RRHH).
 */
export default function BandejaRrhhSolicitudDetalle({ sel, motivo, setMotivo, procesando, onDecidir, onTomaConocimiento }) {
  const notasRef = useRef(null);

  const irANotas = useCallback(() => {
    notasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    notasRef.current?.focus();
  }, []);

  if (!sel) return null;

  const snapshot = sel.motor_snapshot && typeof sel.motor_snapshot === "object" ? sel.motor_snapshot : null;
  const conAdvertenciasMotor = snapshotTieneAdvertencias(snapshot);
  const puedeActuar = sel.puede_aprobar_rechazar === true || sel.puede_registrar_toma_conocimiento === true;
  const labelMotivo = conAdvertenciasMotor && sel.puede_aprobar_rechazar === true
    ? "Notas de RRHH"
    : "Motivo (opcional)";
  const placeholderMotivo = conAdvertenciasMotor
    ? "Documentá la excepción o el criterio RRHH frente a las advertencias del motor."
    : "Observación para auditoría";

  return (
    <div className="space-y-4 border-t border-violet-100 bg-violet-50/30 px-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del trámite</p>
        <div className="mt-2">
          <BandejaSolicitudExpandDatos sel={sel} variant="rrhh" />
        </div>
      </div>

      <BandejaRrhhMotorAuditoria
        snapshot={snapshot}
        motorValidadoEn={sel.motor_validado_en}
        onIrANotas={puedeActuar ? irANotas : undefined}
      />

      {puedeActuar ? (
        <label className="block space-y-1.5" htmlFor="rrhh-notas-motivo">
          <span className="text-sm font-medium text-slate-700">{labelMotivo}</span>
          {conAdvertenciasMotor ? (
            <p className="text-xs text-amber-800">
              Recomendado cuando el motor registró advertencias normativas o institucionales.
            </p>
          ) : null}
          <textarea
            id="rrhh-notas-motivo"
            ref={notasRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            placeholder={placeholderMotivo}
          />
        </label>
      ) : null}

      {sel.puede_aprobar_rechazar === true ? (
        <>
          {sel.bandeja_rrhh_modo === "legacy_rrhh" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Trámite en flujo <strong>legacy</strong> (pendiente RRHH sustantivo).
            </p>
          ) : sel.bandeja_rrhh_modo === "cierre_sustituta" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Huérfana: RRHH actúa como <strong>cierre sustituto</strong>.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir("aprobar")}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50"
            >
              {sel.bandeja_rrhh_modo === "legacy_rrhh" ? "Aprobar (legacy RRHH)" : "Aprobar (cierre sustituto)"}
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir("rechazar")}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 active:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </>
      ) : sel.puede_registrar_toma_conocimiento === true ? (
        <>
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            El jefe ya cerró la solicitud. RRHH registra acuse de conocimiento.
          </p>
          <button
            type="button"
            disabled={procesando}
            onClick={onTomaConocimiento}
            className="min-h-11 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
          >
            Registrar toma de conocimiento
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-500">Sin acciones disponibles en esta bandeja para este estado.</p>
      )}
    </div>
  );
}