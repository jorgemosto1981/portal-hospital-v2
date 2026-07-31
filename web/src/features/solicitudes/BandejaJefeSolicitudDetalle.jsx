import { useEffect, useState } from "react";
import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";
import { ARTICULO_64B_ID } from "../../constants/solicitudesArticuloV2.js";

const MODO_TC = "toma_conocimiento";

/**
 * @param {Record<string, unknown> | null} sel
 */
function esSinGoceAnclado(sel) {
  if (!sel) return false;
  const art = String(sel.articulo_id || "").trim();
  const sin = String(sel.articulo_id_sin_goce || "").trim();
  const cod = String(sel.codigo_grilla || "").trim().toUpperCase();
  if (sin && art === sin) return true;
  if (art === ARTICULO_64B_ID) return true;
  if (cod === "64-B" || (cod.startsWith("64-B") && cod.includes("1/2"))) return true;
  if (cod.includes("SIN GOCE")) return true;
  return false;
}

/**
 * @param {{
 *   sel: Record<string, unknown> | null,
 *   motivo: string,
 *   setMotivo: (v: string) => void,
 *   procesando: boolean,
 *   onDecidir: (
 *     decision: string,
 *     extras?: {
 *       modalidad_goce_jefe?: string,
 *       confirma_injustificada?: boolean,
 *       confirma_sin_goce?: boolean,
 *     },
 *   ) => void | Promise<void>,
 * }} props
 */
export default function BandejaJefeSolicitudDetalle({ sel, motivo, setMotivo, procesando, onDecidir }) {
  const [modalidadGoce, setModalidadGoce] = useState("");
  const [confirmRechazo, setConfirmRechazo] = useState(false);
  const [confirmaInjustificada, setConfirmaInjustificada] = useState(false);
  const [confirmSinGoce, setConfirmSinGoce] = useState(false);
  const [confirmaSinGoce, setConfirmaSinGoce] = useState(false);

  const solKey = String(sel?.solicitud_id || sel?.id || "");

  useEffect(() => {
    // Pedido ya anclado a sin goce del par: default sin goce.
    if (esSinGoceAnclado(sel)) {
      setModalidadGoce("sin_goce");
    } else {
      setModalidadGoce("");
    }
    setConfirmRechazo(false);
    setConfirmaInjustificada(false);
    setConfirmSinGoce(false);
    setConfirmaSinGoce(false);
  }, [solKey]);

  if (!sel) return null;

  const modo = String(sel.modo_resolucion_jefe || "autorizacion").trim();
  const esTc = modo === MODO_TC;
  const codigo = String(sel.codigo_grilla || "").trim().toUpperCase();
  const pideModalidad64 =
    !esTc &&
    (sel.articulo_familia_64 === true ||
      Boolean(sel.articulo_id_con_goce && sel.articulo_id_sin_goce) ||
      codigo === "64-A" ||
      codigo === "64-B" ||
      codigo.startsWith("64"));
  /** Pedido ya anclado a sin goce: modalidad fija (no se puede pasar a con goce). */
  const modalidadFijaSinGoce = pideModalidad64 && esSinGoceAnclado(sel);
  const modalidadEfectiva = modalidadFijaSinGoce ? "sin_goce" : modalidadGoce;
  const esSinGoce = pideModalidad64 && modalidadEfectiva === "sin_goce";
  const faltaModalidad64 = pideModalidad64 && !modalidadEfectiva;
  const motivoTrim = String(motivo || "").trim();
  const motivoOk = motivoTrim.length >= 3;
  /** El motivo solo se pide donde es obligatorio: TC, 64-B sin goce y rechazo. */
  const mostrarMotivo = esTc || esSinGoce || confirmRechazo;

  function cerrarConfirmRechazo() {
    setConfirmRechazo(false);
    setConfirmaInjustificada(false);
    if (!esTc && !esSinGoce) setMotivo("");
  }

  function cerrarConfirmSinGoce() {
    setConfirmSinGoce(false);
    setConfirmaSinGoce(false);
  }

  function onChangeModalidad(next) {
    if (modalidadFijaSinGoce) return;
    setModalidadGoce(next);
    setConfirmSinGoce(false);
    setConfirmaSinGoce(false);
    if (next !== "sin_goce" && !esTc && !confirmRechazo) setMotivo("");
  }

  function onClickAprobar() {
    if (faltaModalidad64) return;
    if (esSinGoce) {
      if (!motivoOk) return;
      setConfirmaSinGoce(false);
      setConfirmSinGoce(true);
      return;
    }
    onDecidir(
      "aprobar",
      pideModalidad64 ? { modalidad_goce_jefe: modalidadEfectiva } : undefined,
    );
  }

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
                value={modalidadEfectiva}
                onChange={(e) => onChangeModalidad(e.target.value)}
                disabled={modalidadFijaSinGoce}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-700"
              >
                {!modalidadFijaSinGoce ? (
                  <>
                    <option value="">Seleccione modalidad del Artículo 64</option>
                    <option value="con_goce">Art. 64-A con goce de haberes</option>
                  </>
                ) : null}
                <option value="sin_goce">Art. 64-B sin goce de haberes</option>
              </select>
              {modalidadFijaSinGoce ? (
                <span className="block text-xs text-slate-500">
                  Este pedido ya está anclado a sin goce (64-B): el cupo con goce del mes está
                  usado. No se puede cambiar a 64-A.
                </span>
              ) : null}
            </label>
          ) : null}
          {mostrarMotivo ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {esTc
                  ? "Observación (obligatoria si marcás Observado)"
                  : esSinGoce
                    ? "Justificativo sin goce (obligatorio)"
                    : "Motivo del rechazo (obligatorio)"}
              </span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                required
                aria-required="true"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={
                  esTc
                    ? "Indicá por qué observás el trámite (doc/causal a remediar)"
                    : esSinGoce
                      ? "Justificá por qué autorizás sin goce de haberes (64-B)"
                      : "Indicá por qué rechazás la solicitud"
                }
              />
              {!motivoOk ? (
                <span className="block text-xs text-amber-800">
                  {esTc
                    ? "Para Observado: mínimo 3 caracteres. Queda en el registro del trámite."
                    : esSinGoce
                      ? "Para 64-B sin goce: justificativo obligatorio (mín. 3 caracteres). Queda en auditoría."
                      : "Mínimo 3 caracteres. Queda en el registro del trámite."}
                </span>
              ) : null}
            </label>
          ) : null}
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
                  disabled={procesando || !motivoOk}
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
                  disabled={procesando || faltaModalidad64 || (esSinGoce && !motivoOk)}
                  onClick={onClickAprobar}
                  className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm active:bg-emerald-700 disabled:opacity-50"
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => {
                    setConfirmaInjustificada(false);
                    setConfirmRechazo(true);
                    setConfirmSinGoce(false);
                  }}
                  className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-red-800 active:bg-red-100 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </>
            )}
          </div>

          {confirmSinGoce && !esTc ? (
            <div
              className="space-y-3 rounded-xl border border-amber-300 bg-white p-3 shadow-sm"
              role="dialog"
              aria-labelledby="confirm-64b-title"
            >
              <p id="confirm-64b-title" className="text-sm font-semibold text-amber-950">
                Confirmá autorización sin goce (64-B)
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                Vas a autorizar asuntos particulares <strong>sin goce de haberes</strong>. El agente
                quedará notificado. ¿Confirmás?
              </p>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                <span className="font-medium">Justificativo:</span> {motivoTrim}
              </p>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={confirmaSinGoce}
                  onChange={(e) => setConfirmaSinGoce(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-amber-700 focus:ring-amber-200"
                />
                <span className="text-sm text-slate-800">
                  Confirmo que autorizo sin goce de haberes (64-B) y el justificativo es correcto.
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={procesando}
                  onClick={cerrarConfirmSinGoce}
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={procesando || !confirmaSinGoce || !motivoOk}
                  onClick={() => {
                    onDecidir("aprobar", {
                      modalidad_goce_jefe: "sin_goce",
                      confirma_sin_goce: true,
                    });
                    cerrarConfirmSinGoce();
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-amber-800 disabled:opacity-50"
                >
                  Confirmar 64-B sin goce
                </button>
              </div>
            </div>
          ) : null}

          {confirmRechazo && !esTc ? (
            <div
              className="space-y-3 rounded-xl border border-red-200 bg-white p-3 shadow-sm"
              role="dialog"
              aria-labelledby="confirm-77-0-title"
            >
              <p id="confirm-77-0-title" className="text-sm font-semibold text-red-900">
                Confirmá el rechazo
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                Al rechazar, la inasistencia del agente será injustificada (Art. 77-0). ¿Confirmás?
              </p>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={confirmaInjustificada}
                  onChange={(e) => setConfirmaInjustificada(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-200"
                />
                <span className="text-sm text-slate-800">
                  Entiendo que al rechazar se genera Art. 77-0 inasistencia injustificada.
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={procesando}
                  onClick={cerrarConfirmRechazo}
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={procesando || !confirmaInjustificada || !motivoOk}
                  onClick={() => {
                    onDecidir("rechazar", { confirma_injustificada: true });
                    cerrarConfirmRechazo();
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-red-700 disabled:opacity-50"
                >
                  Confirmar rechazo
                </button>
              </div>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-slate-500">
            {esTc
              ? "Art. 63: el derecho nace de la causal legal. Conforme cierra el trámite; Observado exige motivo (auditoría) y deja el trámite observado para remediar (doc/causal) — no genera Art. 77-0."
              : "Al aprobar elegí la modalidad: Art. 64-A con goce de haberes o Art. 64-B sin goce de haberes (justificativo + doble confirmación). Al rechazar se injustifica la inasistencia."}
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">Sin acciones disponibles en esta bandeja para este estado.</p>
      )}
    </div>
  );
}
