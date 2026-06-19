import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import toast from "react-hot-toast";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeJefe } from "../routing/portalRole.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";
import GestionTurnoDiaShell from "./GestionTurnoDiaShell.jsx";
import ModalCoberturaParcial from "./ModalCoberturaParcial.jsx";
import ModalCambioTurnoPropio from "./ModalCambioTurnoPropio.jsx";
import ModalTurnoAdicional from "./ModalTurnoAdicional.jsx";
import {
  periodoGsoDesdeVista,
  resolverNivelJerarquicoEnFilas,
} from "./grillaGestionTurnoCapabilities.js";
import {
  buildGuardrailNovedadContext,
  evaluarGuardrailsModificacionTeoria,
} from "./grillaGuardrailsTeoriaUi.js";
import {
  toastErrorAplicarCambioGrilla,
} from "./grillaAplicarCambioInmediato.js";
import {
  faseParcheCriticoTrasBatch,
  faseServidorAplicarCambio,
  iniciarFasePostCicloAplicarCambio,
} from "./grillaCicloAplicarCambioInmediato.js";
import { esIntercambioGuardiaV2 } from "./grillaCoberturaParcialPreview.js";
import { ensureOutboxOpId } from "./grillaOutboxLabels.js";
import GrillaMesEquipoTabla from "./GrillaMesEquipoTabla.jsx";
import GrillaMesTitularCalendario from "./GrillaMesTitularCalendario.jsx";
import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import GrillaMesSinDotacionAviso from "./GrillaMesSinDotacionAviso.jsx";
import { buildCellKey } from "../../../../shared/utils/grillaMesNodos/index.js";
import { refrescarCeldaMicroTrasMutacion } from "./refrescarCeldaMicroTrasMutacion.js";
import { GrillaMesNodosProvider, useGrillaMesNodos } from "./useGrillaMesNodos.js";
import { turnoTeoricoDesdeCeldaVis } from "./grillaTurnoTeoricoDesdeVis.js";
import { useGrillaMesVista } from "./useGrillaMesVista.js";
import { RX_GDT } from "./grillaGrupoUtils.js";
import { formatearRangoTramoMes, diaFueraVigenciaTramo } from "./grillaMesFilasUtils.js";
import { periodosVentanaJefe } from "../jefe/periodoJefe.js";
import GrillaProcesandoCambioOverlay from "./GrillaProcesandoCambioOverlay.jsx";
import GrillaTarjetaGrupoPeriodo from "./GrillaTarjetaGrupoPeriodo.jsx";
import GrillaPeriodoLiquidacionAccionesRrhh from "./GrillaPeriodoLiquidacionAccionesRrhh.jsx";
import { useEstadosPeriodoLiquidacionGrupos } from "./useEstadosPeriodoLiquidacionGrupos.js";
import { celdaEsIncompletoPlanVis } from "./grillaMesEquipoDisplay.js";
import { celdaTieneDesalineacionTeoria } from "./grillaMesCellUtils.js";
import {
  actorPortalTeoriaDesdeGrilla,
  cargaCatalogoSectorGrilla,
  grillaUsaCatalogoSector,
  modoFichadaCeldaDesdeCapabilities,
  modoGrillaInicialDesdeCapabilities,
  resolveGrillaOperativaCapabilitiesFromVariant,
  rutaBandejaSolicitudesGrilla,
  shellEsGrillaRrhh,
} from "./grillaOperativaCapabilities.js";
import SelectorFocoGdt from "./SelectorFocoGdt.jsx";
import { useGrillaMesFocoUrl } from "./useGrillaMesFocoUrl.js";
import { resolvePlanesTurnoCapabilities } from "../planes/planesTurnoCapabilities.js";
import { grillaVistaCacheStore, invalidarCacheGrillaTrasMutacion } from "./grillaCacheMemoryStore.js";

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
 * @param {{
 *   variant?: "default" | "rrhh";
 *   capabilities?: import("./grillaOperativaCapabilities.js").GrillaOperativaCapabilities;
 * }} props
 */
export default function GrillaMesLicenciasPanel({ variant = "default", capabilities: capabilitiesProp }) {
  const capabilities =
    capabilitiesProp ?? resolveGrillaOperativaCapabilitiesFromVariant(variant);
  const esVistaRrhh = grillaUsaCatalogoSector(capabilities);
  const abrirAyuda = (termino) => {
    window.dispatchEvent(new CustomEvent("portal-help-open", { detail: { termino } }));
  };
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esJefe = claimsIncludeJefe(claims);
  const shellRrhh = shellEsGrillaRrhh(capabilities);
  const bandejaPath = rutaBandejaSolicitudesGrilla(capabilities);
  const personaId = String(claims?.persona_id || "").trim();
  const modoFichadaCelda = modoFichadaCeldaDesdeCapabilities(capabilities, esJefe);
  const rutaPlanTurnoBase = useMemo(
    () => resolvePlanesTurnoCapabilities(capabilities.shell).rutaFocoBase,
    [capabilities.shell],
  );

  const actorTeoriaSesion = useMemo(
    () =>
      actorPortalTeoriaDesdeGrilla(capabilities, {
        personaId,
        esJefe,
        nivelJerarquico: null,
      }),
    [capabilities, personaId, esJefe],
  );

  const vista = useGrillaMesVista({
    personaId,
    claims,
    cargaCatalogoSector: cargaCatalogoSectorGrilla(capabilities),
    bypassGsoSoloLecturaLocal: shellRrhh,
    preferSector: capabilities.preferModoSector,
  });
  const usaFocoEnUrl = capabilities.syncFocoEnUrl;
  const modoFocoUrl = modoGrillaInicialDesdeCapabilities(capabilities);

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
  /** Tras aplicar cambio de turno en modal, evita auto-sanación que rematerialice encima del parche. */
  const [sanacionAutoPausadaHasta, setSanacionAutoPausadaHasta] = useState(0);
  const [gestionTurnoShell, setGestionTurnoShell] = useState(null);
  const [coberturaModal, setCoberturaModal] = useState(null);
  const [turnoAdicionalModal, setTurnoAdicionalModal] = useState(null);
  const [cambioTurnoPropioModal, setCambioTurnoPropioModal] = useState(null);
  const [aplicandoBatch, setAplicandoBatch] = useState(false);
  const [aplicandoFichada, setAplicandoFichada] = useState(false);
  const [mostrarBannerProcesando, setMostrarBannerProcesando] = useState(false);
  const procesandoGrilla = aplicandoBatch || aplicandoFichada;
  const [vistaModal, setVistaModal] = useState(null);
  const [cargaPendienteKey, setCargaPendienteKey] = useState("");
  /** RRHH: grupo/período para cerrar-reabrir (selector o tarjeta). */
  const [contextoLiquidacion, setContextoLiquidacion] = useState(
    /** @type {{ grupoId: string; periodo: string; label: string } | null} */ (null),
  );

  const abrirGrillaDesdeFocoUrl = useCallback(
    ({ grupoId, periodo, grupoLabel }) => {
      if (capabilities.puedeAccionesPeriodoLiquidacion && grupoId) {
        setContextoLiquidacion({
          grupoId,
          periodo,
          label: grupoLabel,
        });
      }
      setVistaModal({
        titulo: `${grupoLabel} · ${labelPeriodo(periodo)}`,
        periodo,
        modo: modoFocoUrl,
        grupoId,
      });
      void vista.cargar({
        periodo,
        modo: modoFocoUrl,
        grupoId,
      });
    },
    [capabilities.puedeAccionesPeriodoLiquidacion, vista.cargar, modoFocoUrl],
  );

  const abrirGrillaTitularDesdeFocoUrl = useCallback(
    ({ periodo }) => {
      vista.aplicarFocoOperativo({
        periodo,
        grupoId: "",
        modo: GRILLA_MES_MODO.TITULAR,
      });
      setVistaModal({
        titulo: `Titular (mi caso) · ${labelPeriodo(periodo)}`,
        periodo,
        modo: GRILLA_MES_MODO.TITULAR,
        grupoId: "",
      });
      void vista.cargar({
        periodo,
        modo: GRILLA_MES_MODO.TITULAR,
        grupoId: "",
      });
    },
    [vista.aplicarFocoOperativo, vista.cargar],
  );

  const focoUrl = useGrillaMesFocoUrl({
    enabled: usaFocoEnUrl,
    origenGrupos: capabilities.origenGrupos,
    modoFocoEquipo: modoFocoUrl,
    vista,
    periodoPorDefecto: vista.periodo,
    onFocoListoParaCarga: abrirGrillaDesdeFocoUrl,
  });

  const modalMuestraTitular =
    vistaModal?.modo === GRILLA_MES_MODO.TITULAR || vista.esModoTitular;

  const grillaTitularAbierta = vistaModal?.modo === GRILLA_MES_MODO.TITULAR;
  const mostrarPanoramaJefe =
    capabilities.consolaTripleHorizonteEnFrio &&
    !focoUrl.tieneFocoValido &&
    !grillaTitularAbierta;
  const mostrarTarjetasHorizonte = !usaFocoEnUrl || mostrarPanoramaJefe;

  useEffect(() => {
    if (!usaFocoEnUrl || focoUrl.tieneFocoValido || grillaTitularAbierta) return;
    setVistaModal(null);
  }, [usaFocoEnUrl, focoUrl.tieneFocoValido, grillaTitularAbierta]);

  const labelGrupoParaOp = (grupoId) => {
    const gid = String(grupoId || "").trim();
    if (!gid) return "Titular (mi caso)";
    return etiquetasGrupo[gid] || gid;
  };
  const enrichOpGrilla = (op, grupoId) => {
    const gid = String(grupoId || op.grupoId || "").trim();
    const id = ensureOutboxOpId(op);
    const base = {
      ...op,
      id,
      creado_en: op.creado_en || new Date().toISOString(),
      grupoId: gid,
      grupo_trabajo_id: gid,
      periodo: String(op.periodo || vista.periodo || "").trim(),
      grupoLabel: String(op.grupoLabel || labelGrupoParaOp(gid)).trim(),
    };
    if (esIntercambioGuardiaV2(op)) {
      return {
        ...base,
        schema_version: 2,
        persona_origen_id: op.personaOrigenId,
        persona_cobertura_id: op.personaDestinoId || op.personaCoberturaId,
        fecha: op.fechaOrigenYmd,
        fecha_destino: op.fechaDestinoYmd,
      };
    }
    return base;
  };
  const periodoGso = useMemo(
    () => periodoGsoDesdeVista({
      gsoSoloLecturaMotivo: vista.gsoSoloLecturaMotivo,
      gsoPermiteEscritura: vista.gsoPermiteEscritura,
    }),
    [vista.gsoSoloLecturaMotivo, vista.gsoPermiteEscritura],
  );

  const nivelJerarquicoActor = useMemo(
    () => resolverNivelJerarquicoEnFilas(vista.filas, personaId),
    [vista.filas, personaId],
  );

  const capabilitiesDiaModal = useMemo(() => {
    const vacio = {
      puedeGestionarTurno: false,
      puedeModificarTeoria: false,
      requiereUrgencia: false,
      mensajeBloqueo: null,
      muestraBadgeBypassRrhh: false,
    };
    if (!diaModal?.personaId || !diaModal?.fechaYmd) {
      return vacio;
    }
    if (personaId && diaModal.personaId === personaId) {
      return vacio;
    }
    if (!vista.gsoPermiteEscritura && !shellRrhh) {
      return vacio;
    }
    const targetNivel = resolverNivelJerarquicoEnFilas(
      vista.filas,
      diaModal.personaId,
      diaModal.filaId,
    );
    const guardrails = evaluarGuardrailsModificacionTeoria({
      usuarioActual: {
        ...actorTeoriaSesion,
        nivelJerarquico: nivelJerarquicoActor,
      },
      agenteTarget: {
        id: diaModal.personaId,
        nivelJerarquico: targetNivel,
      },
      estadoPlan: vista.planMensualEstado || "BORRADOR",
      periodoGso,
    });
    return {
      ...guardrails,
      puedeGestionarTurno: guardrails.puedeModificarTeoria,
    };
  }, [
    diaModal,
    personaId,
    actorTeoriaSesion,
    shellRrhh,
    vista.filas,
    vista.gsoPermiteEscritura,
    vista.planMensualEstado,
    nivelJerarquicoActor,
    periodoGso,
  ]);
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
    habilitado: capabilities.puedeAccionesPeriodoLiquidacion && gruposTarjetas.length > 0,
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
    capabilities.puedeAccionesPeriodoLiquidacion &&
    grupoLiquidacionId &&
    estadosPeriodo.estaCerrado(periodoLiquidacion, grupoLiquidacionId);

  const gdtGrillaModal =
    grupoLiquidacionId || vista.grupoActivoId || vista.grupoId || "";
  const personaLabelsGrilla = useMemo(() => {
    /** @type {Record<string, string>} */
    const base = {};
    for (const f of vista.filas || []) {
      const id = String(f.persona_id || "").trim();
      const lbl = String(f.persona_label || "").trim();
      if (id && lbl) base[id] = lbl;
    }
    return base;
  }, [vista.filas]);

  const vistaListadoNodos = useMemo(() => {
    const p = parsePeriodo(periodoGrillaModal);
    if (!p || !gdtGrillaModal) return null;
    return {
      grupo_trabajo_id: gdtGrillaModal,
      anio: p.anio,
      mes: p.mes,
      filas: vista.filas,
    };
  }, [periodoGrillaModal, gdtGrillaModal, vista.filas]);

  const grillaMesNodos = useGrillaMesNodos({
    grupoTrabajoId: gdtGrillaModal,
    periodoYm: periodoGrillaModal,
    vistaListado: vistaListadoNodos,
    enabled: Boolean(vistaModal && gdtGrillaModal && periodoGrillaModal),
  });

  const syncDiaModalDesdeParches = useCallback((parches) => {
    if (!Array.isArray(parches) || !parches.length) return;
    setDiaModal((prev) => {
      if (!prev?.personaId || !prev?.fechaYmd) return prev;
      const hit = parches.find(
        (p) => p.persona_id === prev.personaId && p.fecha_ymd === prev.fechaYmd,
      );
      if (!hit?.celda) return prev;
      const turnoTeorico =
        turnoTeoricoDesdeCeldaVis(hit.celda) ?? prev.turnoTeorico;
      return { ...prev, celdaVis: hit.celda, turnoTeorico };
    });
  }, []);

  useEffect(() => {
    if (!diaModal?.personaId || !diaModal?.fechaYmd) return;
    const gdt = String(diaModal.grupoTrabajoId || gdtGrillaModal || "").trim();
    if (!gdt) return;
    let cellKey;
    try {
      cellKey = buildCellKey({
        gdt,
        persona_id: diaModal.personaId,
        fecha_ymd: diaModal.fechaYmd,
      });
    } catch {
      return;
    }
    const snap = grillaMesNodos.getCellRenderSnapshot(cellKey);
    const cell = snap?.cell;
    if (!cell || typeof cell !== "object") return;
    const turnoTeorico = turnoTeoricoDesdeCeldaVis(cell);
    setDiaModal((prev) => {
      if (
        !prev
        || prev.personaId !== diaModal.personaId
        || prev.fechaYmd !== diaModal.fechaYmd
      ) {
        return prev;
      }
      return {
        ...prev,
        celdaVis: cell,
        turnoTeorico: turnoTeorico ?? prev.turnoTeorico,
      };
    });
  }, [
    grillaMesNodos.bumpEpoch,
    diaModal?.personaId,
    diaModal?.fechaYmd,
    diaModal?.grupoTrabajoId,
    gdtGrillaModal,
  ]);

  /** Fase C: parche puntual en store + filas, sin `vista.cargar` del mes completo. */
  const parchearCeldasTrasMutacion = useCallback(
    async (refs, opts = {}) => {
      const list = (Array.isArray(refs) ? refs : []).filter(
        (r) => r?.persona_id && r?.fecha_ymd && (r?.gdt || r?.grupo_trabajo_id),
      );
      if (!list.length) return [];
      const periodoInv = opts.periodo || vistaModal?.periodo || periodoGrillaModal;
      const gdtInv = String(list[0]?.gdt || list[0]?.grupo_trabajo_id || gdtGrillaModal || "").trim();
      invalidarCacheGrillaTrasMutacion({
        ops: [],
        periodo: periodoInv,
        gdtActivo: gdtInv,
        grupoIdVista: vistaModal?.grupoId || vista.grupoId,
      });
      const parches = await grillaMesNodos.aplicarParchesVisEnGrilla(list, {
        reemplazoTeoriaCompleto: opts.reemplazoTeoriaCompleto === true,
      });
      if (parches.length) {
        flushSync(() => {
          vista.patchFilasDesdeParchesVis(parches);
        });
      }
      return parches;
    },
    [grillaMesNodos, vista, gdtGrillaModal, vistaModal, periodoGrillaModal],
  );

  const fichadaMicroOpRef = useRef(/** @type {Record<string, unknown> | null} */ (null));

  const sincronizarCeldaModalTrasMicro = useCallback(async () => {
    const snap = diaModal;
    const gdt = String(snap?.grupoTrabajoId || gdtGrillaModal || "").trim();
    if (!snap?.personaId || !snap?.fechaYmd || !/^gdt_/i.test(gdt)) return;
    await refrescarCeldaMicroTrasMutacion({
      persona_id: snap.personaId,
      fecha_ymd: snap.fechaYmd,
      grupo_trabajo_id: gdt,
    });
    const parches = await parchearCeldasTrasMutacion(
      [{ persona_id: snap.personaId, fecha_ymd: snap.fechaYmd, gdt }],
      { reemplazoTeoriaCompleto: true },
    );
    syncDiaModalDesdeParches(parches);
  }, [diaModal, gdtGrillaModal, parchearCeldasTrasMutacion, syncDiaModalDesdeParches]);

  const onInicioGuardadoFichadaEnModal = useCallback(() => {
    const snap = diaModal;
    const gdt = String(snap?.grupoTrabajoId || gdtGrillaModal || "").trim();
    if (!snap?.personaId || !snap?.fechaYmd || !/^gdt_/i.test(gdt)) return;
    const microOp = {
      id: ensureOutboxOpId({}),
      tipo: "micro_celda",
      persona_id: snap.personaId,
      fecha_ymd: snap.fechaYmd,
      grupo_trabajo_id: gdt,
      grupoTrabajoId: gdt,
    };
    fichadaMicroOpRef.current = microOp;
    flushSync(() => {
      setDiaModal(null);
      setGestionTurnoShell(null);
      setCoberturaModal(null);
      setCambioTurnoPropioModal(null);
      setTurnoAdicionalModal(null);
    });
    setAplicandoFichada(true);
    grillaMesNodos.marcarOpsPendientes([microOp]);
  }, [diaModal, gdtGrillaModal, grillaMesNodos]);

  const onFinalizadoGuardadoFichadaEnModal = useCallback(
    async ({ ok }) => {
      const op = fichadaMicroOpRef.current;
      try {
        if (ok && op) {
          const persona_id = String(op.persona_id || "").trim();
          const fecha_ymd = String(op.fecha_ymd || "").trim();
          const gdt = String(op.grupo_trabajo_id || op.grupoTrabajoId || "").trim();
          if (persona_id && fecha_ymd && /^gdt_/i.test(gdt)) {
            await refrescarCeldaMicroTrasMutacion({ persona_id, fecha_ymd, grupo_trabajo_id: gdt });
            await parchearCeldasTrasMutacion(
              [{ persona_id, fecha_ymd, gdt }],
              { reemplazoTeoriaCompleto: true },
            );
          }
        }
      } finally {
        if (op) grillaMesNodos.revocarOpsPendientes([op]);
        fichadaMicroOpRef.current = null;
        setAplicandoFichada(false);
      }
    },
    [parchearCeldasTrasMutacion, grillaMesNodos],
  );

  const onMaterializacionSanadaEnModal = sincronizarCeldaModalTrasMicro;

  useEffect(() => {
    if (!capabilities.puedeAccionesPeriodoLiquidacion || !RX_GDT.test(String(vista.grupoId || ""))) {
      return;
    }
    setContextoLiquidacion({
      grupoId: String(vista.grupoId),
      periodo: vista.periodo,
      label: vista.grupoActivoLabel || String(vista.grupoId),
    });
  }, [
    capabilities.puedeAccionesPeriodoLiquidacion,
    vista.grupoId,
    vista.periodo,
    vista.grupoActivoLabel,
  ]);

  const cerrarModalesTrasIniciarAplicar = useCallback(() => {
    flushSync(() => {
      setCambioTurnoPropioModal(null);
      setCoberturaModal(null);
      setTurnoAdicionalModal(null);
      setGestionTurnoShell(null);
      setDiaModal(null);
    });
  }, []);

  useEffect(() => {
    if (!procesandoGrilla) {
      setMostrarBannerProcesando(false);
      return;
    }
    const t = window.setTimeout(() => setMostrarBannerProcesando(true), 750);
    return () => window.clearTimeout(t);
  }, [procesandoGrilla]);

  const aplicarCambioInmediato = useCallback(
    async (op, grupoIdOverride) => {
      if (procesandoGrilla) {
        throw new Error("Ya hay un cambio en curso. Esperá un momento.");
      }
      const enriched = enrichOpGrilla(op, grupoIdOverride);
      // INICIO ciclo: cierra modales y enciende bloqueo de grilla (aplicandoBatch).
      cerrarModalesTrasIniciarAplicar();
      setAplicandoBatch(true);
      try {
        grillaMesNodos.marcarOpsPendientes([enriched]);
        const result = await faseServidorAplicarCambio(enriched, {
          editorPersonaId: personaId,
          periodo: vista.periodo,
        });
        const parches = await faseParcheCriticoTrasBatch(enriched, result, {
          invalidarCache: (p) =>
            invalidarCacheGrillaTrasMutacion({
              ops: p.ops,
              periodo: vista.periodo,
              gdtActivo: gdtGrillaModal,
              grupoIdVista: vista.grupoId,
            }),
          confirmarBatchTrasExito: grillaMesNodos.confirmarBatchTrasExito,
        });
        flushSync(() => {
          vista.patchFilasDesdeParchesVis(parches);
        });
        syncDiaModalDesdeParches(parches);
        setSanacionAutoPausadaHasta(Date.now() + 12_000);
        toast.success("Cambio aplicado.");
        iniciarFasePostCicloAplicarCambio(enriched, { parchearCeldasTrasMutacion });
      } catch (e) {
        grillaMesNodos.revocarOpsPendientes([enriched]);
        toastErrorAplicarCambioGrilla(e, {
          onConcurrencia: async () => {
            invalidarCacheGrillaTrasMutacion({
              ops: [],
              periodo: vista.periodo,
              gdtActivo: gdtGrillaModal,
              grupoIdVista: vista.grupoId,
            });
            await vista.cargar({ bypassCache: true });
          },
        });
        throw e;
      } finally {
        // FIN_BLOQUEO_UI: siempre liberar overlay aunque falle POST en background.
        setAplicandoBatch(false);
      }
    },
    [
      procesandoGrilla,
      cerrarModalesTrasIniciarAplicar,
      personaId,
      vista,
      grillaMesNodos,
      gdtGrillaModal,
      vistaModal?.periodo,
      vistaModal?.modo,
      vistaModal?.grupoId,
      parchearCeldasTrasMutacion,
      syncDiaModalDesdeParches,
    ],
  );

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
    if (capabilities.puedeAccionesPeriodoLiquidacion && grupoId) {
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
  }, [cargaPendienteKey, vista.periodo, vista.modo, vista.grupoId]);

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Calendario licencias</h2>
        {usaFocoEnUrl ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              {esVistaRrhh
                ? "Elegí período y sector. El foco queda en la URL para compartir o refrescar la pantalla."
                : mostrarPanoramaJefe
                  ? "Consola de tres meses abajo. Para aislar un sector, elegí grupo y período y pulsá Ver (zoom por URL)."
                  : "Elegí período y grupo de trabajo vigente. El foco queda en la URL para compartir o refrescar."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1">
              <SelectorFocoGdt
                origenGrupos={
                  capabilities.origenGrupos === "catalogo" ? "catalogo" : "hlg_vigente"
                }
                gruposCatalogo={vista.gruposSector}
                gruposHlg={vista.gruposEquipo}
                catalogoCargando={vista.sectorCargando}
                hlgCargando={vista.resolverCargando}
                grupoIdConfirmado={focoUrl.grupoIdUrl}
                periodoConfirmado={focoUrl.periodoUrl}
                periodoPorDefecto={vista.periodo}
                focoTitularActivo={grillaTitularAbierta}
                muestraAtajoTitular={capabilities.muestraTarjetaTitular}
                disabled={vista.loading}
                onConfirmarCarga={({ grupoId, periodo }) => {
                  focoUrl.pushFocoToUrl({ grupoId, periodo });
                }}
                onVerTitular={({ periodo }) => {
                  abrirGrillaTitularDesdeFocoUrl({ periodo });
                  focoUrl.pushFocoTitularToUrl({ periodo });
                }}
              />
              </div>
              {capabilities.consolaTripleHorizonteEnFrio && focoUrl.tieneFocoValido ? (
                <button
                  type="button"
                  onClick={() => {
                    focoUrl.clearFocoEnUrl();
                    setVistaModal(null);
                  }}
                  className="h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Volver a consola
                </button>
              ) : null}
            </div>
            {grillaTitularAbierta ? (
              <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                Trabajando en: Mi grilla (titular) ·{" "}
                {labelPeriodo(vistaModal?.periodo || focoUrl.periodoUrl)}
              </p>
            ) : focoUrl.tieneFocoValido ? (
              <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950">
                Trabajando en:{" "}
                {focoUrl.grupoLabelUrl || vista.grupoActivoLabel || focoUrl.grupoIdUrl} ·{" "}
                {labelPeriodo(focoUrl.periodoUrl)}
              </p>
            ) : mostrarPanoramaJefe ? null : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
                {esVistaRrhh
                  ? "Elegí sector y período, luego pulsá Ver para cargar la grilla."
                  : "Elegí grupo y período, o usá Mi grilla (titular). Confirmá con Ver."}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            {esVistaRrhh
              ? "Todos los sectores activos. Abrí una tarjeta para ver la grilla del mes."
              : "Seleccioná una tarjeta para abrir la grilla mensual."}
          </p>
        )}
        {!usaFocoEnUrl && esVistaRrhh && vista.sectorCargando ? (
          <p className="mt-2 text-xs text-slate-500">Cargando sectores…</p>
        ) : null}
        {capabilities.puedeAccionesPeriodoLiquidacion && grupoLiquidacionId ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
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
        {mostrarTarjetasHorizonte ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {periodos.map((periodo, idx) => {
            const titulo = mostrarPanoramaJefe
              ? ["Mes anterior · Cierre", "Mes actual · Operación", "Mes próximo · Planificación"][idx]
              : idx === 0
                ? "Mes anterior"
                : idx === 1
                  ? "Mes actual"
                  : "Mes próximo";
            return (
              <section key={periodo} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
                <p className="text-sm font-medium text-slate-900">{labelPeriodo(periodo)}</p>
                <div className="mt-2 space-y-2">
                  {capabilities.muestraTarjetaTitular ? (
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
                        if (mostrarPanoramaJefe) {
                          abrirGrillaTitularDesdeFocoUrl({ periodo });
                          focoUrl.pushFocoTitularToUrl({ periodo });
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
                  ) : null}
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
                        copyCerradoInstitucional={shellRrhh}
                        disabled={cargandoTarjeta}
                        onClick={() => {
                          if (mostrarPanoramaJefe) {
                            focoUrl.pushFocoToUrl({ grupoId: g.id, periodo });
                            return;
                          }
                          if (capabilities.puedeAccionesPeriodoLiquidacion) {
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
        ) : null}
      </div>

      {vista.resolverError ? (
        <p className="mt-2 text-sm text-amber-700">{vista.resolverError}</p>
      ) : null}
      {vista.error ? <p className="mt-2 text-sm text-rose-700">{vista.error}</p> : null}

      {vistaModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Grilla mensual">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => {
              if (procesandoGrilla) return;
              setVistaModal(null);
            }}
            aria-label="Cerrar modal"
          />
          <div className="relative z-10 flex h-[96vh] w-[98vw] flex-col rounded-2xl border border-slate-300 bg-white p-3 shadow-2xl sm:p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Calendario licencias</p>
                <h3 className="text-base font-semibold text-slate-900">{vistaModal.titulo}</h3>
              </div>
              <button
                type="button"
                disabled={procesandoGrilla}
                onClick={() => setVistaModal(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {capabilities.puedeAccionesPeriodoLiquidacion && grupoLiquidacionId && refPeriodoLiquidacion ? (
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
                  <p className="font-medium">🔒 Mes cerrado / solo lectura</p>
                  <p className="mt-1 text-xs text-slate-600">{vista.gsoSoloLecturaMensaje}</p>
                </div>
              ) : null}
              {cargandoTarjeta ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    Cargando grilla...
                  </div>
                </div>
              ) : modalMuestraTitular ? (
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
                          gsoPermiteEscritura={vista.gsoPermiteEscritura}
                          gsoSoloLecturaMotivo={vista.gsoSoloLecturaMotivo}
                          materializadoLazy={cal.materializado_lazy === true}
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
                              celdaVis: cell,
                              vigenteHasta: cal.vigente_hasta,
                              materializadoLazy: cal.materializado_lazy === true,
                              incompletoPlan: celdaEsIncompletoPlanVis(cell),
                              desalineacionTeoria: celdaTieneDesalineacionTeoria(eventos, cell).desalineado,
                              personaLabel: "Mi calendario",
                              grupoLabel: grupoLabel || cal.grupo_label,
                              turnoTeorico:
                                turnoTeoricoDesdeCeldaVis(cell) ?? {
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
                                      cell.fichadas_esperadas != null
                                        ? cell.fichadas_esperadas
                                        : undefined,
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
                <GrillaMesNodosProvider value={grillaMesNodos}>
                  <GrillaMesEquipoTabla
                    key={`grilla-mes-${grillaMesNodos.bumpEpoch}-${vista.filasRevision}`}
                    anio={parsePeriodo(vistaModal.periodo)?.anio ?? vista.anio}
                    mes={parsePeriodo(vistaModal.periodo)?.mes ?? vista.mes}
                    filas={vista.filas}
                    grupoSeleccionado={grupoLiquidacionId || vista.grupoId}
                    etiquetasGrupo={etiquetasGrupo}
                    gsoPermiteEscritura={vista.gsoPermiteEscritura}
                    gsoSoloLecturaMotivo={vista.gsoSoloLecturaMotivo}
                    modoFichada={modoFichadaCelda}
                    materializacionGrupoReciente={
                      (vista.data?.materializacion_grupo?.procesados ?? 0) > 0
                    }
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
                    desalineacionTeoria,
                    desalineacionTooltip,
                    celdaVis,
                    vigenteHasta,
                  }) => {
                    if (procesandoGrilla) return;
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
                      desalineacionTeoria: Boolean(desalineacionTeoria),
                      desalineacionTooltip: desalineacionTooltip || undefined,
                      celdaVis: celdaVis || undefined,
                      vigenteHasta: vigenteHasta || undefined,
                      materializadoLazy:
                        (vista.data?.materializacion_grupo?.procesados ?? 0) > 0,
                      grupoTrabajoId: grupoTrabajoId || grupoLiquidacionId || vista.grupoActivoId || "",
                    });
                  }}
                />
                </GrillaMesNodosProvider>
              )}
            </div>
            {procesandoGrilla ? (
              <GrillaProcesandoCambioOverlay
                mostrarBanner={mostrarBannerProcesando}
                mensaje={
                  aplicandoFichada && !aplicandoBatch
                    ? "Procesando fichada en la grilla…"
                    : "Procesando cambio en la grilla…"
                }
              />
            ) : null}
            <details className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">
              <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900">
                Leyenda de celdas e iconos
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
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
                  <span className="mr-1 inline-block h-3 w-5 rounded border border-rose-700 bg-rose-100 align-middle" />
                  Laborable sin turno (plan incompleto)
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-amber-600 align-middle">
                    ⚠
                  </span>
                  Teoría modificada post-licencia
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-sky-800 align-middle">
                    🔗
                  </span>
                  Licencia gestionada en otro sector (fan-out)
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-amber-900 align-middle">
                    📅
                  </span>
                  HLg inactiva — licencias del período anterior conservadas
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-slate-700 align-middle">
                    🔒
                  </span>
                  Mes cerrado / solo lectura (sin edición de turno)
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-slate-600 align-middle">
                    ⏳
                  </span>
                  Teoría pendiente de cálculo (licencia visible)
                </span>
                <span>
                  <span className="mr-1 inline-block text-[10px] font-bold text-slate-600 align-middle">
                    ℹ️
                  </span>
                  Licencia solapada en franco
                </span>
                <span>Clic = detalles</span>
              </div>
            </details>
          </div>
        </div>
      ) : null}

      <DiaGrillaDetalleModal
        open={diaModal != null}
        onClose={() => {
          if (procesandoGrilla) return;
          setDiaModal(null);
          setSanacionAutoPausadaHasta(0);
        }}
        dia={diaModal?.dia ?? ""}
        eventos={diaModal?.eventos ?? []}
        bandejaPath={bandejaPath}
        subtitulo={diaModal?.personaLabel}
        grupoLabel={diaModal?.grupoLabel}
        turnoTeorico={diaModal?.turnoTeorico ?? null}
        personaId={diaModal?.personaId}
        fechaYmd={diaModal?.fechaYmd}
        grupoTrabajoId={diaModal?.grupoTrabajoId || gdtGrillaModal}
        personaLabels={personaLabelsGrilla}
        soloLectura={!vista.gsoPermiteEscritura}
        soloLecturaMensaje={vista.gsoSoloLecturaMensaje}
        incompletoPlan={Boolean(diaModal?.incompletoPlan)}
        desalineacionTeoria={Boolean(diaModal?.desalineacionTeoria)}
        desalineacionTooltip={diaModal?.desalineacionTooltip}
        celdaVis={diaModal?.celdaVis ?? null}
        etiquetasGrupo={etiquetasGrupo}
        vigenteHasta={diaModal?.vigenteHasta ?? null}
        materializadoLazy={diaModal?.materializadoLazy === true}
        puedeVerTramosCrudosFichadas={capabilities.puedeVerTramosCrudosFichadas}
        puedeEditarFichadasReales={capabilities.puedeEditarFichadasReales}
        onInicioGuardadoFichada={onInicioGuardadoFichadaEnModal}
        onFinalizadoGuardadoFichada={onFinalizadoGuardadoFichadaEnModal}
        onMaterializacionSanada={onMaterializacionSanadaEnModal}
        omitirSanacionAutoHasta={sanacionAutoPausadaHasta}
        onAbrirAyuda={abrirAyuda}
        mostrarFichada={capabilities.puedeVerFichadasReales || esJefe}
        puedeCorregirPlan={esJefe || capabilities.puedeAccionesPeriodoLiquidacion}
        rutaPlanTurnoBase={rutaPlanTurnoBase}
        puedeGestionarTurno={
          capabilitiesDiaModal.puedeGestionarTurno && !diaModal?.incompletoPlan
        }
        puedeModificarTeoria={
          capabilitiesDiaModal.puedeModificarTeoria && !diaModal?.incompletoPlan
        }
        mensajeBloqueoTeoria={capabilitiesDiaModal.mensajeBloqueo}
        muestraBadgeBypassRrhh={capabilitiesDiaModal.muestraBadgeBypassRrhh}
        onAbrirGestionTurno={
          diaModal?.personaId
          && diaModal?.fechaYmd
          && diaModal?.grupoTrabajoId
          && !diaModal?.incompletoPlan
            ? () => {
                setGestionTurnoShell({
                  personaId: diaModal.personaId,
                  fechaYmd: diaModal.fechaYmd,
                  grupoTrabajoId: diaModal.grupoTrabajoId,
                  hlgId: diaModal.hlgId,
                  personaLabel: diaModal.personaLabel,
                  grupoLabel: diaModal.grupoLabel,
                  turnoTeorico: diaModal.turnoTeorico,
                  requiereUrgenciaG1: capabilitiesDiaModal.requiereUrgencia === true,
                  guardrailNovedadContext: buildGuardrailNovedadContext({
                    puedeModificarTeoria: capabilitiesDiaModal.puedeModificarTeoria,
                    esAuditoriaCentral: shellRrhh,
                  }),
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
          requiereUrgenciaG1={gestionTurnoShell.requiereUrgenciaG1 === true}
          soloLectura={!vista.gsoPermiteEscritura}
          soloLecturaMensaje={vista.gsoSoloLecturaMensaje}
          onCapaActualizada={async () => {
            const ctx = gestionTurnoShell;
            if (!ctx?.personaId || !ctx?.fechaYmd) return;
            const gdt = String(ctx.grupoTrabajoId || gdtGrillaModal || "").trim();
            if (!/^gdt_/i.test(gdt)) return;
            const parches = await parchearCeldasTrasMutacion([
              { persona_id: ctx.personaId, fecha_ymd: ctx.fechaYmd, gdt },
            ]);
            syncDiaModalDesdeParches(parches);
          }}
          onAbrirAyuda={() => {
            window.dispatchEvent(new CustomEvent("portal-help-open", {
              detail: { termino: "Gestionar turno del día (A/B/C)" },
            }));
          }}
          onElegirFlujo={(flujo) => {
            const ctx = gestionTurnoShell;
            setGestionTurnoShell(null);
            const urgenciaG1 = ctx.requiereUrgenciaG1 === true;
            if (flujo === "cobertura_parcial") {
              setCoberturaModal({
                personaOrigenId: ctx.personaId,
                personaOrigenLabel: ctx.personaLabel || ctx.personaId,
                fechaYmd: ctx.fechaYmd,
                requiereUrgenciaG1: urgenciaG1,
                guardrailNovedadContext: ctx.guardrailNovedadContext,
                grupoTrabajoId: ctx.grupoTrabajoId,
              });
              return;
            }
            if (flujo === "reemplazo") {
              setCambioTurnoPropioModal({
                personaId: ctx.personaId,
                fechaOrigenYmd: ctx.fechaYmd,
                personaNombre: ctx.personaLabel || "",
                grupoId: ctx.grupoTrabajoId,
                requiereUrgenciaG1: urgenciaG1,
                guardrailNovedadContext: ctx.guardrailNovedadContext,
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
                requiereUrgenciaG1: urgenciaG1,
                guardrailNovedadContext: ctx.guardrailNovedadContext,
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
          requiereUrgenciaG1={coberturaModal.requiereUrgenciaG1 === true}
          guardrailNovedadContext={coberturaModal.guardrailNovedadContext}
          grupoId={
            coberturaModal.grupoTrabajoId ||
            diaModal?.grupoTrabajoId ||
            vista.grupoActivoId
          }
          periodo={vista.periodo}
          onCerrar={() => setCoberturaModal(null)}
          onRegistrado={() => {}}
          onDesactualizado={() => void vista.cargar()}
          onAplicarCambio={async (op) => {
            await aplicarCambioInmediato(
              op,
              coberturaModal.grupoTrabajoId ||
                diaModal?.grupoTrabajoId ||
                vista.grupoActivoId,
            );
          }}
          aplicandoCambio={aplicandoBatch}
        />
      ) : null}

      {cambioTurnoPropioModal ? (
        <ModalCambioTurnoPropio
          personaId={cambioTurnoPropioModal.personaId}
          fechaOrigenYmd={cambioTurnoPropioModal.fechaOrigenYmd}
          personaNombre={cambioTurnoPropioModal.personaNombre}
          requiereUrgenciaG1={cambioTurnoPropioModal.requiereUrgenciaG1 === true}
          guardrailNovedadContext={cambioTurnoPropioModal.guardrailNovedadContext}
          grupoId={cambioTurnoPropioModal.grupoId}
          periodo={vista.periodo}
          onCerrar={() => setCambioTurnoPropioModal(null)}
          onAplicarCambio={async (op) => {
            await aplicarCambioInmediato(
              op,
              cambioTurnoPropioModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId,
            );
          }}
          aplicandoCambio={aplicandoBatch}
        />
      ) : null}

      {turnoAdicionalModal ? (
        <ModalTurnoAdicional
          personaId={turnoAdicionalModal.personaId}
          personaNombre={turnoAdicionalModal.personaNombre}
          fechaYmd={turnoAdicionalModal.fechaYmd}
          requiereUrgenciaG1={turnoAdicionalModal.requiereUrgenciaG1 === true}
          guardrailNovedadContext={turnoAdicionalModal.guardrailNovedadContext}
          grupoId={turnoAdicionalModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId || ""}
          periodo={vista.periodo}
          turnoVisInicial={turnoAdicionalModal.turnoVisInicial ?? null}
          onCerrar={() => setTurnoAdicionalModal(null)}
          onRegistrado={() => {}}
          onAplicarCambio={async (op) => {
            await aplicarCambioInmediato(
              op,
              turnoAdicionalModal.grupoId || diaModal?.grupoTrabajoId || vista.grupoActivoId,
            );
          }}
          aplicandoCambio={aplicandoBatch}
        />
      ) : null}

    </div>
  );
}
