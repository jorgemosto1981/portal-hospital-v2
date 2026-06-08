import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callListarContextoPlanGrupo } from "../../services/callables.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";
import {
  enrichCapaTeoricaLabels,
  turnosDisponiblesDesdeRegimen,
} from "./enrichCapaTeoricaLabels.js";
import { mensajeErrorCapaTeorico, resumenTeoricoCorta } from "./grillaCeldaTeorico.js";
import {
  buildIntercambioGuardiaOutboxOp,
  capaElegibleIntercambioGuardia,
  horasTotalesSegmentos,
  regimenPermiteIntercambioGuardia,
  rangoFechasMes,
  validarIntercambioGuardia,
} from "./grillaCoberturaParcialPreview.js";
import { proyectarDiaConOpsPendientes } from "./grillaCambioTurnoPropioPreview.js";
import { useIntercambioGuardiaDestino } from "./useIntercambioGuardiaDestino.js";
import {
  COPY_BADGE_SOLO_LECTURA_GSO,
  soloLecturaDesdeGsoEscrituraApi,
} from "./grillaGsoSoloLectura.js";
import { errorMotivoTeoriaOverride } from "./teoriaPermisosGso.js";
import UrgenciaG1AvisoModal from "./UrgenciaG1AvisoModal.jsx";

/**
 * Flujo A — intercambio de guardia bilateral (RFC §3.1).
 * @param {{
 *   personaOrigenId: string;
 *   personaOrigenLabel?: string;
 *   fechaDestinoYmd: string;
 *   grupoId: string;
 *   periodo: string;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   onCerrar: () => void;
 *   onRegistrado?: () => void;
 *   onDesactualizado?: () => void;
 *   onAgregarOutbox: (op: Record<string, unknown>) => void;
 *   requiereUrgenciaG1?: boolean;
 * }} props
 */
export default function ModalCoberturaParcial({
  personaOrigenId,
  personaOrigenLabel,
  fechaYmd,
  requiereUrgenciaG1 = false,
  grupoId,
  periodo,
  opsPendientes = [],
  onCerrar,
  onRegistrado,
  onDesactualizado,
  onAgregarOutbox,
}) {
  const [cargandoOrigen, setCargandoOrigen] = useState(true);
  const [operando, setOperando] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState("");
  const [errorOrigen, setErrorOrigen] = useState("");
  const [capaOrigen, setCapaOrigen] = useState(null);
  const [segmentosOrigen, setSegmentosOrigen] = useState([]);
  const [turnosRegimenOrigen, setTurnosRegimenOrigen] = useState(/** @type {Record<string, object>} */ ({}));
  const [regimenHorarioOrigenId, setRegimenHorarioOrigenId] = useState("");
  const [regimenesIdx, setRegimenesIdx] = useState(/** @type {Record<string, object>} */ ({}));
  const [expectedTokenOrigen, setExpectedTokenOrigen] = useState("");
  const [soloLecturaInfo, setSoloLecturaInfo] = useState({ activo: false, detalle: "" });
  const [personasGrupo, setPersonasGrupo] = useState([]);
  const [selOrigen, setSelOrigen] = useState(() => new Set());
  const [selDestino, setSelDestino] = useState(() => new Set());
  const [personaDestinoId, setPersonaDestinoId] = useState("");
  const [fechaDestinoYmd, setFechaDestinoYmd] = useState(fechaYmd);
  const [motivo, setMotivo] = useState("");

  const rangoMes = useMemo(() => rangoFechasMes(periodo), [periodo]);
  const segmentosCedidosOrigen = useMemo(() => [...selOrigen], [selOrigen]);
  const segmentosCedidosDestino = useMemo(() => [...selDestino], [selDestino]);

  const destino = useIntercambioGuardiaDestino({
    personaDestinoId,
    fechaDestinoYmd,
    grupoId,
    periodo,
    regimenHorarioIdOrigen: regimenHorarioOrigenId,
    opsPendientes,
    enabled: Boolean(personaDestinoId && fechaDestinoYmd && grupoId && regimenHorarioOrigenId),
  });

  const previewOrigen = useMemo(
    () => proyectarDiaConOpsPendientes(
      capaOrigen,
      opsPendientes,
      personaOrigenId,
      fechaYmd,
      turnosRegimenOrigen,
    ),
    [capaOrigen, opsPendientes, personaOrigenId, fechaYmd, turnosRegimenOrigen],
  );

  useEffect(() => {
    if (!capaOrigen || cargandoOrigen) return;
    const activos = previewOrigen.segmentosCapa.filter((s) =>
      previewOrigen.segmentoIds.includes(String(s.segmento_id || "")),
    );
    setSegmentosOrigen(enrichCapaTeoricaLabels(activos, turnosRegimenOrigen));
    setSelOrigen((prev) => {
      const next = new Set([...prev].filter((id) => previewOrigen.segmentoIds.includes(id)));
      return next;
    });
  }, [capaOrigen, cargandoOrigen, previewOrigen, turnosRegimenOrigen]);

  const cargarOrigen = useCallback(async () => {
    if (!/^gdt_/i.test(String(grupoId || "").trim())) {
      setErrorOrigen("Elegí el cargo (grupo de trabajo) antes del intercambio.");
      setCargandoOrigen(false);
      return;
    }
    setCargandoOrigen(true);
    setErrorOrigen("");
    try {
      const [capaRes, ctx] = await Promise.all([
        leerCapaTeoricaCelda(personaOrigenId, fechaYmd, grupoId),
        callListarContextoPlanGrupo({ grupo_id: grupoId, periodo }),
      ]);
      const sl = soloLecturaDesdeGsoEscrituraApi(capaRes.gso_escritura);
      setSoloLecturaInfo({ activo: sl.activo, detalle: sl.detalle || "" });
      setExpectedTokenOrigen(
        capaRes.concurrencia?.expected_version_token || capaRes.concurrencia?.vis_ultima_sync || "",
      );
      const capa = capaRes?.capa_teorica ?? capaRes?.capa_teorica_grupo ?? null;
      setCapaOrigen(capa);
      const regimenes = ctx?.data?.regimenes || {};
      setRegimenesIdx(regimenes);
      const hlg = (ctx?.data?.personas_grupo || []).find((p) => p.persona_id === personaOrigenId);
      const regimenOrigen = String(hlg?.regimen_horario_id || "").trim();
      setRegimenHorarioOrigenId(regimenOrigen);
      if (!regimenOrigen) {
        setErrorOrigen("El agente 1 no tiene régimen horario en este cargo y período.");
      }
      const turnosMap = turnosDisponiblesDesdeRegimen(regimenes, regimenOrigen);
      setTurnosRegimenOrigen(turnosMap);
      const preview = proyectarDiaConOpsPendientes(capa, opsPendientes, personaOrigenId, fechaYmd, turnosMap);
      const eleg = capaElegibleIntercambioGuardia(capa, preview);
      if (!eleg.ok) {
        setErrorOrigen(eleg.error || "El día origen no es elegible para intercambio.");
      }
      setSelOrigen(new Set());
      setPersonasGrupo(ctx?.data?.personas_grupo || []);
    } catch (e) {
      setErrorOrigen(mensajeErrorCapaTeorico(e));
    } finally {
      setCargandoOrigen(false);
    }
  }, [personaOrigenId, fechaYmd, grupoId, periodo, opsPendientes]);

  useEffect(() => {
    void cargarOrigen();
  }, [cargarOrigen]);

  const personasMismoRegimen = useMemo(
    () => personasGrupo.filter(
      (p) => p.persona_id !== personaOrigenId
        && String(p.regimen_horario_id || "").trim() === regimenHorarioOrigenId,
    ),
    [personasGrupo, personaOrigenId, regimenHorarioOrigenId],
  );

  const hayParejaRegimen = personasMismoRegimen.length > 0;
  const unicoAgente2 = personasMismoRegimen.length === 1;

  const bloqueoRegimen = useMemo(
    () => regimenPermiteIntercambioGuardia(regimenHorarioOrigenId, regimenesIdx),
    [regimenHorarioOrigenId, regimenesIdx],
  );
  const intercambioHabilitado = bloqueoRegimen.ok && hayParejaRegimen;

  const etiquetaAgenteGrupo = useCallback((p) => {
    const nombre = p.persona_label || p.persona_id;
    return p.persona_dni ? `${nombre} · DNI ${p.persona_dni}` : nombre;
  }, []);

  useEffect(() => {
    if (cargandoOrigen) return;
    if (personasMismoRegimen.length === 1) {
      setPersonaDestinoId(personasMismoRegimen[0].persona_id);
      return;
    }
    setPersonaDestinoId((prev) => {
      if (!prev) return "";
      return personasMismoRegimen.some((p) => p.persona_id === prev) ? prev : "";
    });
  }, [cargandoOrigen, personasMismoRegimen]);
  useEffect(() => {
    setSelDestino(new Set());
  }, [personaDestinoId, fechaDestinoYmd]);

  const segsCapaOrigen = useMemo(() => previewOrigen.segmentosCapa, [previewOrigen]);
  const segsCapaDestino = useMemo(
    () => destino.previewDestino?.segmentosCapa
      || (Array.isArray(destino.capaDestino?.segmentos) ? destino.capaDestino.segmentos : []),
    [destino.previewDestino, destino.capaDestino],
  );

  const horasCedeOrigen = useMemo(
    () => horasTotalesSegmentos(segmentosCedidosOrigen, turnosRegimenOrigen, segsCapaOrigen),
    [segmentosCedidosOrigen, turnosRegimenOrigen, segsCapaOrigen],
  );
  const horasCedeDestino = useMemo(
    () => horasTotalesSegmentos(segmentosCedidosDestino, destino.turnosRegimenDestino, segsCapaDestino),
    [segmentosCedidosDestino, destino.turnosRegimenDestino, segsCapaDestino],
  );

  const validacion = useMemo(() => {
    if (!personaDestinoId || destino.loading || destino.error || !destino.elegibilidad.ok) return null;
    if (!segmentosCedidosOrigen.length || !segmentosCedidosDestino.length) return null;
    return validarIntercambioGuardia({
      personaOrigenId,
      personaDestinoId,
      fechaOrigenYmd: fechaYmd,
      fechaDestinoYmd,
      periodo,
      segmentosCedidosOrigen,
      segmentosCedidosDestino,
      capaOrigen,
      capaDestino: destino.capaDestino,
      turnosPorIdOrigen: turnosRegimenOrigen,
      turnosPorIdDestino: destino.turnosRegimenDestino,
      regimenHorarioIdOrigen: regimenHorarioOrigenId,
      regimenHorarioIdDestino: destino.regimenHorarioDestinoId,
      regimenesIdx,
      opsPendientes,
    });
  }, [
    personaDestinoId,
    destino.loading,
    destino.error,
    destino.elegibilidad.ok,
    destino.capaDestino,
    destino.turnosRegimenDestino,
    destino.regimenHorarioDestinoId,
    regimenesIdx,
    opsPendientes,
    segmentosCedidosOrigen,
    segmentosCedidosDestino,
    personaOrigenId,
    fechaYmd,
    fechaDestinoYmd,
    periodo,
    capaOrigen,
    turnosRegimenOrigen,
  ]);

  const resumenOrigen = useMemo(
    () => previewOrigen.etiqueta || resumenTeoricoCorta(capaOrigen, turnosRegimenOrigen) || "—",
    [previewOrigen.etiqueta, capaOrigen, turnosRegimenOrigen],
  );

  const hayPreviewPendiente = previewOrigen.tienePreviewPendiente
    || destino.previewDestino?.tienePreviewPendiente;

  const toggleSet = (setter, id) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setErrorSubmit("");
    const errMotivo = errorMotivoTeoriaOverride(motivo, requiereUrgenciaG1);
    if (errMotivo) {
      setErrorSubmit(errMotivo);
      return;
    }
    const val = validacion;
    if (!val?.ok) {
      setErrorSubmit(val?.error || "Completá el intercambio con carga equivalente.");
      return;
    }
    if (!expectedTokenOrigen || !destino.expectedVersionToken) {
      setErrorSubmit("No se pudo leer la versión de uno de los días. Recargá e intentá de nuevo.");
      return;
    }
    setOperando(true);
    try {
      const personaDestinoLabel = personasMismoRegimen.find(
        (p) => p.persona_id === personaDestinoId,
      )?.persona_label || "";
      const op = buildIntercambioGuardiaOutboxOp({
        personaOrigenId,
        personaDestinoId,
        personaOrigenLabel: personaOrigenLabel || "",
        personaDestinoLabel,
        fechaOrigenYmd: fechaYmd,
        fechaDestinoYmd,
        segmentosCedidosOrigen: val.segmentosCedidosOrigen,
        segmentosCedidosDestino: val.segmentosCedidosDestino,
        motivo: motivo.trim(),
        expectedVersionTokenOrigen: expectedTokenOrigen,
        expectedVersionTokenDestino: destino.expectedVersionToken,
        grupoId,
        periodo,
        esUrgenciaOperativa: requiereUrgenciaG1,
      });
      onAgregarOutbox(op);
      toast.success("Intercambio agregado a cambios pendientes.");
      if (onRegistrado) onRegistrado();
      onCerrar();
    } catch (e) {
      const msg = e?.message || "Error al registrar intercambio.";
      if (msg.includes("ASI-CONC")) {
        setErrorSubmit(msg);
        toast.error("La grilla cambió. Se refrescó la vista.");
        if (onDesactualizado) onDesactualizado();
        return;
      }
      setErrorSubmit(msg);
    } finally {
      setOperando(false);
    }
  };

  const destinoListo = Boolean(
    personaDestinoId && !destino.loading && !destino.error && destino.elegibilidad.ok,
  );
  const equilibrado = horasCedeOrigen > 0 && horasCedeOrigen === horasCedeDestino;
  const desequilibrado = horasCedeOrigen > 0 && horasCedeDestino > 0 && horasCedeOrigen !== horasCedeDestino;

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
        aria-labelledby="intercambio-guardia-titulo"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="intercambio-guardia-titulo" className="text-xl font-semibold text-slate-900">
              Intercambio de guardia
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">Swap bilateral · mismo mes y cargo</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-11 rounded-lg px-3 text-sm text-slate-600 active:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span className="font-medium">Agente 1: </span>
          {personaOrigenLabel || personaOrigenId}
          <span className="font-mono"> · {fechaYmd}</span>
          <span className="text-indigo-800"> · {cargandoOrigen ? "…" : resumenOrigen}</span>
        </div>

        {soloLecturaInfo.activo ? (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">🔒 {COPY_BADGE_SOLO_LECTURA_GSO}</p>
            <p className="mt-1 text-xs text-slate-700">{soloLecturaInfo.detalle}</p>
          </div>
        ) : null}
        <UrgenciaG1AvisoModal visible={requiereUrgenciaG1} />
        {hayPreviewPendiente && !cargandoOrigen ? (
          <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
            Tramos según grilla + borradores pendientes (sin aplicar aún).
          </p>
        ) : null}

        {cargandoOrigen ? (
          <p className="mt-4 text-sm text-slate-500">Cargando día origen…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-sm font-semibold text-slate-800">1. Agente 2 y fecha</h3>
              {!regimenHorarioOrigenId ? (
                <p className="mt-2 text-xs text-amber-800">Sin régimen horario en el agente 1.</p>
              ) : !bloqueoRegimen.ok ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {bloqueoRegimen.error}
                </p>
              ) : !hayParejaRegimen ? (
                <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  No hay otros agentes con el mismo régimen horario en este cargo.
                </p>
              ) : (
                <>
                  {unicoAgente2 ? (
                    <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                      {etiquetaAgenteGrupo(personasMismoRegimen[0])}
                    </p>
                  ) : (
                    <select
                      value={personaDestinoId}
                      onChange={(e) => setPersonaDestinoId(e.target.value)}
                      className="mt-2 flex min-h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      <option value="">Elegí agente 2…</option>
                      {personasMismoRegimen.map((p) => (
                        <option key={p.persona_id} value={p.persona_id}>
                          {etiquetaAgenteGrupo(p)}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="mt-3 block text-xs font-medium text-slate-600">Fecha agente 2</label>
                  <input
                    type="date"
                    value={fechaDestinoYmd}
                    min={rangoMes.min}
                    max={rangoMes.max}
                    onChange={(e) => setFechaDestinoYmd(e.target.value)}
                    disabled={!personaDestinoId}
                    className="mt-1 flex min-h-11 w-full touch-manipulation rounded-xl border border-slate-200 px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50"
                  />
                  {personaDestinoId && destino.loading ? (
                    <p className="mt-2 text-xs text-slate-500">Cargando día agente 2…</p>
                  ) : null}
                  {personaDestinoId && !destino.loading && destino.error ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                      {destino.error}
                    </p>
                  ) : null}
                  {destinoListo ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Turno del día: <span className="font-medium text-slate-800">{destino.resumenDestino}</span>
                    </p>
                  ) : null}
                </>
              )}
            </section>

            {intercambioHabilitado ? (
            <>
            <section>
              <h3 className="text-sm font-semibold text-slate-800">2. Tramos a ceder (swap)</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-700">Agente 1 cede</p>
                  {segmentosOrigen.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">Sin tramos materializados.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {segmentosOrigen.map((seg) => (
                        <li key={seg.segmento_id}>
                          <label className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-2 py-1 text-sm active:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={selOrigen.has(seg.segmento_id)}
                              onChange={() => toggleSet(setSelOrigen, seg.segmento_id)}
                              className="h-5 w-5 accent-violet-700"
                            />
                            <span>{seg.checkbox_label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    Cede: <span className="font-medium">{horasCedeOrigen || 0} h</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-700">Agente 2 cede</p>
                  {!personaDestinoId ? (
                    <p className="mt-2 text-xs text-slate-500">Elegí agente 2 y fecha.</p>
                  ) : destino.loading ? (
                    <p className="mt-2 text-xs text-slate-500">Calculando tramos…</p>
                  ) : !destino.elegibilidad.ok ? (
                    <p className="mt-2 text-xs text-amber-800">Día no elegible para intercambio.</p>
                  ) : destino.segmentosDestino.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">Sin tramos materializados.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {destino.segmentosDestino.map((seg) => (
                        <li key={seg.segmento_id}>
                          <label className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-2 py-1 text-sm active:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={selDestino.has(seg.segmento_id)}
                              onChange={() => toggleSet(setSelDestino, seg.segmento_id)}
                              className="h-5 w-5 accent-violet-700"
                            />
                            <span>{seg.checkbox_label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    Cede: <span className="font-medium">{horasCedeDestino || 0} h</span>
                  </p>
                </div>
              </div>

              {horasCedeOrigen > 0 || horasCedeDestino > 0 ? (
                <p
                  className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${
                    equilibrado
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : desequilibrado
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {equilibrado
                    ? `Equilibrado (${horasCedeOrigen} h ↔ ${horasCedeDestino} h)`
                    : desequilibrado
                      ? `Carga distinta: ${horasCedeOrigen} h ↔ ${horasCedeDestino} h — deben coincidir.`
                      : "Marcá tramos en ambos lados para ver el balance."}
                </p>
              ) : null}

              {validacion?.ok && validacion.preview ? (
                <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                  <p>
                    <span className="text-slate-500">Agente 1 tras swap: </span>
                    cede {validacion.preview.origen.cede} → recibe {validacion.preview.origen.recibe}
                  </p>
                  <p>
                    <span className="text-slate-500">Agente 2 tras swap: </span>
                    cede {validacion.preview.destino.cede} → recibe {validacion.preview.destino.recibe}
                  </p>
                </div>
              ) : null}
              {validacion && !validacion.ok && validacion.error ? (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                  {validacion.error}
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-800">
                3. Motivo
                <span className="font-normal text-rose-700"> *</span>
              </h3>
              <textarea
                rows={2}
                maxLength={500}
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={
                  requiereUrgenciaG1
                    ? "Justificá la urgencia operativa (obligatorio)…"
                    : "Motivo operativo (obligatorio)…"
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              />
            </section>
            </>
            ) : null}
          </div>
        )}

        {errorOrigen ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {errorOrigen}
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
          {intercambioHabilitado ? (
          <button
            type="button"
            disabled={
              operando
              || cargandoOrigen
              || soloLecturaInfo.activo
              || Boolean(errorOrigen)
              || !regimenHorarioOrigenId
              || !personaDestinoId
              || destino.loading
              || Boolean(destino.error)
              || !destino.elegibilidad.ok
              || !validacion?.ok
            }
            onClick={() => void handleSubmit()}
            className="min-h-11 rounded-xl bg-violet-700 px-5 text-base font-semibold text-white active:bg-violet-800 disabled:opacity-50"
          >
            {operando ? "Agregando…" : "Agregar a cambios"}
          </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
