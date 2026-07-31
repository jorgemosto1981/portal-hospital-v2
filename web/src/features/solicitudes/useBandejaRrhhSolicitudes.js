import { useCallback, useEffect, useState } from "react";

import { callListarSolicitudesBandejaRrhh } from "../../services/callables.js";

/**
 * Vistas de la bandeja RRHH, agrupadas por para qué se usan: primero lo que
 * espera una acción de RRHH, después el seguimiento por estado.
 *
 * Cubren el catálogo completo salvo el borrador, que todavía no salió del agente.
 * @type {{ grupo: string, opciones: { value: string, label: string }[] }[]}
 */
export const GRUPOS_FILTRO_VISTA_RRHH = [
  {
    grupo: "Pendiente de RRHH",
    opciones: [
      { value: "pendientes", label: "Todo lo que espera una acción mía" },
      { value: "toma_conocimiento_pendiente", label: "Toma de conocimiento pendiente" },
      { value: "huerfanas", label: "Huérfanas — cierre sustituto RRHH" },
      { value: "en_revision_rrhh", label: "Pendiente RRHH (legacy)" },
    ],
  },
  {
    grupo: "Seguimiento por estado",
    opciones: [
      { value: "en_revision_jefe", label: "En revisión de jefatura" },
      { value: "circuito_medico", label: "En circuito médico (auditoría o junta)" },
      { value: "aprobados", label: "Aprobadas" },
      { value: "aprobada_pendiente_aplicacion", label: "Aprobadas — pendientes de aplicación" },
      { value: "toma_conocimiento_ok", label: "Con toma de conocimiento registrada" },
      { value: "rechazados", label: "Rechazadas" },
    ],
  },
  {
    grupo: "Sin filtrar",
    opciones: [{ value: "todos", label: "Todas las solicitudes presentadas" }],
  },
];


const PAGE_SIZE = 10;

/**
 * Lista paginada bandeja RRHH (lazy load por cursor).
 */
export function useBandejaRrhhSolicitudes() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [totalFiltrado, setTotalFiltrado] = useState(null);

  const [filtroVista, setFiltroVista] = useState("pendientes");
  const [dni, setDni] = useState("");
  const [usuario, setUsuario] = useState("");

  const [applied, setApplied] = useState({
    filtroVista: "pendientes",
    dni: "",
    usuario: "",
  });

  const fetchPage = useCallback(
    async ({ append = false, cursor = null, filtros = applied } = {}) => {
      const body = {
        filtro_vista: filtros.filtroVista,
        page_size: PAGE_SIZE,
        dni: filtros.dni.replace(/\D/g, "").trim() || undefined,
        usuario: filtros.usuario.trim() || undefined,
        cursor: cursor || undefined,
      };
      const res = await callListarSolicitudesBandejaRrhh(body);
      const batch = res?.data?.solicitudes || [];
      const info = res?.data?.page_info || {};
      setHasMore(info.has_more === true);
      setNextCursor(info.next_cursor || null);
      setTotalFiltrado(typeof info.total_filtrado === "number" ? info.total_filtrado : null);
      setLista((prev) => (append ? [...prev, ...batch] : batch));
    },
    [applied],
  );

  const recargar = useCallback(
    async (filtrosOverride) => {
      const f = filtrosOverride || applied;
      setCargando(true);
      setError("");
      setNextCursor(null);
      try {
        await fetchPage({ append: false, filtros: f });
      } catch (e) {
        setLista([]);
        setHasMore(false);
        setTotalFiltrado(null);
        setError(e?.message || "No se pudo cargar la bandeja RRHH.");
      } finally {
        setCargando(false);
      }
    },
    [applied, fetchPage],
  );

  useEffect(() => {
    void recargar(applied);
    // Solo montaje inicial con filtros por defecto (pendientes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarMas = useCallback(async () => {
    if (!hasMore || !nextCursor || cargandoMas || cargando) return;
    setCargandoMas(true);
    setError("");
    try {
      await fetchPage({ append: true, cursor: nextCursor });
    } catch (e) {
      setError(e?.message || "No se pudo cargar más solicitudes.");
    } finally {
      setCargandoMas(false);
    }
  }, [fetchPage, hasMore, nextCursor, cargandoMas, cargando]);

  /**
   * Aplica filtros venidos de afuera del formulario (p. ej. saltar al trámite
   * relacionado desde la trazabilidad) sincronizando también los controles.
   * @param {{ filtroVista: string, dni?: string, usuario?: string }} filtros
   */
  const aplicarFiltrosCon = useCallback(
    async (filtros) => {
      const f = {
        filtroVista: filtros.filtroVista,
        dni: filtros.dni || "",
        usuario: filtros.usuario || "",
      };
      setFiltroVista(f.filtroVista);
      setDni(f.dni);
      setUsuario(f.usuario);
      setApplied(f);
      await recargar(f);
    },
    [recargar],
  );

  const aplicarFiltros = useCallback(() => {
    void aplicarFiltrosCon({ filtroVista, dni, usuario });
  }, [filtroVista, dni, usuario, aplicarFiltrosCon]);

  return {
    lista,
    cargando,
    cargandoMas,
    error,
    hasMore,
    totalFiltrado,
    filtroVista,
    setFiltroVista,
    dni,
    setDni,
    usuario,
    setUsuario,
    recargar: () => recargar(applied),
    cargarMas,
    aplicarFiltros,
    aplicarFiltrosCon,
    pageSize: PAGE_SIZE,
  };
}
