import { useCallback, useEffect, useMemo, useState } from "react";

import {
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

function etiquetaGrupoSector(row) {
  const nombre = String(row.nombre || row.codigo || row.titulo || "").trim();
  return nombre || String(row.id || "");
}

/**
 * Estado y carga unificados calendario GSO (C2c + C2d).
 * Titular y equipo operan sobre un bounded context (gdt) activo.
 * @param {{ personaId: string; claims: Record<string, unknown> | null | undefined; esRrhh: boolean }} ctx
 */
export function useGrillaMesVista({ personaId, claims, esRrhh }) {
  const esJefe = claimsIncludeJefe(claims);
  const hoy = new Date();
  const [periodo, setPeriodo] = useState(
    () => `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`,
  );
  const [modo, setModo] = useState(GRILLA_MES_MODO.EQUIPO);
  const [grupoId, setGrupoId] = useState("");
  const [gruposEquipo, setGruposEquipo] = useState([]);
  const [gruposSector, setGruposSector] = useState([]);
  const [resolverCargando, setResolverCargando] = useState(false);
  const [sectorCargando, setSectorCargando] = useState(false);
  const [resolverError, setResolverError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [titularVisMeta, setTitularVisMeta] = useState(null);

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
      setGrupoId((prev) => resolverGrupoIdInicial(vigentes, prev, sugerido));
    } catch (e) {
      setGruposEquipo([]);
      setResolverError(e?.message || "No se pudo resolver grupos vigentes.");
    } finally {
      setResolverCargando(false);
    }
  }, [periodo, personaId]);

  useEffect(() => {
    void recargarGruposEquipo();
  }, [recargarGruposEquipo]);

  useEffect(() => {
    if (!esRrhh || modo !== GRILLA_MES_MODO.SECTOR) return;
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
  }, [esRrhh, modo]);

  const onModoChange = useCallback(
    (next) => {
      setModo(next);
      setData(null);
      setTitularVisMeta(null);
      setError("");
      if (next === GRILLA_MES_MODO.SECTOR) {
        setGrupoId("");
      } else {
        void recargarGruposEquipo();
      }
    },
    [recargarGruposEquipo],
  );

  const esMultiGrupoTitular = gruposEquipo.length >= 2;
  const requiereSeleccionGrupo =
    (modo === GRILLA_MES_MODO.TITULAR && esMultiGrupoTitular && !RX_GDT.test(grupoId))
    || (modo === GRILLA_MES_MODO.EQUIPO && !RX_GDT.test(grupoId))
    || (modo === GRILLA_MES_MODO.SECTOR && !RX_GDT.test(grupoId));

  const grupoActivoLabel = useMemo(
    () => etiquetaGrupoDesdeLista(gruposEquipo, grupoId),
    [gruposEquipo, grupoId],
  );

  const cargar = useCallback(async () => {
    if (!anio || !mes) return;
    setLoading(true);
    setError("");
    setData(null);
    setTitularVisMeta(null);
    try {
      if (modo === GRILLA_MES_MODO.TITULAR) {
        if (!/^per_/i.test(personaId)) {
          setError("Sin persona en sesión.");
          return;
        }
        if (gruposEquipo.length === 0) {
          setError("Sin grupos de trabajo vigentes en el mes. Verificá tu HLg.");
          return;
        }
        const gdt = assertGrupoTrabajoId(
          grupoId,
          esMultiGrupoTitular
            ? "Elegí el cargo (grupo de trabajo) para ver tu calendario."
            : "No se pudo resolver el grupo de trabajo vigente.",
        );
        const res = await callObtenerVistaGrillaMesAgente({
          persona_id: personaId,
          grupo_trabajo_id: gdt,
          anio,
          mes,
        });
        const vista = res?.data || {};
        setTitularVisMeta({
          vis_id: vista.vis_id,
          existe: vista.existe === true,
          grupo_trabajo_id: gdt,
        });
        const label =
          String(claims?.nombre_completo || claims?.display_name || "").trim() || personaId;
        const cargoLabel = etiquetaGrupoDesdeLista(gruposEquipo, gdt);
        setData({
          ok: true,
          modo: GRILLA_MES_MODO.TITULAR,
          grupo_trabajo_id: gdt,
          fecha_corte: fechaCorteFinMesDesdePeriodo(periodo),
          total_personas: 1,
          truncado: false,
          filas: [
            {
              persona_id: personaId,
              persona_label: label,
              vis_id: vista.vis_id,
              existe: vista.existe === true,
              dias: vista.dias || {},
              grupo_trabajo_id: gdt,
              grupo_label: cargoLabel,
            },
          ],
        });
        return;
      }

      const gdt = assertGrupoTrabajoId(
        grupoId,
        modo === GRILLA_MES_MODO.SECTOR
          ? "Elegí un sector / grupo de trabajo."
          : "Elegí un grupo de trabajo vigente.",
      );
      const res = await callListarVistaGrillaMesPorGrupo({
        grupo_trabajo_id: gdt,
        anio,
        mes,
      });
      const payload = res?.data || null;
      setData(payload ? { ...payload, modo } : null);
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
    gruposEquipo.length,
    esMultiGrupoTitular,
  ]);

  const hintModo =
    modo === GRILLA_MES_MODO.TITULAR
      ? "Calendario mensual del titular en el cargo seleccionado (vis_* por grupo)."
      : modo === GRILLA_MES_MODO.EQUIPO
        ? "Tabla equipo: HLg vigente al cierre del mes (máx. 60 personas)."
        : "Tabla sector RRHH según grupo elegido en catálogo.";

  const filas = Array.isArray(data?.filas) ? data.filas : [];
  const titularDias =
    modo === GRILLA_MES_MODO.TITULAR && filas[0]?.dias && typeof filas[0].dias === "object"
      ? filas[0].dias
      : null;

  return {
    periodo,
    setPeriodo,
    modo,
    onModoChange,
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
    titularDias,
    titularVisMeta,
    esModoTitular: modo === GRILLA_MES_MODO.TITULAR,
    esMultiGrupo: gruposEquipo.length >= 2,
    esMultiGrupoTitular,
    requiereSeleccionGrupo,
    grupoActivoLabel,
    grupoActivoId: normalizeGrupoTrabajoId(grupoId),
  };
}
