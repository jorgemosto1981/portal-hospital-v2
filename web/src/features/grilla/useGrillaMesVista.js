import { useCallback, useEffect, useState } from "react";

import {
  callListarVistaGrillaMesPorGrupo,
  callObtenerVistaGrillaMesAgente,
  callResolverContextoLaboralSolicitud,
} from "../../services/callables.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";
import { anioMesDesdePeriodo, fechaCorteFinMesDesdePeriodo } from "./grillaMesPeriodoUtils.js";

function etiquetaGrupoSector(row) {
  const nombre = String(row.nombre || row.codigo || row.titulo || "").trim();
  return nombre || String(row.id || "");
}

/**
 * Estado y carga unificados calendario GSO (C2c + C2d).
 * @param {{ personaId: string; claims: Record<string, unknown> | null | undefined; esRrhh: boolean }} ctx
 */
export function useGrillaMesVista({ personaId, claims, esRrhh }) {
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
      if (modo === GRILLA_MES_MODO.EQUIPO) {
        setGrupoId((prev) => {
          const ids = vigentes.map((g) => String(g.grupo_de_trabajo_id || ""));
          if (prev && ids.includes(prev)) return prev;
          if (sugerido && ids.includes(sugerido)) return sugerido;
          if (vigentes.length === 1) return ids[0] || "";
          return "";
        });
      }
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
      if (next === GRILLA_MES_MODO.TITULAR) {
        setGrupoId("");
      } else if (next === GRILLA_MES_MODO.EQUIPO) {
        void recargarGruposEquipo();
      } else if (next === GRILLA_MES_MODO.SECTOR) {
        setGrupoId("");
      }
    },
    [recargarGruposEquipo],
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
        const res = await callObtenerVistaGrillaMesAgente({
          persona_id: personaId,
          anio,
          mes,
        });
        const vista = res?.data || {};
        setTitularVisMeta({ vis_id: vista.vis_id, existe: vista.existe === true });
        const label =
          String(claims?.nombre_completo || claims?.display_name || "").trim() || personaId;
        setData({
          ok: true,
          modo: GRILLA_MES_MODO.TITULAR,
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
            },
          ],
        });
        return;
      }

      const gdt = grupoId.trim();
      if (!/^gdt_/i.test(gdt)) {
        setError("Elegí un grupo de trabajo vigente.");
        return;
      }
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
  }, [modo, grupoId, anio, mes, personaId, periodo, claims]);

  const hintModo =
    modo === GRILLA_MES_MODO.TITULAR
      ? "Calendario mensual del titular (documento vis_* de MDC)."
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
  };
}
