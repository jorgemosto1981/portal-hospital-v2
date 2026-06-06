import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeJefe, claimsIncludeRrhh } from "../routing/portalRole.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";
import GestionTurnoDiaShell from "./GestionTurnoDiaShell.jsx";
import ModalCoberturaParcial from "./ModalCoberturaParcial.jsx";
import ModalCambioTurnoPropio from "./ModalCambioTurnoPropio.jsx";
import ModalTurnoAdicional from "./ModalTurnoAdicional.jsx";
import GrillaOutboxPendientesBanner from "./GrillaOutboxPendientesBanner.jsx";
import { puedeGestionarTurnoEnGrilla } from "./grillaGestionTurnoCapabilities.js";
import GrillaMesEquipoTabla from "./GrillaMesEquipoTabla.jsx";
import GrillaMesTitularCalendario from "./GrillaMesTitularCalendario.jsx";
import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import GrillaMesSinDotacionAviso from "./GrillaMesSinDotacionAviso.jsx";
import { useAsistenciaOutbox } from "./useAsistenciaOutbox.js";
import { useGrillaMesVista } from "./useGrillaMesVista.js";
import { aplicarBatchAsistencia } from "../../services/coberturaParcialService.js";
import { laboralCallableErrorMessage } from "../../pages/datos-laborales/callableErrorMessage.js";
import { opsOutboxParaGrupo } from "./grillaCeldaOutboxVisual.js";
import { mergePersonaLabelsDesdeOps } from "./grillaOutboxLabels.js";
import { RX_GDT } from "./grillaGrupoUtils.js";
import { formatearRangoTramoMes, diaFueraVigenciaTramo } from "./grillaMesFilasUtils.js";
import { periodosVentanaJefe } from "../jefe/periodoJefe.js";
import GrillaTarjetaGrupoPeriodo from "./GrillaTarjetaGrupoPeriodo.jsx";
import GrillaPeriodoLiquidacionAccionesRrhh from "./GrillaPeriodoLiquidacionAccionesRrhh.jsx";
import { useEstadosPeriodoLiquidacionGrupos } from "./useEstadosPeriodoLiquidacionGrupos.js";
import { celdaEsIncompletoPlanVis } from "./grillaMesEquipoDisplay.js";

function parsePeriodo(periodo) {
  const [yyyy, mm] = String(periodo || "").split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

function sumarMeses(basePeriodo, delta) {
  const ref = parsePeriodo(basePeriodo);
  if (!ref) return basePeriodo;
  const d = new Date(ref.anio, ref.mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelPeriodo(periodo) {
  const ref = parsePeriodo(periodo);
  if (!ref) return periodo;
  return new Date(ref.anio, ref.mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {{ variant?: "default" | "rrhh" }} props
 */
export default function GrillaMesLicenciasPanel({ variant = "default" }) {
  const esVistaRrhh = variant === "rrhh";
  const abrirAyuda = (termino) => {
    window.dispatchEvent(new CustomEvent("portal-help-open", { detail: { termino } }));
  };
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const esJefe = claimsIncludeJefe(claims);
  const bandejaPath = esRrhh ? "/portal/rrhh/solicitudes-articulo" : "/portal/jefe/solicitudes";
  const personaId = String(claims?.persona_id || "").trim();

  const vista = useGrillaMesVista({ personaId, claims, esRrhh, preferSector: esVistaRrhh });
  const etiquetasPersona = useMemo(() => {
    const map = {};
    for (const fila of vista.filas || []) {
      const id = String(fila.persona_id || "").trim();
      const label = String(fila.persona_label || "").trim();
      if (id && label) map[id] = label;
    }
    return map;
  }, [vista.filas]);
  const etiquetasGrupo = useMemo(() => {
    const map = {};
    for (const g of [...vista.gruposEquipo, ...vista.gruposSector]) {
      const id = String(g.grupo_de_trabajo_id || g.id || "").trim();
      const label = String(g.etiqueta_ui || g.label || g.nombre || "").trim();
      if (id && label) map[id] = label;
    }
    if (vista.grupoActivoId && vista.grupoActivoLabel) {
      map[vista.grupoActivoId] = vista.grupoActivoLabel;
    }
    for (const cal of vista.titularCalendarios) {
      const id = String(cal.grupo_trabajo_id || "").trim();
      const label = String(cal.grupo_label || "").trim();
      if (id && label) map[id] = label;
    }
    return map;
  }, [
    vista.gruposEquipo,
    vista.gruposSector,
    vista.grupoActivoId,
    vista.grupoActivoLabel,
    vista.titularCalendarios,
  ]);
  const [diaModal, setDiaModal] = useState(null);
  const [gestionTurnoShell, setGestionTurnoShell] = useState(null);
  const [coberturaModal, setCoberturaModal] = useState(null);
  const [turnoAdicionalModal, setTurnoAdicionalModal] = useState(null);
  const [cambioTurnoPropioModal, setCambioTurnoPropioModal] = useState(null);
  const [aplicandoBatch, setAplicandoBatch] = useState(false);
  const [vistaModal, setVistaModal] = useState(null);
  const [cargaPendienteKey, setCargaPendienteKey] = useState("");
  /** RRHH: grupo/período para cerrar-reabrir (selector o tarjeta). */
  const [contextoLiquidacion, setContextoLiquidacion] = useState(
    /** @type {{ grupoId: string; periodo: string; label: string } | null} */ (null),
  );
  const outbox = useAsistenciaOutbox({ editorPersonaId: personaId, periodo: vista.periodo });
  const labelGrupoParaOutbox = (grupoId) => {
    const gid = String(grupoId || "").trim();
    if (!gid) return "Titular (mi caso)";
    return etiquetasGrupo[gid] || gid;
  };
  const enrichOutboxOp = (op, grupoId) => {
    const gid = String(grupoId || op.grupoId || "").trim();
    return {
      ...op,
      grupoId: gid,
      periodo: String(op.periodo || vista.periodo || "").trim(),
      grupoLabel: String(op.grupoLabel || labelGrupoParaOutbox(gid)).trim(),
    };
  };
  const puedeGestionTurno = puedeGestionarTurnoEnGrilla({
    esRrhh,
    esJefe,
    gsoPermiteEscritura: vista.gsoPermiteEscritura,
  });
  const periodos = useMemo(
    () =>
      esJefe
        ? periodosVentanaJefe()
        : [sumarMeses(vista.periodo, -1), vista.periodo, sumarMeses(vista.periodo, 1)],
    [esJefe, vista.periodo],
  );
  const cargandoTarjeta = Boolean(cargaPendienteKey) || vista.loading;

  const gruposTarjetas = useMemo(() => {
    const map = new Map();
    if (esVistaRrhh) {
      for (const g of vista.gruposSector) {
        const id = String(g.id || "").trim();
        const label = String(g.nombre || g.codigo || g.titulo || id).trim();
        if (RX_GDT.test(id)) map.set(id, { id, label });
      }
    } else {
      for (const g of vista.gruposEquipo) {
        const id = String(g.grupo_de_trabajo_id || "").trim();
        const label = String(g.etiqueta_ui || id).trim();
        if (id) map.set(id, { id, label });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
    );
  }, [vista.gruposEquipo, vista.gruposSector, esVistaRrhh]);

  const estadosPeriodo = useEstadosPeriodoLiquidacionGrupos({
    periodos,
    grupos: gruposTarjetas,
    habilitado: esRrhh && gruposTarjetas.length > 0,
  });

  const refrescarTrasPeriodo = async () => {
    await estadosPeriodo.recargar();
    if (vistaModal) {
      await vista.cargar({
        periodo: vistaModal.periodo,
        modo: vistaModal.modo || GRILLA_MES_MODO.SECTOR,
        grupoId: contextoLiquidacion?.grupoId || vista.grupoId,
      });
    }
  };

  const periodoGrillaModal = vistaModal?.periodo || vista.periodo;
  const grupoLiquidacionId = RX_GDT.test(String(contextoLiquidacion?.grupoId || ""))
    ? String(contextoLiquidacion.grupoId)
    : RX_GDT.test(String(vista.grupoId || ""))
      ? String(vista.grupoId)
      : "";
  const periodoLiquidacion = contextoLiquidacion?.periodo || vista.periodo;
  const refPeriodoLiquidacion = parsePeriodo(periodoLiquidacion);
  const labelGrupoLiquidacion =
    contextoLiquidacion?.label || vista.grupoActivoLabel || grupoLiquidacionId;
  const periodoLiquidacionCerrado =
    esRrhh &&
    grupoLiquidacionId &&
    estadosPeriodo.estaCerrado(periodoLiquidacion, grupoLiquidacionId);

  const gdtGrillaModal =
    grupoLiquidacionId || vista.grupoActivoId || vista.grupoId || "";
  const opsOutboxGrillaModal = useMemo(
    () => opsOutboxParaGrupo(outbox.ops, gdtGrillaModal, periodoGrillaModal),
    [outbox.ops, gdtGrillaModal, periodoGrillaModal],
  );
  const personaLabelsGrilla = useMemo(() => {
    /** @type {Record<string, string>} */
    const base = {};
    for (const f of vista.filas || []) {
      const id = String(f.persona_id || "").trim();
      const lbl = String(f.persona_label || "").trim();
      if (id && lbl) base[id] = lbl;
    }
    return mergePersonaLabelsDesdeOps(outbox.ops, base);
  }, [vista.filas, outbox.ops]);

  useEffect(() => {
    if (!esRrhh || !RX_GDT.test(String(vista.grupoId || ""))) return;
    setContextoLiquidacion({
      grupoId: String(vista.grupoId),
      periodo: vista.periodo,
      label: vista.grupoActivoLabel || String(vista.grupoId),
    });
  }, [esRrhh, vista.grupoId, vista.periodo, vista.grupoActivoLabel]);

  const handleAplicarCambios = async () => {
    if (!outbox.hasPending || aplicandoBatch) return;
    setAplicandoBatch(true);
    try {
      const result = await aplicarBatchAsistencia(outbox.ops, {
        editorPersonaId: personaId,
        periodo: vista.periodo,
      });
      toast.success(`Cambios aplicados: ${result?.aplicadas ?? outbox.count}.`);
      outbox.clear();
      await vista.cargar();
    } catch (e) {
      const msg = laboralCallableErrorMessage(e, "No se pudo aplicar el batch.");
      if (msg.includes("ASI-CONC")) {
        toast.error("La grilla cambió. Se conservaron tus pendientes para reintentar.");
        await vista.cargar();
      } else if (msg.includes("ASI-GSO")) {
        toast.error("Mes anterior en solo lectura. No se pueden aplicar cambios.");
      } else if (msg.includes("ASI-PER")) {
        toast.error("Período cerrado. Revisá los cambios pendientes.");
      } else if (msg.includes("BATCH-A005")) {
        toast.error("Falta la versión del día destino del intercambio. Abrí de nuevo el modal y reintentá.");
      } else if (msg.includes("BATCH-020") || msg.includes("unimplemented")) {
        toast.error("Ese tipo de cambio aún no está en el servidor. Actualizá functions o quitá la operación de la cola.");
      } else if (/\[BATCH-/i.test(msg)) {
        toast.error(msg.replace(/^\[[^\]]+\]\s*/i, ""));
      } else {
        toast.error(msg);
      }
    } finally {
      setAplicandoBatch(false);
    }
  };

  function seleccionarTarjeta({ periodo, modo, grupoId = "", titulo }) {
    const modoEfectivo =
      modo === GRILLA_MES_MODO.TITULAR
        ? GRILLA_MES_MODO.TITULAR
        : esVistaRrhh && grupoId
          ? GRILLA_MES_MODO.SECTOR
          : modo;
    vista.aplicarSeleccionDesdeTarjeta({
      periodo,
      modo: modoEfectivo,
      grupoId,
    });
    if (esRrhh && grupoId) {
      const g = gruposTarjetas.find((x) => x.id === grupoId);
      setContextoLiquidacion({
        grupoId,
        periodo,
        label: g?.label || grupoId,
      });
    }
    setVistaModal({ titulo, periodo, modo: modoEfectivo, grupoId });
    setCargaPendienteKey(`${periodo}::${modoEfectivo}::${grupoId || "-"}`);
    void vista.cargar({ periodo, modo: modoEfectivo, grupoId });
  }

  const modalEsSector =
    vistaModal?.modo === GRILLA_MES_MODO.SECTOR
    || (vistaModal && vista.modo === GRILLA_MES_MODO.SECTOR);
  const grillaSinDotacion =
    Boolean(vistaModal)
    && !cargandoTarjeta
    && modalEsSector
    && vista.data != null
    && (vista.data.total_personas === 0 || vista.filas.length === 0);

  useEffect(() => {
    if (!cargaPendienteKey) return;
    const [periodoTarget, modoTarget, grupoTarget] = cargaPendienteKey.split("::");
    const grupoNormalizado = grupoTarget === "-" ? "" : grupoTarget;
    const listoTitular = modoTarget === GRILLA_MES_MODO.TITULAR;
    const listo =
      vista.periodo === periodoTarget &&
      vista.modo === modoTarget &&
      (listoTitular || String(vista.grupoId || "") === grupoNormalizado);
    if (!listo) return;
    setCargaPendienteKey("");
    void vista.cargar({
      periodo: periodoTarget,
      modo: modoTarget,
      grupoId: grupoNormalizado,
    });
  }, [cargaPendienteKey, vista.periodo, vista.modo, vista.grupoId, vista.cargar]);

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Calendario licencias</h2>
        <p className="mt-1 text-sm text-slate-600">
          {esVistaRrhh
            ? "Todos los sectores activos. Abrí una tarjeta para ver la grilla del mes."
            : "Seleccioná una tarjeta para abrir la grilla mensual."}
        </p>
        {esVistaRrhh && vista.sectorCargando ? (
          <p className="mt-2 text-xs text-slate-500">Cargando sectores…</p>
        ) : null}
        {esRrhh && !esVistaRrhh && grupoLiquidacionId ? (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <GrillaPeriodoLiquidacionAccionesRrhh
              grupoId={grupoLiquidacionId}
              anio={refPeriodoLiquidacion?.anio ?? vista.anio}
              mes={refPeriodoLiquidacion?.mes ?? vista.mes}
              periodoLabel={labelPeriodo(periodoLiquidacion)}
              grupoLabel={labelGrupoLiquidacion}
              cerrado={periodoLiquidacionCerrado}
              onCompletado={refrescarTrasPeriodo}
            />
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {periodos.map((periodo, idx) => {
            const titulo = idx === 0 ? "Mes anterior" : idx === 1 ? "Mes actual" : "Mes próximo";
            return (
              <section key={periodo} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
                <p className="text-sm font-medium text-slate-900">{labelPeriodo(periodo)}</p>
                <div className="mt-2 space-y-2">
                  <GrillaTarjetaGrupoPeriodo
                    titulo="Titular (mi caso)"
                    subtituloPeriodo={labelPeriodo(periodo)}
                    cerrado={false}
                    disabled={cargandoTarjeta || vista.gruposEquipo.length === 0}
                    variante="titular"
                    onClick={() => {
                      if (vista.gruposEquipo.length === 0) {
                        toast.error("Sin cargos vigentes en el mes seleccionado.");
                        return;
                      }
                      seleccionarTarjeta({
                        periodo,
                        modo: "TITULAR",
                        grupoId: "",
                        titulo: `Titular (mi caso) · ${labelPeriodo(periodo)}`,
                      });
                    }}
                  />
                  {gruposTarjetas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                      Sin grupos vigentes.
                    </p>
                  ) : (
                    gruposTarjetas.map((g) => (
                      <GrillaTarjetaGrupoPeriodo
                        key={`${periodo}-${g.id}`}
                        titulo={g.label}
                        subtituloPeriodo={labelPeriodo(periodo)}
                        cerrado={estadosPeriodo.estaCerrado(periodo, g.id)}
                        sinDotacion={estadosPeriodo.estaSinDotacion(periodo, g.id)}
                        disabled={cargandoTarjeta}
                        onClick={() => {
                          if (esRrhh) {
                            setContextoLiquidacion({
                              grupoId: g.id,
                              periodo,
                              label: g.label,
                            });
                          }
                          seleccionarTarjeta({
                            periodo,
                            modo: "EQUIPO",
                            grupoId: g.id,
                            titulo: `${g.label} · ${labelPeriodo(periodo)}`,
                          });
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {vista.resolverError ? (
        <p className="mt-2 text-sm text-amber-700">{vista.resolverError}</p>
      ) : null}
      {vista.error ? <p className="mt-2 text-sm text-rose-700">{vista.error}</p> : null}

      {outbox.pendingRecovery ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-medium">Tenés cambios pendientes de una sesión anterior ({outbox.pendingRecovery.count}).</p>
          <p className="mt-1 text-xs text-amber-800">Período {vista.periodo}. ¿Querés recuperarlos o descartarlos?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={outbox.recoverPending}
              className="min-h-11 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white active:bg-amber-800"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={outbox.discardPending}
              className="min-h-11 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 active:bg-amber-100"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {outbox.hasPending && vista.gsoPermiteEscritura ? (
        <GrillaOutboxPendientesBanner
          ops={outbox.ops}
          aplicandoBatch={aplicandoBatch}
          personaLabels={etiquetasPersona}
          grupoLabels={etiquetasGrupo}
          onAplicar={() => void handleAplicarCambios()}
          onLimpiar={() => {
            outbox.clear();
            toast.success("Cola de cambios vaciada.");
          }}
          onQuitarOp={(opId) => {
            outbox.removeOp(opId);
            toast.success("Cambio quitado de la cola.");
          }}
          onAbrirAyuda={() => abrirAyuda("Cambios Pendientes (Borrador)")}
        />
      ) : null}

      {vistaModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Grilla mensual">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setVistaModal(null)} aria-label="Cerrar modal" />
          <div className="relative z-10 flex h-[96vh] w-[98vw] flex-col rounded-2xl border border-slate-300 bg-white p-3 shadow-2xl sm:p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Calendario licencias</p>
                <h3 className="text-base font-semibold text-slate-900">{vistaModal.titulo}</h3>
              </div>
              <button type="button" onClick={() => setVistaModal(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {esRrhh && grupoLiquidacionId && refPeriodoLiquidacion ? (
                <div className="mb-3">
                  <GrillaPeriodoLiquidacionAccionesRrhh
                    grupoId={grupoLiquidacionId}
                    anio={refPeriodoLiquidacion.anio}
                    mes={refPeriodoLiquidacion.mes}
                    periodoLabel={labelPeriodo(periodoLiquidacion)}
                    grupoLabel={labelGrupoLiquidacion}
                    cerrado={periodoLiquidacionCerrado}
                    onCompletado={refrescarTrasPeriodo}
                    compact
                  />
                </div>
              ) : null}
              {!vista.gsoPermiteEscritura && vista.gsoSoloLecturaMensaje ? (
                <div className="mb-3 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800">
                  <p className="font-medium">Solo lectura</p>
                  <p className="mt-1 text-xs text-slate-600">{vista.gsoSoloLecturaMensaje}</p>
                </div>
              ) : null}
              {cargandoTarjeta ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    Cargando grilla...
                  </div>
                </div>
              ) : vista.esModoTitular ? (
                vista.titularCalendarios.length === 0 ? (
                  <p className="mt-8 text-center text-sm text-slate-600">
                    Sin cargos vigentes para este mes.
                  </p>
                ) : (
                  <div className="space-y-8 pb-4">
                    <p className="text-sm text-slate-600">
                      {vista.titularCalendarios.length === 1
                        ? "1 tramo HLg vigente en el mes"
                        : `${vista.titularCalendarios.length} tramos HLg vigentes en el mes`}
                      {" · "}
                      {vista.hintModo}
                    </p>
                    {vista.titularCalendarios.map((cal) => {
                      const tramoRango = formatearRangoTramoMes(cal.vigente_desde, cal.vigente_hasta);
                      return (
                      <section
                        key={cal.calendario_id || cal.fila_id || cal.grupo_trabajo_id}
                        className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm"
                      >
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-violet-200/80 pb-2">
                          <div>
                            <h4 className="text-base font-semibold text-violet-950">{cal.grupo_label}</h4>
                            {tramoRango ? (
                              <p className="mt-0.5 text-xs font-medium text-indigo-700">
                                Tramo: {tramoRango}
                              </p>
                            ) : null}
                          </div>
                          {cal.error_carga ? (
                            <span className="text-xs font-medium text-amber-800">Error al cargar turnos</span>
                          ) : cal.existe ? (
                            <span className="text-xs text-slate-500">Grilla sincronizada</span>
                          ) : (
                            <span className="text-xs text-amber-700">Sin materialización aún</span>
                          )}
                        </div>
                        <GrillaMesTitularCalendario
                          anio={vista.anio}
                          mes={vista.mes}
                          diasMap={cal.dias}
                          grupoLabel={cal.grupo_label}
                          grupoVistaId={cal.grupo_trabajo_id}
                          vigenteDesde={cal.vigente_desde}
                          vigenteHasta={cal.vigente_hasta}
                          hlgRows={vista.titularHlgRows}
                          hlgListo={vista.titularHlgListo}
                          etiquetasGrupo={etiquetasGrupo}
                          onDiaClick={({ dia, eventos, grupoLabel }) => {
                            const fechaYmd = `${vista.anio}-${String(vista.mes).padStart(2, "0")}-${dia}`;
                            if (cal.vigente_desde && cal.vigente_hasta) {
                              if (diaFueraVigenciaTramo(fechaYmd, cal.vigente_desde, cal.vigente_hasta)) return;
                            }
                            const cell = cal.dias?.[dia] || {};
                            setDiaModal({
                              dia,
                              fechaYmd,
                              personaId,
                              hlgId: cal.hlg_id || undefined,
                              filaId: cal.fila_id || undefined,
                              grupoTrabajoId: cal.grupo_trabajo_id,
                              eventos,
                              incompletoPlan: celdaEsIncompletoPlanVis(cell),
                              personaLabel: "Mi calendario",
                              grupoLabel: grupoLabel || cal.grupo_label,
                              turnoTeorico: {
                                rda_turno_id: cell.rda_turno_id,
                                es_franco: cell.es_franco,
                                capa_teorica: {
                                  tipo_dia: cell.tipo_dia
                                    || (cell.es_franco ? "franco" : "laborable"),
                                  ingreso: cell.rda_ingreso,
                                  egreso: cell.rda_egreso,
                                  horario_display: cell.rda_horario_display,
                                  tiene_huecos: cell.rda_tiene_huecos,
                                  fichadas_esperadas:
                                    cell.fichadas_esperadas != null ? cell.fichadas_esperadas : undefined,
                                  es_feriado: cell.es_feriado,
                                  tipo_evento_institucional: cell.tipo_evento_institucional,
                                },
                              },
                            });
                          }}
                        />
                      </section>
                    );
                    })}
                  </div>
                )
              ) : vista.error ? (
                <p className="mt-8 text-center text-sm text-rose-700">{vista.error}</p>
              ) : grillaSinDotacion ? (
                <GrillaMesSinDotacionAviso
                  grupoLabel={labelGrupoLiquidacion}
                  periodoLabel={labelPeriodo(vistaModal.periodo)}
                />
              ) : (
                <GrillaMesEquipoTabla
                  anio={parsePeriodo(vistaModal.periodo)?.anio ?? vista.anio}
                  mes={parsePeriodo(vistaModal.periodo)?.mes ?? vista.mes}
                  filas={vista.filas}
                  grupoSeleccionado={grupoLiquidacionId || vista.grupoId}
                  etiquetasGrupo={etiquetasGrupo}
                  opsOutboxGrupo={opsOutboxGrillaModal}
                  periodoOutbox={periodoGrillaModal}
                  onCeldaClick={({
                    dia,
                    fechaYmd,
                    personaId: pid,
                    hlgId,
                    filaId,
                    eventos,
                    personaLabel,
                    grupoLabel,
                    turnoTeorico,
                    grupoTrabajoId,
                    incompletoPlan,
                  }) =>
                    setDiaModal({
                      dia,
                      fechaYmd,
                      personaId: pid,
                      hlgId,
                      filaId,
                      eventos,
                      personaLabel,
                      grupoLabel,
                      turnoTeorico,
                      incompletoPlan: Boolean(incompletoPlan),
                      grupoTrabajoId: grupoTrabajoId || grupoLiquidacionId || vista.grupoActivoId || "",
                    })
                  }
                />
              )}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded border border-blue-900/25 bg-[#3B82F6] align-middle" />
                  Consolidado / aprobado
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded border-2 border-dashed border-amber-900 bg-[#F59E0B] align-middle" />
                  En revisión
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-emerald-100 ring-1 ring-emerald-300 align-middle" />
                  Día laborable (turno)
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-slate-400 align-middle" />
                  No laborable (régimen)
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-amber-100 ring-1 ring-amber-400 align-middle" />
                  Feriado / asueto
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded bg-rose-100 align-middle" />
                  Fin de semana
                </span>
                <span>
                  <span className="mr-1 inline-flex h-3 w-5 items-center justify-center rounded bg-slate-200 text-[10px] leading-none text-slate-500 align-middle">
                    ×
                  </span>
                  Sin asignación al grupo en esa fecha
                </span>
                <span>
                  <span className="mr-1 inline-flex h-3 min-w-[1.1rem] items-center justify-center rounded bg-indigo-900 px-0.5 text-[8px] font-bold text-white align-middle">
                    F:n
                  </span>
                  Fichadas esperadas (jornada)
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded ring-2 ring-amber-500 align-middle" />
                  Turno con cambio pendiente (cola)
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-5 rounded border border-rose-700 bg-rose-100 align-middle" />
                  Laborable sin turno (plan incompleto)
                </span>
                <span>Clic = detalles</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DiaGrillaDetalleModal
        open={diaModal != null}
        onClose={() => setDiaModal(null)}
        dia={diaModal?.dia ?? ""}
        eventos={diaModal?.eventos ?? []}
        bandejaPath={bandejaPath}
        subtitulo={diaModal?.personaLabel}
        grupoLabel={diaModal?.grupoLabel}
        turnoTeorico={diaModal?.turnoTeorico ?? null}
        personaId={diaModal?.personaId}
        fechaYmd={diaModal?.fechaYmd}
        grupoTrabajoId={diaModal?.grupoTrabajoId || gdtGrillaModal}
        opsOutboxPendientes={opsOutboxGrillaModal}
        personaLabels={personaLabelsGrilla}
        soloLectura={!vista.gsoPermiteEscritura}
        incompletoPlan={Boolean(diaModal?.incompletoPlan)}
        puedeCorregirPlan={esJefe || esRrhh}
        puedeGestionarTurno={puedeGestionTurno && !diaModal?.incompletoPlan}
        onAbrirGestionTurno={
          puedeGestionTurno && diaModal?.personaId && diaModal?.fechaYmd && diaModal?.grupoTrabajoId
            ? () => {
                setGestionTurnoShell({
                  personaId: diaModal.personaId,
                  fechaYmd: diaModal.fechaYmd,
                  grupoTrabajoId: diaModal.grupoTrabajoId,
                  hlgId: diaModal.hlgId,
                  personaLabel: diaModal.personaLabel,
                  grupoLabel: diaModal.grupoLabel,
                  turnoTeorico: diaModal.turnoTeorico,
                });
              }
            : undefined
        }
      />

      {gestionTurnoShell ? (
        <GestionTurnoDiaShell
          open
          onClose={() => setGestionTurnoShell(null)}
          personaId={gestionTurnoShell.personaId}
          fechaYmd={gestionTurnoShell.fechaYmd}
          grupoTrabajoId={gestionTurnoShell.grupoTrabajoId}
          hlgId={gestionTurnoShell.hlgId}
          personaLabel={gestionTurnoShell.personaLabel}
          grupoLabel={gestionTurnoShell.grupoLabel}
          turnoVisInicial={gestionTurnoShell.turnoTeorico}
          onCapaActualizada={() => void vista.cargar()}
          onAbrirAyuda={() => {
            window.dispatchEvent(new CustomEvent("portal-help-open", {
              detail: { termino: "Gestionar turno del día (A/B/C)" },
            }));
          }}
          onElegirFlujo={(flujo) => {
            const ctx = gestionTurnoShell;
            setGestionTurnoShell(null);
            if (flujo === "cobertura_parcial") {
              setCoberturaModal({
                personaOrigenId: ctx.personaId,
                personaOrigenLabel: ctx.personaLabel || ctx.personaId,
                fechaYmd: ctx.fechaYmd,
              });
              return;
            }
            if (flujo === "reemplazo") {
              setCambioTurnoPropioModal({
                personaId: ctx.personaId,
                fechaOrigenYmd: ctx.fechaYmd,
                personaNombre: ctx.personaLabel || "",
                grupoId: ctx.grupoTrabajoId,
              });
              return;
            }
            if (flujo === "adicional") {
              setTurnoAdicionalModal({
                personaId: ctx.personaId,
                fechaYmd: ctx.fechaYmd,
                personaNombre: ctx.personaLabel || "",
                grupoId: ctx.grupoTrabajoId,
                turnoVisInicial: ctx.turnoTeorico ?? null,
              });
            }
          }}
        />
      ) : null}

      {coberturaModal ? (
        <ModalCoberturaParcial
          personaOrigenId={coberturaModal.personaOrigenId}
          personaOrigenLabel={coberturaModal.personaOrigenLabel}
          fechaYmd={coberturaModal.fechaYmd}
          grupoId={diaModal?.grupoTrabajoId || vista.grupoActivoId}
          periodo={vista.periodo}
          opsPendientes={outbox.ops}
          onCerrar={() => setCoberturaModal(null)}
          onRegistrado={() => {}}
          onDesactualizado={() => void vista.cargar()}
          onAgregarOutbox={(op) =>
            outbox.addOp(
              enrichOutboxOp(op, diaModal?.grupoTrabajoId || vista.grupoActivoId),
            )
          }
        />
      ) : null}

      {cambioTurnoPropioModal ? (
        <ModalCambioTurnoPropio
          personaId={cambioTurnoPropioModal.personaId}
          fechaOrigenYmd={cambioTurnoPropioModal.fechaOrigenYmd}
          personaNombre={cambioTurnoPropioModal.personaNombre}
          grupoId={cambioTurnoPropioModal.grupoId}
          periodo={vista.periodo}
          opsPendientes={outbox.ops}
          onCerrar={() => setCambioTurnoPropioModal(null)}
          onAgregarOutbox={(op) =>
            outbox.addOp(
              enrichOutboxOp(
                op,
                cambioTurnoPropioModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId,
              ),
            )
          }
        />
      ) : null}

      {turnoAdicionalModal ? (
        <ModalTurnoAdicional
          personaId={turnoAdicionalModal.personaId}
          personaNombre={turnoAdicionalModal.personaNombre}
          fechaYmd={turnoAdicionalModal.fechaYmd}
          grupoId={turnoAdicionalModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId || ""}
          periodo={vista.periodo}
          opsPendientes={outbox.ops}
          turnoVisInicial={turnoAdicionalModal.turnoVisInicial ?? null}
          onCerrar={() => setTurnoAdicionalModal(null)}
          onRegistrado={() => {}}
          onAgregarOutbox={(op) =>
            outbox.addOp(
              enrichOutboxOp(
                op,
                turnoAdicionalModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId,
              ),
            )
          }
        />
      ) : null}

    </div>
  );
}
