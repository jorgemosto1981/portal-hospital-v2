/**
 * Hook alta CAMBIO-DIA — origen / destino / motivo (sin saldos).
 */
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
import { enriquecerArticuloIngresoListado } from "./enriquecerArticuloIngresoListado.js";
import {
  articuloEsCambioDia,
  CAMBIO_DIA_TOMA_CONOCIMIENTO_TEXTO,
  CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS,
  mensajesValidacionFechasCambioDia,
  rangoFechaDestinoCambioDia,
  ymdMinimoPreaviso,
} from "./cambioDiaUi.js";
import { formatearMensajesEntorno } from "./formatearMensajeEntorno.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

/**
 * @param {{ personaId: string, articuloIdInicial?: string }} params
 */
export function useSolicitudCambioDiaAlta({ personaId, articuloIdInicial = "" }) {
  const [fechaOrigen, setFechaOrigen] = useState("");
  const [fechaDestino, setFechaDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tomaConocimiento, setTomaConocimiento] = useState(false);
  const [articuloSel, setArticuloSel] = useState(null);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
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

  const ext = articuloSel?.cambio_dia_solicitud;
  const motivoMax =
    Number.isFinite(Number(ext?.motivo_max_len)) && Number(ext.motivo_max_len) > 0
      ? Math.floor(Number(ext.motivo_max_len))
      : 500;
  const preaviso =
    articuloSel?.plazo_preaviso_interno_dias == null
      ? 2
      : Math.max(0, Math.floor(Number(articuloSel.plazo_preaviso_interno_dias)));
  const permiteRetro = articuloSel?.permite_retroactividad === true;
  const ymdMin = useMemo(() => ymdMinimoPreaviso(preaviso), [preaviso]);

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId)) {
      setArticulos([]);
      setArticuloSel(null);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: ymdHoyBa() });
      const list = (res?.data?.articulos || [])
        .map((row) => enriquecerArticuloIngresoListado(row))
        .filter(Boolean)
        .filter((a) => articuloEsCambioDia(a));
      setArticulos(list);
      const fijado = String(articuloIdInicial || "").trim();
      const match = fijado ? list.find((x) => String(x.articulo_id || "") === fijado) : null;
      setArticuloSel(match || (list.length === 1 ? list[0] : null));
      if (fijado && !match) {
        setError("Este artículo no está habilitado para cambio de día en tu circuito.");
      }
    } catch (e) {
      setArticulos([]);
      setArticuloSel(null);
      setError(e?.message || "No se pudo cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }, [articuloIdInicial, personaId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const reiniciarValidacionYPreview = useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
  }, []);

  const setFechaOrigenConReset = useCallback(
    (v) => {
      setFechaOrigen(String(v || "").slice(0, 10));
      reiniciarValidacionYPreview();
    },
    [reiniciarValidacionYPreview],
  );

  const setFechaDestinoConReset = useCallback(
    (v) => {
      setFechaDestino(String(v || "").slice(0, 10));
      reiniciarValidacionYPreview();
    },
    [reiniciarValidacionYPreview],
  );

  const setMotivoConReset = useCallback(
    (v) => {
      setMotivo(String(v || ""));
      reiniciarValidacionYPreview();
    },
    [reiniciarValidacionYPreview],
  );

  const rangoDestino = useMemo(
    () => rangoFechaDestinoCambioDia(fechaOrigen, ymdMin, CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS),
    [fechaOrigen, ymdMin],
  );

  const warningsFechas = useMemo(
    () =>
      mensajesValidacionFechasCambioDia(fechaOrigen, fechaDestino, ymdMin, {
        permiteRetroactividad: permiteRetro,
        ventana: CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS,
        hoyYmd: ymdHoyBa(),
      }),
    [fechaDestino, fechaOrigen, permiteRetro, ymdMin],
  );

  const fechasOk = useMemo(() => {
    const fo = String(fechaOrigen || "").trim();
    const fd = String(fechaDestino || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fo) || !/^\d{4}-\d{2}-\d{2}$/.test(fd)) return false;
    return warningsFechas.length === 0;
  }, [fechaDestino, fechaOrigen, warningsFechas]);

  const motivoOk = motivo.trim().length >= 3 && motivo.trim().length <= motivoMax;
  const tomaConocimientoOk = tomaConocimiento === true;

  useEffect(() => {
    const fd = String(fechaDestino || "").trim();
    if (!fd || !rangoDestino.ok) return;
    if (
      (/^\d{4}-\d{2}-\d{2}$/.test(rangoDestino.min) && fd < rangoDestino.min) ||
      (/^\d{4}-\d{2}-\d{2}$/.test(rangoDestino.max) && fd > rangoDestino.max)
    ) {
      setFechaDestino("");
      reiniciarValidacionYPreview();
    }
  }, [fechaDestino, rangoDestino, reiniciarValidacionYPreview]);

  const recargarGrupos = useCallback(async () => {
    const fo = String(fechaOrigen || "").trim().slice(0, 10);
    if (!/^per_/i.test(personaId) || !/^\d{4}-\d{2}-\d{2}$/.test(fo)) {
      setGruposVigentes([]);
      setGrupoAnclaId("");
      return;
    }
    setGruposCargando(true);
    try {
      const res = await callResolverContextoLaboralSolicitud({
        persona_id: personaId,
        fecha_desde: fo,
        fecha_hasta: fo,
      });
      const grupos = Array.isArray(res?.data?.grupos_trabajo_vigentes)
        ? res.data.grupos_trabajo_vigentes
        : Array.isArray(res?.data?.grupos_vigentes)
          ? res.data.grupos_vigentes
          : [];
      setGruposVigentes(grupos);
      if (grupos.length === 1) {
        setGrupoAnclaId(
          String(grupos[0]?.grupo_de_trabajo_id || grupos[0]?.grupo_trabajo_id || grupos[0]?.id || "").trim(),
        );
      } else {
        setGrupoAnclaId((prev) => {
          const still = grupos.some(
            (g) =>
              String(g?.grupo_de_trabajo_id || g?.grupo_trabajo_id || g?.id || "").trim() === prev,
          );
          return still ? prev : "";
        });
      }
    } catch {
      setGruposVigentes([]);
      setGrupoAnclaId("");
    } finally {
      setGruposCargando(false);
    }
  }, [fechaOrigen, personaId]);

  useEffect(() => {
    void recargarGrupos();
  }, [recargarGrupos]);

  const grupoAnclaOk = Boolean(grupoAnclaId && /^gdt_/i.test(grupoAnclaId));
  const requiereSeleccionGrupo = gruposVigentes.length > 1;

  const validarEntornoPaso2 = useCallback(async () => {
    if (!articuloSel || !fechasOk || !grupoAnclaOk || !motivoOk) return false;
    setValidandoEntorno(true);
    setEntornoMensajes([]);
    try {
      const res = await callValidarEntornoOperativoSolicitud({
        persona_id: personaId,
        articulo_id: articuloSel.articulo_id,
        version_id: articuloSel.version_id,
        fecha_desde: fechaOrigen,
        fecha_hasta: fechaOrigen,
        grupo_trabajo_id_ancla: grupoAnclaId,
      });
      const ok = res?.data?.ok === true || res?.data?.entorno_ok === true;
      const msgs = formatearMensajesEntorno(res?.data);
      setEntornoOk(ok);
      setEntornoMensajes(msgs);
      return ok;
    } catch (e) {
      setEntornoOk(false);
      setEntornoMensajes([e?.message || "No se pudo validar el entorno."]);
      return false;
    } finally {
      setValidandoEntorno(false);
    }
  }, [
    articuloSel,
    fechaOrigen,
    fechasOk,
    grupoAnclaId,
    grupoAnclaOk,
    motivoOk,
    personaId,
  ]);

  const previsualizar = useCallback(async () => {
    if (!articuloSel || !fechasOk || !grupoAnclaOk || !motivoOk) return null;
    setPreviewCargando(true);
    setPreviewError("");
    try {
      const res = await callPrevisualizarSolicitudPatronB({
        articulo_id: articuloSel.articulo_id,
        version_id: articuloSel.version_id,
        fecha_desde: fechaOrigen,
        dias_solicitados: 1,
        grupo_trabajo_id_ancla: grupoAnclaId,
        fecha_origen: fechaOrigen,
        fecha_destino: fechaDestino,
        motivo: motivo.trim(),
        es_cambio_dia: true,
      });
      const data = res?.data || {};
      setPreview(data);
      if (data.ok !== true && data.eligible !== true) {
        const msgs = Array.isArray(data.mensajes) ? data.mensajes.filter(Boolean) : [];
        setPreviewError(msgs[0] || "La previsualización no es elegible.");
      }
      return data;
    } catch (e) {
      setPreview(null);
      setPreviewError(e?.message || "No se pudo previsualizar.");
      return null;
    } finally {
      setPreviewCargando(false);
    }
  }, [
    articuloSel,
    fechaDestino,
    fechaOrigen,
    fechasOk,
    grupoAnclaId,
    grupoAnclaOk,
    motivo,
    motivoOk,
  ]);

  const enviar = useCallback(async () => {
    if (
      !articuloSel ||
      enviando ||
      validandoEntorno ||
      previewCargando ||
      !fechasOk ||
      !motivoOk ||
      !grupoAnclaOk ||
      !tomaConocimientoOk
    ) {
      return null;
    }
    setError("");
    setPreviewError("");
    setEntornoMensajes([]);

    const okEntorno = await validarEntornoPaso2();
    if (!okEntorno) return null;

    const data = await previsualizar();
    if (!data || (data.ok !== true && data.eligible !== true)) {
      return null;
    }

    setEnviando(true);
    try {
      const { solicitud_id } = await crearSolicitudArticuloPatronBBorrador({
        personaId,
        articuloId: articuloSel.articulo_id,
        versionIdAplicada: articuloSel.version_id,
        fechaDesde: fechaOrigen,
        fechaHasta: fechaOrigen,
        diasSolicitados: 1,
        grupoTrabajoIdAncla: grupoAnclaId,
        esCambioDia: true,
        fechaOrigen,
        fechaDestino,
        motivo: motivo.trim(),
        tomaConocimientoAgente: true,
        tomaConocimientoTexto: CAMBIO_DIA_TOMA_CONOCIMIENTO_TEXTO,
      });
      const motor = await esperarValidacionMotorPatronB(solicitud_id);
      setPreview(null);
      setPreviewError("");
      setEntornoOk(false);
      setEntornoMensajes([]);
      setFechaOrigen("");
      setFechaDestino("");
      setMotivo("");
      setTomaConocimiento(false);
      return {
        solicitud_id,
        autorizacion_rrhh_sustituta: motor.solicitud?.autorizacion_rrhh_sustituta === true,
        estado_solicitud_id: motor.estado_solicitud_id,
      };
    } catch (e) {
      setError(e?.message || "No se pudo enviar la solicitud.");
      return null;
    } finally {
      setEnviando(false);
    }
  }, [
    articuloSel,
    enviando,
    fechaDestino,
    fechaOrigen,
    fechasOk,
    grupoAnclaId,
    grupoAnclaOk,
    motivo,
    motivoOk,
    personaId,
    previsualizar,
    previewCargando,
    tomaConocimientoOk,
    validandoEntorno,
    validarEntornoPaso2,
  ]);

  const puedeEnviar =
    Boolean(articuloSel) &&
    fechasOk &&
    motivoOk &&
    grupoAnclaOk &&
    tomaConocimientoOk &&
    !enviando &&
    !validandoEntorno &&
    !previewCargando &&
    !cargando;

  return {
    articulos,
    articuloSel,
    setArticuloSel,
    cargando,
    error,
    fechaOrigen,
    setFechaOrigen: setFechaOrigenConReset,
    fechaDestino,
    setFechaDestino: setFechaDestinoConReset,
    motivo,
    setMotivo: setMotivoConReset,
    motivoMax,
    ymdMin,
    preaviso,
    fechasOk,
    warningsFechas,
    rangoDestino,
    ventanaMaxDias: CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS,
    motivoOk,
    tomaConocimiento,
    setTomaConocimiento,
    tomaConocimientoOk,
    tomaConocimientoTexto: CAMBIO_DIA_TOMA_CONOCIMIENTO_TEXTO,
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    gruposCargando,
    requiereSeleccionGrupo,
    grupoAnclaOk,
    validarEntornoPaso2,
    validandoEntorno,
    entornoOk,
    entornoMensajes,
    reiniciarValidacionYPreview,
    previsualizar,
    preview,
    previewCargando,
    previewError,
    puedeEnviar,
    enviar,
    enviando,
    recargar,
  };
}
