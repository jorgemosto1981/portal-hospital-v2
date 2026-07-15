import { useState } from "react";
import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";

const MODO_TC = "toma_conocimiento";

/**
 * @param {{
 *   sel: Record<string, unknown> | null,
 *   motivo: string,
 *   setMotivo: (v: string) => void,
 *   procesando: boolean,
 *   onDecidir: (decision: string, extras?: { modalidad_goce_jefe?: string }) => void | Promise<void>,
 * }} props
 */
export default function BandejaJefeSolicitudDetalle({ sel, motivo, setMotivo, procesando, onDecidir }) {
  const [modalidadGoce, setModalidadGoce] = useState("");

  if (!sel) return null;

  const modo = String(sel.modo_resolucion_jefe || "autorizacion").trim();
  const esTc = modo === MODO_TC;
  const codigo = String(sel.codigo_grilla || "").trim().toUpperCase();
  const pideModalidad64 =
    !esTc && (codigo === "64-A" || codigo === "64-B" || codigo.startsWith("64"));

  return (
    <div className="space-y-4 border-t border-blue-100 bg-blue-50/30 px-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del trámite</p>
        <p className="mt-1 text-xs text-slate-600">
          Modo jefe:{" "}
          <span className="font-medium text-slate-800">
            {esTc ? "Toma de conocimiento" : modo === "ninguno" ? "Sin paso jefe" : "Autorización"}
          </span>
        </p>
        <div className="mt-2">
          <BandejaSolicitudExpandDatos sel={sel} variant="jefe" />
        </div>
      </div>

      {sel.puede_decidir === true ? (
        <>
          {pideModalidad64 ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                Modalidad Art. 64 (al aprobar)
              </span>
              <select
                value={modalidadGoce}
                onChange={(e) => setModalidadGoce(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Elegí al aprobar…</option>
                <option value="con_goce">Con goce de haberes (64.a)</option>
                <option value="sin_goce">Sin goce de haberes (64.b)</option>
              </select>
              <span className="block text-xs text-slate-500">
                Norma: el jefe justifica y elige la forma. El motor de saldos cruzados se cableará en el
                siguiente átomo; hoy se registra en la solicitud.
              </span>
            </label>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              {esTc ? "Observación (opcional)" : "Motivo (opcional)"}
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder={esTc ? "Nota de conformidad u observación" : "Observación para auditoría"}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {esTc ? (
              <>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => onDecidir("conforme")}
                  className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-emerald-700 disabled:opacity-50"
                >
                  Conforme (tomé conocimiento)
                </button>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => onDecidir("observado")}
                  className="min-h-11 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 active:bg-amber-100 disabled:opacity-50"
                >
                  Observado
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={procesando || (pideModalidad64 && !modalidadGoce)}
                  onClick={() =>
                    onDecidir("aprobar", pideModalidad64 ? { modalidad_goce_jefe: modalidadGoce } : undefined)
                  }
                  className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-emerald-700 disabled:opacity-50"
                >
                  Aprobar (cierre jerárquico)
                </button>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => onDecidir("rechazar")}
                  className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 active:bg-red-100 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            {esTc
              ? "Art. 63: el derecho nace de la causal legal. Conforme cierra el trámite; Observado lo deja en rechazo operativo para remediar (doc/causal)."
              : "Art. 64 u otros: al aprobar la solicitud queda aprobada; RRHH registra toma de conocimiento. Al rechazar, se anula y se devuelve el saldo Patrón B si correspondía."}
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">Sin acciones disponibles en esta bandeja para este estado.</p>
      )}
    </div>
  );
}
