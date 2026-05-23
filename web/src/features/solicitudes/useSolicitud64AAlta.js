import { useCallback, useEffect, useMemo, useState } from "react";

import {
  callListarArticulosIngresoAgente,
  callPrevisualizarSolicitudPatronB,
  callResolverContextoLaboralSolicitud,
  callValidarEntornoOperativoSolicitud,
} from "../../services/callables.js";
import {
  crearSolicitudArticuloPatronBBorrador,
  esperarValidacionMotorPatronB,
} from "../../services/solicitudesArticuloV2Service.js";
import {
  articuloTieneDiasPreestablecidos,
  fechasSolicitudCompletas,
  resolverDiasSolicitadosPatronB,
} from "./patronBFechasUi.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * @param {{ personaId: string, fechaDesdeInicial?: string }} params
 */
export function useSolicitud64AAlta({ personaId, fechaDesdeInicial, articuloIdInicial = "" }) {
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
  const [validandoEntorno, setValidandoEntorno] = useState(false);
  const [entornoOk, setEntornoOk] = useState(false);
  const [entornoMensajes, setEntornoMensajes] = useState(/** @type {string[]} */ ([]));
  const [fechaHastaCalc, setFechaHastaCalc] = useState("");
  const [fechaHastaManual, setFechaHastaManual] = useState("");

  const diasPreestablecidos = useMemo(
    () => articuloTieneDiasPreestablecidos(articuloSel),
    [articuloSel],
  );

  const fechaHastaPreest =
    (fechaHastaCalc && RX_YMD.test(fechaHastaCalc) ? fechaHastaCalc : null) ||
    (articuloSel?.fecha_hasta && RX_YMD.test(String(articuloSel.fecha_hasta))
      ? String(articuloSel.fecha_hasta)
      : fechaDesde);

  const fechaHasta = diasPreestablecidos
    ? fechaHastaPreest
    : fechaHastaManual && RX_YMD.test(fechaHastaManual)
      ? fechaHastaManual
      : fechaHastaPreest;

  const fechasCompletas = fechasSolicitudCompletas(fechaDesde, fechaHasta);

  const diasDesdeArticulo =
    Number.isFinite(Number(articuloSel?.dias_solicitados)) && Number(articuloSel.dias_solicitados) > 0
      ? Math.floor(Number(articuloSel.dias_solicitados))
      : 1;

  const diasSolicitados = resolverDiasSolicitadosPatronB(
    fechaDesde,
    fechaHasta,
    diasPreestablecidos,
    diasDesdeArticulo,
  );

  const recargarGrupos = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !fechasCompletas) {
      setGruposVigentes([]);
      setGrupoAnclaId("");
      return;
    }
    setGruposCargando(true);
    try {
      const res = await callResolverContextoLaboralSolicitud({
        persona_id: personaId,
        fecha_desde: fechaDesde,
      });
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
  }, [fechaDesde, fechasCompletas, personaId]);

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
      const fijado = String(articuloIdInicial || "").trim();
      const match = fijado ? list.find((x) => String(x.articulo_id || "") === fijado) : null;
      setArticuloSel(match || (list.length === 1 ? list[0] : null));
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
  }, [fechaDesde, personaId, articuloIdInicial]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
    setFechaHastaCalc("");
    setFechaHastaManual("");
    setGrupoAnclaId("");
  }, [fechaDesde, articuloSel?.articulo_id, articuloSel?.version_id]);

  useEffect(() => {
    if (!diasPreestablecidos && RX_YMD.test(fechaDesde) && fechaHastaManual && fechaHastaManual < fechaDesde) {
      setFechaHastaManual(fechaDesde);
    }
  }, [diasPreestablecidos, fechaDesde, fechaHastaManual]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
  }, [grupoAnclaId]);

  const requiereSeleccionGrupo = gruposVigentes.length > 1;
  /** Con al menos un HLg vigente, siempre debe existir ancla (autoselección o select). */
  const grupoAnclaOk = gruposVigentes.length > 0 && /^gdt_/i.test(grupoAnclaId);

  const validarEntornoPaso2 = useCallback(async () => {
    if (!articuloSel || validandoEntorno || !/^per_/i.test(personaId)) {
      return { success: false };
    }
    if (!fechasCompletas) {
      setEntornoMensajes(["Completá las fechas del permiso."]);
      setEntornoOk(false);
      return { success: false };
    }

    setValidandoEntorno(true);
    setEntornoMensajes([]);
    setEntornoOk(false);

    try {
      const body = {
        persona_id: personaId,
        articulo_id: String(articuloSel.articulo_id || "").trim(),
        version_id: String(articuloSel.version_id || "").trim(),
        fecha_desde: fechaDesde,
        dias_solicitados: diasSolicitados,
      };
      if (/^gdt_/i.test(grupoAnclaId)) {
        body.grupo_trabajo_id_ancla = grupoAnclaId;
      }

      const res = await callValidarEntornoOperativoSolicitud(body);
      const data = res?.data && typeof res.data === "object" ? res.data : null;

      if (data?.ok === true && data?.puede_previsualizar === true) {
        const fh = String(data.fecha_hasta || "").slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(fh)) setFechaHastaCalc(fh);
        if (data.grupo_trabajo_id_ancla && /^gdt_/i.test(String(data.grupo_trabajo_id_ancla))) {
          setGrupoAnclaId(String(data.grupo_trabajo_id_ancla));
        }
        if (Array.isArray(data.grupos_trabajo_vigentes) && data.grupos_trabajo_vigentes.length) {
          setGruposVigentes(data.grupos_trabajo_vigentes);
        }
        setEntornoOk(true);
        setEntornoMensajes([]);
        return { success: true, data };
      }

      const mensajes = Array.isArray(data?.mensajes)
        ? data.mensajes.map((m) => String(m || "").trim()).filter(Boolean)
        : [];
      setEntornoMensajes(
        mensajes.length ? mensajes : ["No podés continuar: revisá fecha, grupo o turno en grilla."],
      );
      setEntornoOk(false);
      return { success: false, data };
    } catch (e) {
      setEntornoMensajes([
        e?.message || "Error de conexión con el servidor. Intentá de nuevo en unos segundos.",
      ]);
      setEntornoOk(false);
      return { success: false };
    } finally {
      setValidandoEntorno(false);
    }
  }, [
    articuloSel,
    diasSolicitados,
    fechaDesde,
    fechasCompletas,
    grupoAnclaId,
    personaId,
    validandoEntorno,
  ]);

  const previsualizar = useCallback(async (opts = {}) => {
    const forzarTrasEntorno = opts?.forzarTrasEntorno === true;
    if (!articuloSel || previewCargando || !/^per_/i.test(personaId) || !grupoAnclaOk) {
      return { ok: false };
    }
    if (!forzarTrasEntorno && !entornoOk) {
      return { ok: false };
    }
    setPreviewCargando(true);
    setPreviewError("");
    setPreview(null);
    try {
      const body = {
        persona_id: personaId,
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
      return { ok: false };
    } finally {
      setPreviewCargando(false);
    }
    return { ok: true };
  }, [
    articuloSel,
    diasSolicitados,
    fechaDesde,
    grupoAnclaId,
    grupoAnclaOk,
    personaId,
    previewCargando,
    entornoOk,
  ]);

  const previewVigente =
    entornoOk &&
    preview &&
    articuloSel &&
    String(preview.articulo_id) === String(articuloSel.articulo_id) &&
    String(preview.fecha_desde) === fechaDesde &&
    Number(preview.dias_solicitados) === diasSolicitados;

  const puedeEnviarTrasPreview =
    previewVigente && (preview.eligible === true || preview.ok === true);

  const reiniciarValidacionYPreview = useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
  }, []);

  const resetTrasEnvio = useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
    setFechaHastaCalc("");
    const fijado = String(articuloIdInicial || "").trim();
    const match = fijado ? articulos.find((x) => String(x.articulo_id || "") === fijado) : null;
    setArticuloSel(match || (articulos.length === 1 ? articulos[0] : null));
  }, [articulos, articuloIdInicial]);

  const enviar = useCallback(async () => {
    if (!articuloSel || enviando || !puedeEnviarTrasPreview || !entornoOk) return null;
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
      const motor = await esperarValidacionMotorPatronB(solicitud_id);
      resetTrasEnvio();
      return {
        solicitud_id,
        autorizacion_rrhh_sustituta: motor.solicitud?.autorizacion_rrhh_sustituta === true,
      };
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
    resetTrasEnvio,
    entornoOk,
  ]);

  const setFechaHasta = useCallback(
    (v) => {
      if (diasPreestablecidos) return;
      setFechaHastaManual(String(v || "").slice(0, 10));
      reiniciarValidacionYPreview();
    },
    [diasPreestablecidos, reiniciarValidacionYPreview],
  );

  return {
    fechaDesde,
    fechaHasta,
    diasSolicitados,
    diasPreestablecidos,
    fechasCompletas,
    setFechaDesde,
    setFechaHasta,
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
    resetTrasEnvio,
    validarEntornoPaso2,
    validandoEntorno,
    entornoOk,
    entornoMensajes,
    reiniciarValidacionYPreview,
  };
}
