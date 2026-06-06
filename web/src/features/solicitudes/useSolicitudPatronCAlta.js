import { useCallback, useEffect, useMemo, useState } from "react";

import {
  callListarArticulosIngresoAgente,
  callPrevisualizarSolicitudPatronC,
  callResolverContextoLaboralSolicitud,
  callValidarEntornoOperativoSolicitud,
} from "../../services/callables.js";
import {
  crearSolicitudArticuloPatronCBorrador,
  esperarValidacionMotorPatronC,
} from "../../services/solicitudesArticuloV2Service.js";
import { formatearMensajesEntorno } from "./formatearMensajeEntorno.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * @param {{ personaId: string, fechaDesdeInicial?: string, articuloIdInicial?: string }} params
 */
export function useSolicitudPatronCAlta({ personaId, fechaDesdeInicial, articuloIdInicial = "" }) {
  const inicial =
    typeof fechaDesdeInicial === "string" && RX_YMD.test(fechaDesdeInicial)
      ? fechaDesdeInicial
      : ymdHoyBa();
  const [fechaDesde, setFechaDesde] = useState(inicial);
  const [fechaHasta, setFechaHastaRaw] = useState(inicial);
  const [horasSolicitadas, setHorasSolicitadas] = useState(/** @type {number|string} */ (""));

  useEffect(() => {
    if (typeof fechaDesdeInicial === "string" && RX_YMD.test(fechaDesdeInicial)) {
      setFechaDesde(fechaDesdeInicial);
      setFechaHastaRaw(fechaDesdeInicial);
    }
  }, [fechaDesdeInicial]);

  const [articuloNombre, setArticuloNombre] = useState("");
  const [articuloSel, setArticuloSel] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewCargando, setPreviewCargando] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [gruposVigentes, setGruposVigentes] = useState([]);
  const [grupoAnclaId, setGrupoAnclaId] = useState("");
  const [gruposCargando, setGruposCargando] = useState(false);
  const [validandoEntorno, setValidandoEntorno] = useState(false);
  const [entornoOk, setEntornoOk] = useState(false);
  const [entornoMensajes, setEntornoMensajes] = useState([]);

  const fechasCompletas = RX_YMD.test(fechaDesde) && RX_YMD.test(fechaHasta);
  const horasNum = Number(horasSolicitadas);
  const horasOk = Number.isFinite(horasNum) && horasNum > 0;

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

  useEffect(() => { recargarGrupos(); }, [recargarGrupos]);

  const recargar = useCallback(async () => {
    if (!/^per_/i.test(personaId) || !RX_YMD.test(fechaDesde)) {
      setArticuloSel(null);
      setArticuloNombre("");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await callListarArticulosIngresoAgente({ fecha_desde: fechaDesde });
      const list = res?.data?.articulos || [];
      const fijado = String(articuloIdInicial || "").trim();
      const match = fijado
        ? list.find((x) => String(x.articulo_id || "") === fijado && String(x.patron_saldo || "") === "C")
        : null;
      setArticuloSel(match || null);
      setArticuloNombre(match ? String(match.nombre || match.codigo_grilla || "Compensatorio") : "");
    } catch (e) {
      setArticuloSel(null);
      setArticuloNombre("");
      setError(e?.message || "No se pudieron cargar los artículos disponibles.");
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, personaId, articuloIdInicial]);

  useEffect(() => { recargar(); }, [recargar]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
  }, [fechaDesde, fechaHasta, horasSolicitadas, articuloSel?.articulo_id]);

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    setEntornoOk(false);
    setEntornoMensajes([]);
  }, [grupoAnclaId]);

  const requiereSeleccionGrupo = gruposVigentes.length > 1;
  const grupoAnclaOk = gruposVigentes.length > 0 && /^gdt_/i.test(grupoAnclaId);

  const validarEntornoPaso2 = useCallback(async () => {
    if (!articuloSel || validandoEntorno || !/^per_/i.test(personaId)) return { success: false };
    if (!fechasCompletas || !horasOk) {
      setEntornoMensajes(["Completá fecha y horas solicitadas."]);
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
        dias_solicitados: 1,
      };
      if (/^gdt_/i.test(grupoAnclaId)) body.grupo_trabajo_id_ancla = grupoAnclaId;

      const res = await callValidarEntornoOperativoSolicitud(body);
      const data = res?.data && typeof res.data === "object" ? res.data : null;
      if (data?.ok === true && data?.puede_previsualizar === true) {
        if (data.grupo_trabajo_id_ancla && /^gdt_/i.test(String(data.grupo_trabajo_id_ancla))) {
          setGrupoAnclaId(String(data.grupo_trabajo_id_ancla));
        }
        if (Array.isArray(data.grupos_trabajo_vigentes) && data.grupos_trabajo_vigentes.length) {
          setGruposVigentes(data.grupos_trabajo_vigentes);
        }
        setEntornoOk(true);
        return { success: true, data };
      }
      const raw = Array.isArray(data?.mensajes)
        ? data.mensajes.map((m) => String(m || "").trim()).filter(Boolean)
        : [];
      const vigentes = Array.isArray(data?.grupos_trabajo_vigentes)
        ? data.grupos_trabajo_vigentes
        : gruposVigentes;
      const mensajes = formatearMensajesEntorno(
        raw.length ? raw : ["No podés continuar: revisá fecha, grupo o turno."],
        vigentes,
      );
      setEntornoMensajes(mensajes);
      setEntornoOk(false);
      return { success: false, data };
    } catch (e) {
      setEntornoMensajes([e?.message || "Error de conexión."]);
      setEntornoOk(false);
      return { success: false };
    } finally {
      setValidandoEntorno(false);
    }
  }, [articuloSel, fechaDesde, fechasCompletas, grupoAnclaId, gruposVigentes, horasOk, personaId, validandoEntorno]);

  const previsualizar = useCallback(async (opts = {}) => {
    const forzarTrasEntorno = opts?.forzarTrasEntorno === true;
    if (!articuloSel || previewCargando || !/^per_/i.test(personaId) || !grupoAnclaOk || !horasOk) return { ok: false };
    if (!forzarTrasEntorno && !entornoOk) return { ok: false };
    setPreviewCargando(true);
    setPreviewError("");
    setPreview(null);
    try {
      const body = {
        articulo_id: articuloSel.articulo_id,
        version_id: articuloSel.version_id,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        horas_solicitadas: horasNum,
      };
      if (/^gdt_/i.test(grupoAnclaId)) body.grupo_trabajo_id_ancla = grupoAnclaId;
      const res = await callPrevisualizarSolicitudPatronC(body);
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
  }, [articuloSel, entornoOk, fechaDesde, fechaHasta, grupoAnclaId, grupoAnclaOk, horasNum, horasOk, personaId, previewCargando]);

  const previewVigente =
    entornoOk && preview && articuloSel &&
    String(preview.articulo_id) === String(articuloSel.articulo_id) &&
    String(preview.fecha_desde) === fechaDesde &&
    Number(preview.horas_solicitadas) === horasNum;

  const puedeEnviarTrasPreview = previewVigente && (preview.eligible === true || preview.ok === true);

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
    setHorasSolicitadas("");
  }, []);

  const enviar = useCallback(async () => {
    if (!articuloSel || enviando || !puedeEnviarTrasPreview || !entornoOk || !horasOk) return null;
    setEnviando(true);
    setError("");
    try {
      if (!grupoAnclaOk) throw new Error("Elegí el grupo de trabajo.");
      const { solicitud_id } = await crearSolicitudArticuloPatronCBorrador({
        personaId,
        articuloId: articuloSel.articulo_id,
        versionIdAplicada: articuloSel.version_id,
        fechaDesde,
        fechaHasta,
        horasSolicitadas: horasNum,
        grupoTrabajoIdAncla: grupoAnclaId,
      });
      const motor = await esperarValidacionMotorPatronC(solicitud_id);
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
  }, [articuloSel, enviando, entornoOk, fechaDesde, fechaHasta, grupoAnclaId, grupoAnclaOk, horasNum, horasOk, personaId, puedeEnviarTrasPreview, resetTrasEnvio]);

  const setFechaHasta = useCallback((v) => {
    setFechaHastaRaw(String(v || "").slice(0, 10));
    reiniciarValidacionYPreview();
  }, [reiniciarValidacionYPreview]);

  return {
    fechaDesde,
    fechaHasta,
    horasSolicitadas,
    setHorasSolicitadas,
    setFechaDesde,
    setFechaHasta,
    articuloNombre,
    articuloSel,
    cargando,
    error,
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
    validarEntornoPaso2,
    validandoEntorno,
    entornoOk,
    entornoMensajes,
    reiniciarValidacionYPreview,
  };
}
