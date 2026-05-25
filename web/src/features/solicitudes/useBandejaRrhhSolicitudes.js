import { useCallback, useEffect, useState } from "react";

import { callListarSolicitudesBandejaRrhh } from "../../services/callables.js";

export const FILTROS_VISTA_RRHH = [
  { value: "pendientes", label: "Pendientes de autorizar (RRHH)" },
  { value: "todos", label: "Todos (incl. aprobados y rechazados)" },
  { value: "toma_conocimiento_pendiente", label: "Toma de conocimiento pendiente" },
  { value: "aprobados", label: "Aprobados" },
  { value: "rechazados", label: "Rechazados" },
  { value: "en_revision_jefe", label: "En revisión jefatura" },
  { value: "en_revision_rrhh", label: "En revisión RRHH (legacy)" },
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

  const aplicarFiltros = useCallback(() => {
    const f = {
      filtroVista,
      dni,
      usuario,
    };
    setApplied(f);
    void recargar(f);
  }, [filtroVista, dni, usuario, recargar]);

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
    pageSize: PAGE_SIZE,
  };
}
