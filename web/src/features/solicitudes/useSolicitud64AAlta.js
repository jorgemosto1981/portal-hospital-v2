import { useCallback, useEffect, useState } from "react";

import { callListarArticulosIngresoAgente, callPrevisualizarSolicitudPatronB } from "../../services/callables.js";
import {
  crearSolicitudArticuloPatronBBorrador,
  esperarValidacionMotorPatronB,
} from "../../services/solicitudesArticuloV2Service.js";

function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * @param {{ personaId: string, fechaDesdeInicial?: string }} params
 */
export function useSolicitud64AAlta({ personaId, fechaDesdeInicial }) {
  const inicial =
    typeof fechaDesdeInicial === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaDesdeInicial)
      ? fechaDesdeInicial
      : ymdHoyBa();
  const [fechaDesde, setFechaDesde] = useState(inicial);

  useEffect(() => {
    if (typeof fechaDesdeInicial === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaDesdeInicial)) {
      setFechaDesde(fechaDesdeInicial);
    }
  }, [fechaDesdeInicial]);
  const [articulos, setArticulos] = useState([]);
  const [articuloSel, setArticuloSel] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [motivoVacio, setMotivoVacio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [previewCargando, setPreviewCargando] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
      setArticulos([]);
      setArticuloSel(null);
      setMotivoVacio("");
      return;
    }
    setCargando(true);
    setError("");
    setMotivoVacio("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaDesde });
      const list = res?.data?.articulos || [];
      setArticulos(list);
      setArticuloSel(list.length === 1 ? list[0] : null);
      if (list.length === 0) {
        const ev = res?.data?.elegibilidad_vacia;
        const msg = Array.isArray(ev?.mensajes) ? String(ev.mensajes[0] || "").trim() : "";
        setMotivoVacio(msg);
      }
    } catch (e) {
      setArticulos([]);
      setArticuloSel(null);
      setMotivoVacio("");
      setError(e?.message || "No se pudieron cargar los artículos disponibles.");
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, personaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
  }, [fechaDesde, articuloSel?.articulo_id]);

  const fechaHasta =
    articuloSel?.fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(String(articuloSel.fecha_hasta))
      ? String(articuloSel.fecha_hasta)
      : fechaDesde;

  const diasSolicitados =
    Number.isFinite(Number(articuloSel?.dias_solicitados)) && Number(articuloSel.dias_solicitados) > 0
      ? Math.floor(Number(articuloSel.dias_solicitados))
      : 1;

  const previsualizar = useCallback(async () => {
    if (!articuloSel || previewCargando || !/^per_/i.test(personaId)) return;
    setPreviewCargando(true);
    setPreviewError("");
    setPreview(null);
    try {
      const res = await callPrevisualizarSolicitudPatronB({
        articulo_id: articuloSel.articulo_id,
        version_id: articuloSel.version_id,
        fecha_desde: fechaDesde,
        dias_solicitados: diasSolicitados,
      });
      setPreview((res?.data && typeof res.data === "object" ? res.data : null) || null);
    } catch (e) {
      setPreview(null);
      setPreviewError(e?.message || "No se pudo previsualizar la solicitud.");
    } finally {
      setPreviewCargando(false);
    }
  }, [articuloSel, diasSolicitados, fechaDesde, personaId, previewCargando]);

  const previewVigente =
    preview &&
    articuloSel &&
    String(preview.articulo_id) === String(articuloSel.articulo_id) &&
    String(preview.fecha_desde) === fechaDesde &&
    Number(preview.dias_solicitados) === diasSolicitados;

  const puedeEnviarTrasPreview =
    previewVigente && (preview.eligible === true || preview.ok === true);

  const enviar = useCallback(async () => {
    if (!articuloSel || enviando || !puedeEnviarTrasPreview) return null;
    setEnviando(true);
    setError("");
    try {
      const { solicitud_id } = await crearSolicitudArticuloPatronBBorrador({
        personaId,
        articuloId: articuloSel.articulo_id,
        versionAplicadaId: articuloSel.version_id,
        fechaDesde,
        diasSolicitados,
      });
      await esperarValidacionMotorPatronB(solicitud_id);
      return solicitud_id;
    } catch (e) {
      setError(e?.message || "No se pudo enviar la solicitud.");
      return null;
    } finally {
      setEnviando(false);
    }
  }, [articuloSel, diasSolicitados, enviando, fechaDesde, personaId, puedeEnviarTrasPreview]);

  return {
    fechaDesde,
    fechaHasta,
    diasSolicitados,
    setFechaDesde,
    articulos,
    articuloSel,
    setArticuloSel,
    cargando,
    error,
    motivoVacio,
    enviando,
    recargar,
    enviar,
    preview,
    previewCargando,
    previewError,
    previsualizar,
    puedeEnviarTrasPreview,
  };
}
