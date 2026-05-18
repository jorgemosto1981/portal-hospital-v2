import { useCallback, useEffect, useState } from "react";

import { callListarArticulosIngresoAgente } from "../../services/callables.js";
import {
  crearSolicitudArticuloPatronBBorrador,
  esperarValidacionMotorPatronB,
} from "../../services/solicitudesArticuloV2Service.js";

function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * @param {{ personaId: string }} params
 */
export function useSolicitud64AAlta({ personaId }) {
  const [fechaDesde, setFechaDesde] = useState(ymdHoyBa);
  const [articulos, setArticulos] = useState([]);
  const [articuloSel, setArticuloSel] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
      setArticulos([]);
      setArticuloSel(null);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaDesde });
      const list = res?.data?.articulos || [];
      setArticulos(list);
      setArticuloSel(list.length === 1 ? list[0] : null);
    } catch (e) {
      setArticulos([]);
      setArticuloSel(null);
      setError(e?.message || "No se pudieron cargar los artículos disponibles.");
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, personaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const enviar = useCallback(async () => {
    if (!articuloSel || enviando) return null;
    setEnviando(true);
    setError("");
    try {
      const { solicitud_id } = await crearSolicitudArticuloPatronBBorrador({
        personaId,
        articuloId: articuloSel.articulo_id,
        versionAplicadaId: articuloSel.version_id,
        fechaDesde,
        diasSolicitados: 1,
      });
      await esperarValidacionMotorPatronB(solicitud_id);
      return solicitud_id;
    } catch (e) {
      setError(e?.message || "No se pudo enviar la solicitud.");
      return null;
    } finally {
      setEnviando(false);
    }
  }, [articuloSel, enviando, fechaDesde, personaId]);

  return {
    fechaDesde,
    setFechaDesde,
    articulos,
    articuloSel,
    setArticuloSel,
    cargando,
    error,
    enviando,
    recargar,
    enviar,
  };
}
