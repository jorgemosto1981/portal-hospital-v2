import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { callListarContextoPlanGrupo } from "../../services/callables.js";
import {
  enrichCapaTeoricaLabels,
  labelTurnoToken,
  turnosDisponiblesDesdeRegimen,
} from "./enrichCapaTeoricaLabels.js";
import { resumenTeoricoCorta } from "./grillaCeldaTeorico.js";
import {
  buildReemplazoPropioOutboxOp,
  etiquetaSaldoOrigenTrasTraslado,
  origenQuedaFrancoCompleto,
  proyectarDiaConOpsPendientes,
  rangoFechasMes,
  TOPE_HORAS_DIA,
} from "./grillaCambioTurnoPropioPreview.js";
import { useProyeccionDiaDestino } from "./useProyeccionDiaDestino.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";
import {
  COPY_BADGE_SOLO_LECTURA_GSO,
  soloLecturaDesdeGsoEscrituraApi,
} from "./grillaGsoSoloLectura.js";
import { errorMotivoTeoriaOverride } from "./teoriaPermisosGso.js";
import UrgenciaG1AvisoModal from "./UrgenciaG1AvisoModal.jsx";

/**
 * Flujo B — cambio de turno propio (origen → destino, aditivo, franco en origen).
 * @param {{
 *   personaId: string;
 *   fechaOrigenYmd: string;
 *   personaNombre?: string;
 *   grupoId: string;
 *   periodo: string;
 *   opsPendientes: Array<Record<string, unknown>>;
 *   onCerrar: () => void;
 *   onAgregarOutbox: (op: Record<string, unknown>) => void;
 *   requiereUrgenciaG1?: boolean;
 * }} props
 */
export default function ModalCambioTurnoPropio({
  personaId,
  fechaOrigenYmd,
  personaNombre,
  requiereUrgenciaG1 = false,
  grupoId,
  periodo,
  opsPendientes,
  onCerrar,
  onAgregarOutbox,
}) {
  const [fechaDestinoYmd, setFechaDestinoYmd] = useState(fechaOrigenYmd);
  const [capaOrigen, setCapaOrigen] = useState(null);
  const [segmentosOrigen, setSegmentosOrigen] = useState([]);
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [motivo, setMotivo] = useState("");
  const [cargandoOrigen, setCargandoOrigen] = useState(true);
  const [errorOrigen, setErrorOrigen] = useState("");
  /** Solo turnos del régimen del agente (`turnos_disponibles` del plan). */
  const [turnosRegimenPorId, setTurnosRegimenPorId] = useState(/** @type {Record<string, object>} */ ({}));
  const [operando, setOperando] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState("");
  const [expectedVersionTokenOrigen, setExpectedVersionTokenOrigen] = useState("");
  const [turnosDestinoSel, setTurnosDestinoSel] = useState(() => new Set());
  const [avisoPreseleccion, setAvisoPreseleccion] = useState("");
  const [sinRegimen, setSinRegimen] = useState(false);
  const [soloLecturaInfo, setSoloLecturaInfo] = useState({ activo: false, detalle: "" });

  const rangoMes = useMemo(() => rangoFechasMes(periodo), [periodo]);
  const segmentosTrasladar = useMemo(() => [...seleccionados], [seleccionados]);
  const idsOrigenActivos = useMemo(
    () => segmentosOrigen.map((s) => s.segmento_id),
    [segmentosOrigen],
  );
  const francoOrigenCompleto = useMemo(
    () => origenQuedaFrancoCompleto(idsOrigenActivos, segmentosTrasladar),
    [idsOrigenActivos, segmentosTrasladar],
  );
  const saldoOrigenLabel = useMemo(
    () => etiquetaSaldoOrigenTrasTraslado(idsOrigenActivos, segmentosTrasladar, turnosRegimenPorId),
    [idsOrigenActivos, segmentosTrasladar, turnosRegimenPorId],
  );

  const turnosIdDestino = useMemo(() => [...turnosDestinoSel], [turnosDestinoSel]);
  const modoMultiDestino = seleccionados.size > 1;
  const cantidadDestinoRequerida = modoMultiDestino ? seleccionados.size : 1;

  const proyeccion = useProyeccionDiaDestino({
    personaId,
    fechaOrigenYmd,
    fechaDestinoYmd,
    capaOrigen,
    grupoId,
    opsPendientes,
    segmentosTrasladar,
    turnosIdDestino,
    turnosRegimenPorId,
    enabled: Boolean(grupoId && fechaDestinoYmd && !sinRegimen),
  });

  const previewOrigen = useMemo(
    () => proyectarDiaConOpsPendientes(
      capaOrigen,
      opsPendientes,
      personaId,
      fechaOrigenYmd,
      turnosRegimenPorId,
    ),
    [capaOrigen, opsPendientes, personaId, fechaOrigenYmd, turnosRegimenPorId],
  );

  useEffect(() => {
    if (!capaOrigen || cargandoOrigen) return;
    const activos = previewOrigen.segmentosCapa.filter((s) =>
      previewOrigen.segmentoIds.includes(String(s.segmento_id || "")),
    );
    setSegmentosOrigen(enrichCapaTeoricaLabels(activos, turnosRegimenPorId));
    setSeleccionados((prev) => {
      const next = new Set([...prev].filter((id) => previewOrigen.segmentoIds.includes(id)));
      return next;
    });
  }, [capaOrigen, cargandoOrigen, previewOrigen, turnosRegimenPorId]);

  const etiquetaTurnoRegimen = useCallback(
    (turnoId) => {
      const meta = turnosRegimenPorId[turnoId] || {};
      return meta.codigo_interno || labelTurnoToken(turnoId) || meta.etiqueta || turnoId;
    },
    [turnosRegimenPorId],
  );

  useEffect(() => {
    if (proyeccion.loading || seleccionados.size === 0 || sinRegimen) return;
    const incorporables = proyeccion.turnosIncorporables;
    const ids = incorporables.map((t) => t.turno_id);
    const cant = seleccionados.size;
    if (!ids.length) {
      setTurnosDestinoSel(new Set());
      setAvisoPreseleccion("");
      return;
    }

    const selActual = [...turnosDestinoSel];
    const seleccionValida =
      selActual.length === cant
      && selActual.every((id) => ids.includes(id));
    if (seleccionValida) return;

    const origenIds = [...seleccionados];
    let elegidos = [];
    let avisoExtra = "";

    if (cant === 1) {
      const origenId = origenIds[0];
      if (ids.includes(origenId)) {
        elegidos = [origenId];
      } else {
        elegidos = [ids[0]];
        avisoExtra = `El destino ya tiene ${etiquetaTurnoRegimen(origenId)}. Se preseleccionó ${incorporables[0].label} según tu régimen.`;
      }
    } else {
      const desdeOrigen = origenIds.filter((id) => ids.includes(id));
      if (desdeOrigen.length >= cant) {
        elegidos = desdeOrigen.slice(0, cant);
      } else {
        elegidos = ids.slice(0, cant);
        avisoExtra =
          `Se preseleccionaron ${elegidos.map((id) => etiquetaTurnoRegimen(id)).join("+")} `
          + `(podés cambiar a otra combinación del régimen, p. ej. T+N).`;
      }
    }

    setTurnosDestinoSel(new Set(elegidos));
    setAvisoPreseleccion(avisoExtra);
  }, [
    proyeccion.turnosIncorporables,
    proyeccion.loading,
    seleccionados,
    fechaDestinoYmd,
    sinRegimen,
    etiquetaTurnoRegimen,
  ]);

  const cargarOrigen = useCallback(async () => {
    if (!/^gdt_/i.test(String(grupoId || "").trim())) {
      setErrorOrigen("Falta cargo (grupo de trabajo) para cargar el día origen.");
      setCargandoOrigen(false);
      return;
    }
    setCargandoOrigen(true);
    setErrorOrigen("");
    try {
      const [capaRes, ctx] = await Promise.all([
        leerCapaTeoricaCelda(personaId, fechaOrigenYmd, grupoId),
        callListarContextoPlanGrupo({ grupo_id: grupoId, periodo }),
      ]);
      const regimenes = ctx?.data?.regimenes || {};
      const hlg = (ctx?.data?.personas_grupo || []).find((p) => p.persona_id === personaId);
      const regimenId = hlg?.regimen_horario_id;
      const turnosMap = turnosDisponiblesDesdeRegimen(regimenes, regimenId);
      const faltaRegimen = !regimenId || Object.keys(turnosMap).length === 0;
      setSinRegimen(faltaRegimen);
      setTurnosRegimenPorId(turnosMap);
      if (faltaRegimen) {
        setSegmentosOrigen([]);
        setSeleccionados(new Set());
        setErrorOrigen(
          "No se pudo cargar el régimen de turnos de este agente en el cargo y período seleccionados.",
        );
        return;
      }
      const sl = soloLecturaDesdeGsoEscrituraApi(capaRes.gso_escritura);
      setSoloLecturaInfo({ activo: sl.activo, detalle: sl.detalle || "" });
      const capa = capaRes?.capa_teorica ?? capaRes?.capa_teorica_grupo ?? null;
      setCapaOrigen(capa);
      setExpectedVersionTokenOrigen(
        capaRes?.concurrencia?.expected_version_token || capaRes?.concurrencia?.vis_ultima_sync || "",
      );
      setSeleccionados(new Set());
      setTurnosDestinoSel(new Set());
      setAvisoPreseleccion("");
    } catch (e) {
      setSegmentosOrigen([]);
      setErrorOrigen(e?.message || "No se pudo cargar el día origen.");
    } finally {
      setCargandoOrigen(false);
    }
  }, [personaId, fechaOrigenYmd, grupoId, periodo]);

  useEffect(() => {
    void cargarOrigen();
  }, [cargarOrigen]);

  const toggleSegmento = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTurnoDestino = (id) => {
    setTurnosDestinoSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= cantidadDestinoRequerida) {
        if (cantidadDestinoRequerida === 1) {
          return new Set([id]);
        }
        return prev;
      }
      next.add(id);
      return next;
    });
    setAvisoPreseleccion("");
  };

  const resumenOrigen = useMemo(() => {
    if (cargandoOrigen) return "Cargando…";
    const capa = { segmentos: segmentosOrigen.map((s) => ({ segmento_id: s.segmento_id })) };
    return resumenTeoricoCorta(capa, turnosRegimenPorId) || "—";
  }, [cargandoOrigen, segmentosOrigen, turnosRegimenPorId]);

  const handleSubmit = async () => {
    setErrorSubmit("");
    if (!fechaDestinoYmd || fechaDestinoYmd.slice(0, 7) !== periodo) {
      setErrorSubmit("El día destino debe estar en el mismo mes del período.");
      return;
    }
    if (seleccionados.size < 1) {
      setErrorSubmit("Seleccioná al menos un tramo del día origen.");
      return;
    }
    const errMotivo = errorMotivoTeoriaOverride(motivo, requiereUrgenciaG1);
    if (errMotivo) {
      setErrorSubmit(errMotivo);
      return;
    }
    const val = proyeccion.validacion;
    if (!val?.ok) {
      setErrorSubmit(val?.error || "No se puede incorporar en el destino.");
      return;
    }
    if (!expectedVersionTokenOrigen) {
      setErrorSubmit("No se pudo leer la versión del día origen. Recargá e intentá de nuevo.");
      return;
    }
    if (!proyeccion.expectedVersionToken) {
      setErrorSubmit("No se pudo leer la versión del día destino. Recargá e intentá de nuevo.");
      return;
    }

    setOperando(true);
    try {
      const val = proyeccion.validacion;
      const op = buildReemplazoPropioOutboxOp({
        personaId,
        personaLabel: personaNombre || "",
        fechaOrigenYmd,
        fechaDestinoYmd,
        segmentosTrasladar,
        turnoIdDestino: val?.turnoIdDestinoWire || turnosIdDestino[0],
        segmentosIncorporadosDestino: val?.segmentosIncorporadosDestino || turnosIdDestino,
        francoEnOrigen: francoOrigenCompleto,
        motivo: motivo.trim(),
        expectedVersionToken: proyeccion.expectedVersionToken,
        expectedVersionTokenOrigen,
        grupoId,
        periodo,
        esUrgenciaOperativa: requiereUrgenciaG1,
      });
      onAgregarOutbox(op);
      toast.success("Traslado agregado a cambios pendientes.");
      onCerrar();
    } catch (e) {
      setErrorSubmit(e?.message || "No se pudo agregar el cambio.");
    } finally {
      setOperando(false);
    }
  };

  const preview = proyeccion.validacion?.preview;
  const mismoDia = fechaDestinoYmd === fechaOrigenYmd;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="max-h-[min(92vh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cambio-turno-propio-titulo"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="cambio-turno-propio-titulo" className="text-xl font-semibold text-slate-900">
              Cambio de turno propio
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {personaNombre || personaId}
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

        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span className="font-medium">Origen: </span>
          <span className="font-mono">{fechaOrigenYmd}</span>
          <span className="text-indigo-800"> · {resumenOrigen}</span>
        </div>
        {soloLecturaInfo.activo ? (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">🔒 {COPY_BADGE_SOLO_LECTURA_GSO}</p>
            <p className="mt-1 text-xs text-slate-700">{soloLecturaInfo.detalle}</p>
          </div>
        ) : null}
        <UrgenciaG1AvisoModal visible={requiereUrgenciaG1} />

        <p className="mt-2 text-xs text-slate-600">
          {seleccionados.size === 0 ? (
            "Elegí tramos en origen para ver el saldo que queda ese día."
          ) : francoOrigenCompleto ? (
            <>
              Al confirmar, el día origen quedará <span className="font-medium">franco</span> (sin turno teórico).
            </>
          ) : (
            <>
              En origen quedará el saldo no marcado:{" "}
              <span className="font-medium text-slate-800">{saldoOrigenLabel}</span>
              {" "}(no se pisa con franco).
            </>
          )}
        </p>

        {cargandoOrigen ? (
          <p className="mt-4 text-sm text-slate-500">Cargando tramos del origen…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-sm font-semibold text-slate-800">1. Tramos a trasladar (origen)</h3>
              {segmentosOrigen.length === 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  Sin segmentos materializados en el origen. Calculá el día antes de trasladar.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {segmentosOrigen.map((seg) => (
                    <li key={seg.segmento_id}>
                      <label className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm active:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(seg.segmento_id)}
                          onChange={() => toggleSegmento(seg.segmento_id)}
                          className="h-5 w-5 shrink-0 accent-violet-700"
                        />
                        <span className="text-slate-800">{seg.checkbox_label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {seleccionados.size > 1 ? (
                <p className="mt-2 text-xs text-slate-600">
                  Varios tramos: todos se quitan del origen. En destino marcá la misma cantidad de
                  turnos (p. ej. M+T, T+N o M+N según tu régimen).
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-800">2. Día destino (mismo mes)</h3>
              <input
                type="date"
                value={fechaDestinoYmd}
                min={rangoMes.min}
                max={rangoMes.max}
                onChange={(e) => setFechaDestinoYmd(e.target.value)}
                className="mt-2 flex min-h-11 w-full touch-manipulation rounded-xl border border-slate-200 px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              />
              {mismoDia ? (
                <p className="mt-1 text-xs text-amber-800">Mismo día origen y destino (corrimiento en el mismo día).</p>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-800">
                3. Turno{modoMultiDestino ? "s" : ""} a incorporar en destino (aditivo · tope{" "}
                {TOPE_HORAS_DIA} h)
                {modoMultiDestino ? (
                  <span className="font-normal text-slate-600">
                    {" "}
                    · {turnosDestinoSel.size}/{cantidadDestinoRequerida}
                  </span>
                ) : null}
              </h3>
              {seleccionados.size === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Primero elegí tramos en el origen.</p>
              ) : proyeccion.loading ? (
                <p className="mt-2 text-xs text-slate-500">Calculando opciones…</p>
              ) : sinRegimen ? null : proyeccion.destinoTraslado.errorSinOpciones ? (
                <p className="mt-2 text-xs text-amber-800">{proyeccion.destinoTraslado.errorSinOpciones}</p>
              ) : proyeccion.turnosIncorporables.length === 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  No hay turnos de tu régimen para incorporar en este día sin colisión ni superar {TOPE_HORAS_DIA} h.
                  Elegí otra fecha o revisá borradores pendientes.
                </p>
              ) : (
                <fieldset className="mt-2 space-y-2">
                  <legend className="sr-only">Turnos a incorporar en destino</legend>
                  {proyeccion.turnosIncorporables.map((t) => {
                    const marcado = turnosDestinoSel.has(t.turno_id);
                    const inputType = modoMultiDestino ? "checkbox" : "radio";
                    return (
                      <label
                        key={t.turno_id}
                        className={`flex min-h-11 touch-manipulation cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm active:bg-slate-50 ${
                          marcado
                            ? "border-violet-600 bg-violet-50 ring-2 ring-violet-600/30"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <input
                          type={inputType}
                          name={modoMultiDestino ? undefined : "turno-incorporar-destino"}
                          value={t.turno_id}
                          checked={marcado}
                          onChange={() => toggleTurnoDestino(t.turno_id)}
                          className="h-5 w-5 shrink-0 accent-violet-700"
                        />
                        <span className="font-medium text-slate-900">{t.label}</span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
              {proyeccion.destinoTraslado.avisoIntermedio ? (
                <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
                  {proyeccion.destinoTraslado.avisoIntermedio}
                </p>
              ) : null}
              {avisoPreseleccion ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                  {avisoPreseleccion}
                </p>
              ) : null}
              {!proyeccion.loading && seleccionados.size > 0 ? (
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p>
                    <span className="text-slate-500">Actual (grilla + borradores): </span>
                    <span className="font-medium text-slate-900">
                      {proyeccion.estadoActual.etiqueta || "Sin turno / franco"}
                    </span>
                    <span className="text-slate-600"> · {proyeccion.estadoActual.horas} h</span>
                  </p>
                  {preview ? (
                    <p>
                      <span className="text-slate-500">Tras agregar: </span>
                      <span
                        className={`font-medium ${proyeccion.validacion?.ok ? "text-emerald-800" : "text-rose-800"}`}
                      >
                        {preview.despues}
                      </span>
                      <span className="text-slate-600"> · {preview.horas} h</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {proyeccion.error ? (
                <p className="mt-2 text-xs text-rose-800">{proyeccion.error}</p>
              ) : null}
              {proyeccion.validacion && !proyeccion.validacion.ok && proyeccion.validacion.error ? (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                  {proyeccion.validacion.error}
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-800">
                4. Motivo
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
          <button
            type="button"
            disabled={
              operando
              || cargandoOrigen
              || soloLecturaInfo.activo
              || sinRegimen
              || segmentosOrigen.length === 0
              || seleccionados.size === 0
              || turnosDestinoSel.size !== cantidadDestinoRequerida
              || proyeccion.turnosIncorporables.length === 0
              || proyeccion.loading
              || !proyeccion.validacion?.ok
            }
            onClick={() => void handleSubmit()}
            className="min-h-11 rounded-xl bg-violet-700 px-5 text-base font-semibold text-white active:bg-violet-800 disabled:opacity-50"
          >
            {operando ? "Agregando…" : "Agregar a cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
