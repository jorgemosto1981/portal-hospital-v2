import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callListarContextoPlanGrupo } from "../../services/callables.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";
import {
  labelTurnoToken,
  turnosDisponiblesDesdeRegimen,
} from "./enrichCapaTeoricaLabels.js";
import { mensajeErrorCapaTeorico, capaContextoParaFlujoC } from "./grillaCeldaTeorico.js";
import {
  buildAdicionalOutboxOp,
  capturarEstadoPrevioDia,
  turnosAdicionablesEnDia,
  validarAdicionalTurno,
} from "./grillaAdicionalPreview.js";
import { etiquetaSegmentosCompuesto } from "./grillaCambioTurnoPropioPreview.js";
import {
  COPY_BADGE_SOLO_LECTURA_GSO,
  soloLecturaDesdeGsoEscrituraApi,
} from "./grillaGsoSoloLectura.js";
import { errorMotivoTeoriaOverride } from "./teoriaPermisosGso.js";
import UrgenciaG1AvisoModal from "./UrgenciaG1AvisoModal.jsx";
import GrillaMotivoNovedadSection from "./GrillaMotivoNovedadSection.jsx";
import { componerMotivoNovedadGso } from "./grillaMotivosNovedadCatalogo.js";
import { buildGuardrailNovedadContext } from "./grillaGuardrailsTeoriaUi.js";

/**
 * Flujo C — horas adicionales (RFC §3.3). Solo turno régimen + motivo.
 * @param {{
 *   personaId: string;
 *   personaNombre?: string;
 *   fechaYmd: string;
 *   grupoId: string;
 *   periodo: string;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   turnoVisInicial?: Record<string, unknown> | null;
 *   onCerrar: () => void;
 *   onRegistrado?: () => void;
 *   onAgregarOutbox: (op: Record<string, unknown>) => void;
 *   requiereUrgenciaG1?: boolean;
 *   guardrailNovedadContext?: import("./grillaGuardrailsTeoriaUi.js").GuardrailNovedadContext;
 * }} props
 */
export default function ModalTurnoAdicional({
  personaId,
  personaNombre,
  fechaYmd,
  requiereUrgenciaG1 = false,
  guardrailNovedadContext = buildGuardrailNovedadContext({ puedeModificarTeoria: true }),
  grupoId,
  periodo,
  opsPendientes = [],
  turnoVisInicial = null,
  onCerrar,
  onRegistrado,
  onAgregarOutbox,
}) {
  const [cargando, setCargando] = useState(true);
  const [operando, setOperando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [errorSubmit, setErrorSubmit] = useState("");
  const [capa, setCapa] = useState(null);
  const [visDia, setVisDia] = useState(null);
  const [turnosRegimen, setTurnosRegimen] = useState(/** @type {Record<string, object>} */ ({}));
  const [expectedVersionToken, setExpectedVersionToken] = useState("");
  const [soloLecturaInfo, setSoloLecturaInfo] = useState({ activo: false, detalle: "" });
  const [turnoId, setTurnoId] = useState("");
  const [codigoNovedadId, setCodigoNovedadId] = useState("");
  const [motivoDetalle, setMotivoDetalle] = useState("");

  const etiquetaTurno = useCallback(
    (id) => {
      const meta = turnosRegimen[id] || {};
      return meta.codigo_interno || labelTurnoToken(id) || meta.etiqueta || id;
    },
    [turnosRegimen],
  );

  const cargarDia = useCallback(async () => {
    if (!/^gdt_/i.test(String(grupoId || "").trim())) {
      setErrorCarga("Elegí el cargo (grupo de trabajo) antes de registrar horas adicionales.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga("");
    try {
      const [capaRes, ctx] = await Promise.all([
        leerCapaTeoricaCelda(personaId, fechaYmd, grupoId),
        callListarContextoPlanGrupo({ grupo_id: grupoId, periodo }),
      ]);
      const sl = soloLecturaDesdeGsoEscrituraApi(capaRes.gso_escritura);
      setSoloLecturaInfo({ activo: sl.activo, detalle: sl.detalle || "" });
      setExpectedVersionToken(
        capaRes.concurrencia?.expected_version_token || capaRes.concurrencia?.vis_ultima_sync || "",
      );
      const capaDia = capaRes?.capa_teorica ?? capaRes?.capa_teorica_grupo ?? null;
      setCapa(capaDia);
      setVisDia(capaRes?.vis_dia ?? null);
      const hlg = (ctx?.data?.personas_grupo || []).find((p) => p.persona_id === personaId);
      const regimenId = String(hlg?.regimen_horario_id || "").trim();
      if (!regimenId) {
        setErrorCarga("El agente no tiene régimen horario en este cargo y período.");
        setTurnosRegimen({});
      } else {
        setTurnosRegimen(turnosDisponiblesDesdeRegimen(ctx?.data?.regimenes || {}, regimenId));
      }
      setTurnoId("");
    } catch (e) {
      setErrorCarga(mensajeErrorCapaTeorico(e));
      setCapa(null);
      setVisDia(null);
    } finally {
      setCargando(false);
    }
  }, [personaId, fechaYmd, grupoId, periodo]);

  useEffect(() => {
    void cargarDia();
  }, [cargarDia]);

  const capaEfectiva = useMemo(
    () => capaContextoParaFlujoC(capa, visDia, turnoVisInicial),
    [capa, visDia, turnoVisInicial],
  );

  const { opciones, preview } = useMemo(
    () => turnosAdicionablesEnDia({
      capa: capaEfectiva,
      opsPendientes,
      personaId,
      fechaYmd,
      turnosPorId: turnosRegimen,
    }),
    [capaEfectiva, opsPendientes, personaId, fechaYmd, turnosRegimen],
  );

  useEffect(() => {
    if (!turnoId) return;
    if (!opciones.some((o) => o.turno_id === turnoId)) setTurnoId("");
  }, [opciones, turnoId]);

  const estadoPrevioActual = useMemo(
    () => capturarEstadoPrevioDia(capaEfectiva, turnosRegimen, preview),
    [capaEfectiva, turnosRegimen, preview],
  );

  const resumenTeorico = useMemo(() => {
    if (estadoPrevioActual.etiqueta_preasignada) {
      return estadoPrevioActual.etiqueta_preasignada;
    }
    if (estadoPrevioActual.es_franco) return "Franco";
    if (estadoPrevioActual.es_no_laborable) return "No laborable";
    return "Sin turno preasignado";
  }, [estadoPrevioActual]);

  const hayPreviewPendiente = preview?.tienePreviewPendiente === true;
  const esFeriado = estadoPrevioActual.es_feriado === true;
  const esNoLaborable = estadoPrevioActual.es_no_laborable === true;

  const motivoCompuestoPreview = componerMotivoNovedadGso(codigoNovedadId, motivoDetalle);

  const validacion = useMemo(() => {
    if (!turnoId || cargando) return null;
    return validarAdicionalTurno({
      turnoId,
      capa: capaEfectiva,
      personaId,
      fechaYmd,
      periodo,
      turnosPorId: turnosRegimen,
      opsPendientes,
      motivo: motivoCompuestoPreview,
    });
  }, [
    turnoId,
    capaEfectiva,
    cargando,
    personaId,
    fechaYmd,
    periodo,
    turnosRegimen,
    opsPendientes,
    motivoCompuestoPreview,
  ]);

  const etiquetaAdicional = turnoId
    ? etiquetaSegmentosCompuesto([turnoId], turnosRegimen)
    : "—";

  const handleSubmit = async () => {
    setErrorSubmit("");
    if (!codigoNovedadId) {
      setErrorSubmit("Elegí el tipo de novedad.");
      return;
    }
    const motivo = componerMotivoNovedadGso(codigoNovedadId, motivoDetalle);
    const errMotivo = errorMotivoTeoriaOverride(motivo, requiereUrgenciaG1);
    if (errMotivo) {
      setErrorSubmit(errMotivo);
      return;
    }
    const val = validacion;
    if (!val?.ok) {
      setErrorSubmit(val?.error || "Completá el turno adicional y el motivo.");
      return;
    }
    if (!expectedVersionToken) {
      setErrorSubmit("No se pudo leer la versión de grilla. Recargá e intentá de nuevo.");
      return;
    }
    setOperando(true);
    try {
      const op = buildAdicionalOutboxOp({
        personaId,
        personaLabel: personaNombre || "",
        fechaYmd,
        turnoId: val.turnoId,
        motivo: motivo.trim(),
        expectedVersionToken,
        grupoId,
        periodo,
        estadoPrevio: val.estadoPrevio,
        esUrgenciaOperativa: requiereUrgenciaG1,
      });
      onAgregarOutbox(op);
      toast.success("Turno adicional agregado a cambios pendientes.");
      if (onRegistrado) onRegistrado();
      onCerrar();
    } catch (e) {
      setErrorSubmit(e?.message || "Error al registrar turno adicional.");
    } finally {
      setOperando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="max-h-[min(92vh,44rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="turno-adicional-titulo"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="turno-adicional-titulo" className="text-xl font-semibold text-slate-900">
              Horas adicionales
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Declarás turno extra · RRHH valida fichadas · jefe superior autoriza
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-11 rounded-lg px-3 text-sm text-slate-600 active:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950">
          <span className="font-medium">{personaNombre || personaId}</span>
          <span className="font-mono"> · {fechaYmd}</span>
          {esFeriado ? <span className="ml-1 text-blue-800">· Feriado</span> : null}
          {esNoLaborable ? <span className="ml-1 text-blue-800">· No laborable</span> : null}
        </div>

        {soloLecturaInfo.activo ? (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">🔒 {COPY_BADGE_SOLO_LECTURA_GSO}</p>
            <p className="mt-1 text-xs text-slate-700">{soloLecturaInfo.detalle}</p>
          </div>
        ) : null}
        <UrgenciaG1AvisoModal visible={requiereUrgenciaG1} />

        {hayPreviewPendiente && !cargando ? (
          <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
            Turno teórico según grilla + borradores pendientes (sin aplicar aún).
          </p>
        ) : null}

        {cargando ? (
          <p className="mt-4 text-sm text-slate-500">Cargando día…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <p>
                <span className="text-slate-500">Turno preasignado: </span>
                <span className="font-semibold text-slate-900">{resumenTeorico}</span>
              </p>
              <p className="mt-2">
                <span className="text-slate-500">Turno extra declarado: </span>
                <span className="font-semibold text-blue-800">
                  {turnoId ? `+ ${etiquetaAdicional}` : "—"}
                </span>
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-800">Turno adicional que realiza</h3>
              {opciones.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  No hay turnos disponibles para agregar (colisión con teórico, tope 24 h o borradores pendientes).
                </p>
              ) : (
                <fieldset className="mt-2 space-y-2">
                  <legend className="sr-only">Elegir turno adicional que realiza</legend>
                  {opciones.map((o) => {
                    const lbl = etiquetaTurno(o.turno_id);
                    const activo = turnoId === o.turno_id;
                    return (
                      <label
                        key={o.turno_id}
                        className={`flex min-h-11 touch-manipulation cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm active:bg-slate-50 ${
                          activo
                            ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/30"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="turno-adicional"
                          value={o.turno_id}
                          checked={activo}
                          onChange={() => setTurnoId(o.turno_id)}
                          className="h-5 w-5 shrink-0 accent-blue-700"
                        />
                        <span className="font-medium text-slate-900">+ {lbl}</span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </section>

            <GrillaMotivoNovedadSection
              guardrailContext={guardrailNovedadContext}
              codigoNovedadId={codigoNovedadId}
              onCodigoNovedadIdChange={setCodigoNovedadId}
              motivoDetalle={motivoDetalle}
              onMotivoDetalleChange={setMotivoDetalle}
              requiereUrgenciaG1={requiereUrgenciaG1}
              classNameRing="focus-visible:ring-blue-500/40"
            />

            {validacion && !validacion.ok && validacion.error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                {validacion.error}
              </p>
            ) : null}
          </div>
        )}

        {errorCarga ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {errorCarga}
          </p>
        ) : null}
        {errorSubmit ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {errorSubmit}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-base text-slate-700 active:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              operando
              || cargando
              || soloLecturaInfo.activo
              || !guardrailNovedadContext.puedeModificarTeoria
              || Boolean(errorCarga)
              || !opciones.length
              || !validacion?.ok
            }
            onClick={() => void handleSubmit()}
            className="min-h-11 rounded-xl bg-blue-700 px-5 text-base font-semibold text-white active:bg-blue-800 disabled:opacity-50"
          >
            {operando ? "Agregando…" : "Agregar a cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
