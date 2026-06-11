import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cargarHlgRowsParaTitular } from "./grillaTitularHlgLoad.js";

import {
  callListarContextoPlanGrupo,
  callListarVistaGrillaMesPorGrupo,
  callObtenerVistaGrillaMesAgente,
  callResolverContextoLaboralSolicitud,
} from "../../services/callables.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import { claimsIncludeJefe } from "../routing/portalRole.js";
import { normalizarPeriodoJefe } from "../jefe/periodoJefe.js";
import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import { anioMesDesdePeriodo, fechaCorteFinMesDesdePeriodo } from "./grillaMesPeriodoUtils.js";
import {
  assertGrupoTrabajoId,
  etiquetaGrupoDesdeLista,
  normalizeGrupoTrabajoId,
  resolverGrupoIdInicial,
  RX_GDT,
} from "./grillaGrupoUtils.js";
import { copyDetalleSoloLecturaGso, gsoPermiteEscritura } from "./grillaGsoSoloLectura.js";
import {
  mensajeToastMaterializacionGrupo,
  mensajeToastMaterializacionLazy,
} from "./grillaMaterializacionToast.js";
import { normalizarFilasGrillaEquipo } from "./grillaMesFilasUtils.js";
import { hlgSegmentosTitularMes } from "./grillaTitularTramosMes.js";

function etiquetaGrupoSector(row) {
  const nombre = String(row.nombre || row.codigo || row.titulo || "").trim();
  return nombre || String(row.id || "");
}

/**
 * Estado y carga unificados calendario GSO (C2c + C2d).
 * Titular y equipo operan sobre un bounded context (gdt) activo.
 * @param {{
 *   personaId: string;
 *   claims: Record<string, unknown> | null | undefined;
 *   cargaCatalogoSector?: boolean;
 *   bypassGsoSoloLecturaLocal?: boolean;
 *   preferSector?: boolean;
 * }} ctx
 */
export function useGrillaMesVista({
  personaId,
  claims,
  cargaCatalogoSector = false,
  bypassGsoSoloLecturaLocal = false,
  preferSector = false,
}) {
  const esJefe = claimsIncludeJefe(claims);
  const hoy = new Date();
  const [periodo, setPeriodo] = useState(
    () => `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`,
  );
  const [modo, setModo] = useState(() =>
    preferSector ? GRILLA_MES_MODO.SECTOR : GRILLA_MES_MODO.EQUIPO,
  );
  const [grupoId, setGrupoId] = useState("");
  const [gruposEquipo, setGruposEquipo] = useState([]);
  const [gruposSector, setGruposSector] = useState([]);
  const [resolverCargando, setResolverCargando] = useState(false);
  const [sectorCargando, setSectorCargando] = useState(false);
  const [resolverError, setResolverError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [titularCalendarios, setTitularCalendarios] = useState([]);
  /** HLg del titular (solo lectura UI: cruz en días fuera del grupo en cada calendario). */
  const [titularHlgRows, setTitularHlgRows] = useState([]);
  const [titularHlgListo, setTitularHlgListo] = useState(false);
  const ultimoAvisoMatRef = useRef("");

  const { anio, mes } = anioMesDesdePeriodo(periodo);

  useEffect(() => {
    if (!esJefe) return;
    const normalizado = normalizarPeriodoJefe(periodo);
    if (normalizado !== periodo) setPeriodo(normalizado);
  }, [esJefe, periodo]);

  const recargarGruposEquipo = useCallback(async () => {
    const fechaCorte = fechaCorteFinMesDesdePeriodo(periodo);
    if (!/^per_/i.test(personaId) || !fechaCorte) {
      setGruposEquipo([]);
      setGrupoId("");
      return;
    }
    setResolverCargando(true);
    setResolverError("");
    try {
      const res = await callResolverContextoLaboralSolicitud({
        persona_id: personaId,
        fecha_desde: fechaCorte,
      });
      const list = res?.data?.grupos_trabajo_vigentes || [];
      const vigentes = Array.isArray(list) ? list : [];
      setGruposEquipo(vigentes);
      const sugerido = String(res?.data?.grupo_trabajo_id_ancla_sugerido || "").trim();
      setGrupoId((prev) => {
        const p = normalizeGrupoTrabajoId(prev);
        // Vista sector (catálogo): no pisar con HLg propia del operador RRHH.
        if (modo === GRILLA_MES_MODO.SECTOR && RX_GDT.test(p)) return p;
        return resolverGrupoIdInicial(vigentes, prev, sugerido);
      });
    } catch (e) {
      setGruposEquipo([]);
      setResolverError(e?.message || "No se pudo resolver grupos vigentes.");
    } finally {
      setResolverCargando(false);
    }
  }, [periodo, personaId, modo]);

  useEffect(() => {
    void recargarGruposEquipo();
  }, [recargarGruposEquipo]);

  useEffect(() => {
    if (!cargaCatalogoSector) return;
    let cancelled = false;
    (async () => {
      setSectorCargando(true);
      try {
        const rows = await listarColeccionLaboral("grupos_de_trabajo", 400);
        if (cancelled) return;
        const activos = rows.filter((r) => r.activo !== false);
        activos.sort((a, b) => etiquetaGrupoSector(a).localeCompare(etiquetaGrupoSector(b), "es"));
        setGruposSector(activos);
      } catch {
        if (!cancelled) setGruposSector([]);
      } finally {
        if (!cancelled) setSectorCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cargaCatalogoSector]);

  const onModoChange = useCallback(
    (next) => {
      setModo(next);
      setData(null);
      setTitularCalendarios([]);
      setError("");
      if (next === GRILLA_MES_MODO.SECTOR) {
        setGrupoId("");
      } else {
        void recargarGruposEquipo();
      }
    },
    [recargarGruposEquipo],
  );

  /** Tarjeta rápida: no dispara recarga de HLg que pisa el grupo elegido. */
  const aplicarSeleccionDesdeTarjeta = useCallback(({ periodo: p, modo: m, grupoId: gdt = "" }) => {
    setPeriodo(p);
    setModo(m);
    setData(null);
    setTitularCalendarios([]);
    setError("");
    if (m === GRILLA_MES_MODO.TITULAR) {
      setGrupoId("");
      return;
    }
    setGrupoId(normalizeGrupoTrabajoId(gdt));
  }, []);

  /** T-05: foco desde URL (sector RRHH) sin pasar por tarjetas. */
  const aplicarFocoOperativo = useCallback(({ periodo: p, grupoId: gdt = "", modo: m = GRILLA_MES_MODO.SECTOR }) => {
    setPeriodo(p);
    setModo(m);
    setGrupoId(normalizeGrupoTrabajoId(gdt));
    setError("");
    if (m === GRILLA_MES_MODO.TITULAR) {
      setData(null);
      return;
    }
    setData(null);
    setTitularCalendarios([]);
  }, []);

  const requiereSeleccionGrupo =
    (modo === GRILLA_MES_MODO.EQUIPO && !RX_GDT.test(grupoId))
    || (modo === GRILLA_MES_MODO.SECTOR && !RX_GDT.test(grupoId));

  const grupoActivoLabel = useMemo(() => {
    const id = normalizeGrupoTrabajoId(grupoId);
    if (modo === GRILLA_MES_MODO.SECTOR) {
      const row = gruposSector.find((g) => String(g.id || "").trim() === id);
      if (row) return etiquetaGrupoSector(row);
    }
    return etiquetaGrupoDesdeLista(gruposEquipo, grupoId);
  }, [modo, gruposEquipo, gruposSector, grupoId]);

  /**
   * @param {{ periodo?: string; modo?: string; grupoId?: string } | void} override
   */
  const cargar = useCallback(async (override) => {
    const periodoEff = override?.periodo ?? periodo;
    const modoEff = override?.modo ?? modo;
    const grupoEff =
      override?.grupoId != null
        ? normalizeGrupoTrabajoId(override.grupoId)
        : normalizeGrupoTrabajoId(grupoId);
    const { anio: anioEff, mes: mesEff } = anioMesDesdePeriodo(periodoEff);
    if (!anioEff || !mesEff) return;

    if (override?.periodo && override.periodo !== periodo) setPeriodo(override.periodo);
    if (override?.modo && override.modo !== modo) setModo(override.modo);
    if (override?.grupoId != null && grupoEff !== normalizeGrupoTrabajoId(grupoId)) {
      setGrupoId(grupoEff);
    }

    setLoading(true);
    setError("");
    setData(null);
    setTitularCalendarios([]);
    setTitularHlgListo(false);
    try {
      if (modoEff === GRILLA_MES_MODO.TITULAR) {
        if (!/^per_/i.test(personaId)) {
          setError("Sin persona en sesión.");
          return;
        }
        if (gruposEquipo.length === 0) {
          setError("Sin grupos de trabajo vigentes en el mes. Verificá tu HLg.");
          return;
        }
        const label =
          String(claims?.nombre_completo || claims?.display_name || "").trim() || personaId;
        const etiquetasGrupoMap = Object.fromEntries(
          gruposEquipo
            .map((g) => {
              const gdt = normalizeGrupoTrabajoId(g.grupo_de_trabajo_id);
              if (!RX_GDT.test(gdt)) return null;
              return [gdt, String(g.etiqueta_ui || gdt).trim()];
            })
            .filter(Boolean),
        );

        let hlgRows = [];
        try {
          hlgRows = await cargarHlgRowsParaTitular(personaId);
          setTitularHlgRows(hlgRows);
        } catch {
          setTitularHlgRows([]);
          hlgRows = [];
        } finally {
          setTitularHlgListo(true);
        }

        const tramosMes = hlgSegmentosTitularMes(hlgRows, anioEff, mesEff);
        const tramosCalendario =
          tramosMes.length > 0
            ? tramosMes
            : gruposEquipo
                .map((g) => {
                  const gdt = normalizeGrupoTrabajoId(g.grupo_de_trabajo_id);
                  if (!RX_GDT.test(gdt)) return null;
                  return {
                    calendario_id: gdt,
                    fila_id: gdt,
                    hlg_id: null,
                    grupo_de_trabajo_id: gdt,
                    vigente_desde: null,
                    vigente_hasta: null,
                  };
                })
                .filter(Boolean);

        const visPorGdt = new Map();
        const gdtsUnicos = [...new Set(tramosCalendario.map((t) => t.grupo_de_trabajo_id))];
        await Promise.all(
          gdtsUnicos.map(async (gdt) => {
            try {
              const res = await callObtenerVistaGrillaMesAgente({
                persona_id: personaId,
                grupo_trabajo_id: gdt,
                anio: anioEff,
                mes: mesEff,
              });
              const vista = res?.data || {};
              const msgLazy = mensajeToastMaterializacionLazy(vista);
              if (msgLazy) {
                toast(msgLazy, { id: `lazy-${gdt}-${periodoEff}` });
              }
              visPorGdt.set(gdt, {
                vis_id: vista.vis_id || null,
                existe: vista.existe === true,
                dias: vista.dias && typeof vista.dias === "object" ? vista.dias : {},
                materializado_lazy: vista.materializado_lazy === true,
                gso_solo_lectura: vista.gso_solo_lectura === true,
                estado_periodo_liquidacion_id: vista.estado_periodo_liquidacion_id || null,
              });
            } catch {
              const grupoLabel = etiquetasGrupoMap[gdt] || gdt;
              toast.error(`No se pudo cargar la grilla de ${grupoLabel}.`);
              visPorGdt.set(gdt, {
                vis_id: null,
                existe: false,
                dias: {},
                error_carga: true,
              });
            }
          }),
        );

        const resultados = tramosCalendario.map((tramo) => {
          const gdt = tramo.grupo_de_trabajo_id;
          const vis = visPorGdt.get(gdt) || {};
          return {
            calendario_id: tramo.calendario_id || tramo.fila_id || gdt,
            fila_id: tramo.fila_id || tramo.calendario_id || gdt,
            hlg_id: tramo.hlg_id || null,
            grupo_trabajo_id: gdt,
            grupo_label: etiquetasGrupoMap[gdt] || gdt,
            vigente_desde: tramo.vigente_desde || null,
            vigente_hasta: tramo.vigente_hasta || null,
            vis_id: vis.vis_id || null,
            existe: vis.existe === true,
            dias: vis.dias || {},
            materializado_lazy: vis.materializado_lazy === true,
            gso_solo_lectura: vis.gso_solo_lectura === true,
            estado_periodo_liquidacion_id: vis.estado_periodo_liquidacion_id || null,
            error_carga: vis.error_carga === true,
          };
        });

        setTitularCalendarios(resultados);
        const algunoSoloLectura = resultados.some((cal) => cal.gso_solo_lectura === true);
        setData({
          ok: true,
          modo: GRILLA_MES_MODO.TITULAR,
          fecha_corte: fechaCorteFinMesDesdePeriodo(periodoEff),
          total_personas: 1,
          total_cargos: resultados.length,
          total_tramos: tramosMes.length || resultados.length,
          truncado: false,
          gso_solo_lectura: algunoSoloLectura,
          gso_solo_lectura_motivo: algunoSoloLectura ? "ventana_mes_anterior_dia1" : null,
          filas: resultados.map((cal) => ({
            persona_id: personaId,
            persona_label: label,
            vis_id: cal.vis_id,
            existe: cal.existe,
            dias: cal.dias,
            grupo_trabajo_id: cal.grupo_trabajo_id,
            grupo_label: cal.grupo_label,
          })),
        });
        return;
      }

      const gdt = assertGrupoTrabajoId(
        grupoEff,
        modoEff === GRILLA_MES_MODO.SECTOR
          ? "Elegí un sector / grupo de trabajo."
          : "Elegí un grupo de trabajo vigente.",
      );
      const res = await callListarVistaGrillaMesPorGrupo({
        grupo_trabajo_id: gdt,
        anio: anioEff,
        mes: mesEff,
      });
      const payload = res?.data || null;
      if (payload?.truncado) {
        const key = `truncado-${periodoEff}-${gdt}`;
        if (ultimoAvisoMatRef.current !== key) {
          ultimoAvisoMatRef.current = key;
          toast("Listado acotado a 60 personas. Refiná el sector si hace falta.", { icon: "⚠️" });
        }
      }
      const matGrupo = payload?.materializacion_grupo;
      const msgMatGrupo = mensajeToastMaterializacionGrupo(matGrupo);
      if (msgMatGrupo) {
        toast(msgMatGrupo, { id: `mat-ok-${periodoEff}-${gdt}` });
      }
      if (matGrupo && matGrupo.ok === false && (matGrupo.fallos || 0) > 0) {
        toast.error(
          `Materialización del sector incompleta (${matGrupo.fallos} agente(s)). Revisá turnos teóricos.`,
        );
      }
      let planMensualEstado = null;
      try {
        const ctxRes = await callListarContextoPlanGrupo({
          grupo_id: gdt,
          periodo: periodoEff,
        });
        planMensualEstado = ctxRes?.data?.plan_mensual_estado ?? null;
      } catch {
        planMensualEstado = null;
      }
      setData(payload ? {
        ...payload,
        modo: modoEff,
        periodo: periodoEff,
        plan_mensual_estado: planMensualEstado,
        filas: normalizarFilasGrillaEquipo(payload.filas),
      } : null);
    } catch (e) {
      setData(null);
      setError(e?.message || "No se pudo cargar la grilla.");
    } finally {
      setLoading(false);
    }
  }, [
    modo,
    grupoId,
    anio,
    mes,
    personaId,
    periodo,
    claims,
    gruposEquipo,
  ]);

  const hintModo =
    modo === GRILLA_MES_MODO.TITULAR
      ? "Un calendario por cada tramo HLg vigente en el mes (turno teórico, licencias y feriados por grupo)."
      : modo === GRILLA_MES_MODO.EQUIPO
        ? "Tabla equipo: un renglón por tramo HLg del mes (máx. 60 personas)."
        : "Tabla sector RRHH según grupo elegido en catálogo.";

  const motivoApi = data?.gso_solo_lectura_motivo || null;
  const gsoEscrituraApi = data?.gso_solo_lectura === true
    ? {
        permite: false,
        mensaje: copyDetalleSoloLecturaGso(motivoApi),
        motivo: motivoApi,
      }
    : null;
  const gsoEscrituraLocal = gsoPermiteEscritura(periodo, {
    esRrhh: bypassGsoSoloLecturaLocal,
    periodoCerrado: motivoApi === "periodo_cerrado",
  });
  const gsoEscritura = gsoEscrituraApi || gsoEscrituraLocal;

  const filas = useMemo(
    () => normalizarFilasGrillaEquipo(data?.filas),
    [data?.filas],
  );
  const titularDias =
    modo === GRILLA_MES_MODO.TITULAR && titularCalendarios[0]?.dias
      ? titularCalendarios[0].dias
      : null;

  return {
    periodo,
    setPeriodo,
    modo,
    onModoChange,
    aplicarSeleccionDesdeTarjeta,
    aplicarFocoOperativo,
    grupoId,
    setGrupoId,
    gruposEquipo,
    gruposSector,
    resolverCargando,
    sectorCargando,
    resolverError,
    loading,
    error,
    data,
    cargar,
    hintModo,
    anio,
    mes,
    filas,
    totalFilas: data?.total_filas ?? filas.length,
    totalPersonas: data?.total_personas ?? 0,
    titularDias,
    titularCalendarios,
    titularHlgRows,
    titularHlgListo,
    esModoTitular: modo === GRILLA_MES_MODO.TITULAR,
    esMultiGrupo: gruposEquipo.length >= 2,
    requiereSeleccionGrupo,
    grupoActivoLabel,
    grupoActivoId: normalizeGrupoTrabajoId(grupoId),
    gsoPermiteEscritura: gsoEscritura.permite,
    gsoSoloLecturaMensaje: gsoEscritura.permite ? null : gsoEscritura.mensaje,
    gsoSoloLecturaMotivo: gsoEscritura.permite ? null : gsoEscritura.motivo || motivoApi,
    planMensualEstado: data?.plan_mensual_estado ?? null,
  };
}
