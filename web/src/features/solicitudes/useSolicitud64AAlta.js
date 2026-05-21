import { useCallback, useEffect, useState } from "react";

import {
  callListarArticulosIngresoAgente,
  callPrevisualizarSolicitudPatronB,
  callResolverContextoLaboralSolicitud,
} from "../../services/callables.js";
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
  const [gruposVigentes, setGruposVigentes] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [grupoAnclaId, setGrupoAnclaId] = useState("");
  const [gruposCargando, setGruposCargando] = useState(false);

  const recargarGrupos = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
      setGruposVigentes([]);
      setGrupoAnclaId("");
      return;
    }
    setGruposCargando(true);
    try {
      const res = await callResolverContextoLaboralSolicitud({ fecha_desde: fechaDesde });
      const list = res?.data?.grupos_trabajo_vigentes || [];
      setGruposVigentes(Array.isArray(list) ? list : []);
      const sugerido = String(res?.data?.grupo_trabajo_id_ancla_sugerido || "").trim();
      if (sugerido && list.some((g) => g.grupo_de_trabajo_id === sugerido)) {
        setGrupoAnclaId(sugerido);
      } else if (list.length === 1) {
        setGrupoAnclaId(String(list[0]?.grupo_de_trabajo_id || ""));
      } else {
        setGrupoAnclaId("");
      }
    } catch {
      setGruposVigentes([]);
      setGrupoAnclaId("");
    } finally {
      setGruposCargando(false);
    }
  }, [fechaDesde, personaId]);

  useEffect(() => {
    recargarGrupos();
  }, [recargarGrupos]);

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
  }, [fechaDesde, articuloSel?.articulo_id, grupoAnclaId]);

  const fechaHasta =
    articuloSel?.fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(String(articuloSel.fecha_hasta))
      ? String(articuloSel.fecha_hasta)
      : fechaDesde;

  const diasSolicitados =
    Number.isFinite(Number(articuloSel?.dias_solicitados)) && Number(articuloSel.dias_solicitados) > 0
      ? Math.floor(Number(articuloSel.dias_solicitados))
      : 1;

  const requiereSeleccionGrupo = gruposVigentes.length > 1;
  /** Con al menos un HLg vigente, siempre debe existir ancla (autoselección o select). */
  const grupoAnclaOk = gruposVigentes.length > 0 && /^gdt_/i.test(grupoAnclaId);

  const previsualizar = useCallback(async () => {
    if (!articuloSel || previewCargando || !/^per_/i.test(personaId) || !grupoAnclaOk) return;
    setPreviewCargando(true);
    setPreviewError("");
    setPreview(null);
    try {
      const body = {
        articulo_id: articuloSel.articulo_id,
        version_id: articuloSel.version_id,
        fecha_desde: fechaDesde,
        dias_solicitados: diasSolicitados,
      };
      if (/^gdt_/i.test(grupoAnclaId)) {
        body.grupo_trabajo_id_ancla = grupoAnclaId;
      }
      const res = await callPrevisualizarSolicitudPatronB(body);
      const data = res?.data && typeof res.data === "object" ? res.data : null;
      setPreview(data);
      if (data?.grupo_trabajo_id_ancla && /^gdt_/i.test(String(data.grupo_trabajo_id_ancla))) {
        setGrupoAnclaId(String(data.grupo_trabajo_id_ancla));
      }
    } catch (e) {
      setPreview(null);
      setPreviewError(e?.message || "No se pudo previsualizar la solicitud.");
    } finally {
      setPreviewCargando(false);
    }
  }, [
    articuloSel,
    diasSolicitados,
    fechaDesde,
    grupoAnclaId,
    grupoAnclaOk,
    personaId,
    previewCargando,
  ]);

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
      if (!grupoAnclaOk) {
        throw new Error("Elegí el grupo de trabajo sobre el que pedís la licencia.");
      }
      const { solicitud_id } = await crearSolicitudArticuloPatronBBorrador({
        personaId,
        articuloId: articuloSel.articulo_id,
        versionIdAplicada: articuloSel.version_id,
        fechaDesde,
        diasSolicitados,
        grupoTrabajoIdAncla: grupoAnclaId,
      });
      await esperarValidacionMotorPatronB(solicitud_id);
      return solicitud_id;
    } catch (e) {
      setError(e?.message || "No se pudo enviar la solicitud.");
      return null;
    } finally {
      setEnviando(false);
    }
  }, [
    articuloSel,
    diasSolicitados,
    enviando,
    fechaDesde,
    grupoAnclaId,
    grupoAnclaOk,
    personaId,
    puedeEnviarTrasPreview,
  ]);

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
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    gruposCargando,
    requiereSeleccionGrupo,
    grupoAnclaOk,
  };
}
