import { useCallback, useEffect, useMemo, useState } from "react";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
import { listarColeccionPersonal } from "../../services/datosPersonalesService.js";
import { toOpts } from "../../pages/datos-personales/utils.js";
import {
  familiaresOpcionesDesdeDdjj,
  seleccionarDdjjReferenciaParaAviso,
} from "./avisoMedicoDdjj.js";
import { contactoPerfilDesdePersona } from "./formatDomicilioPersona.js";
import { useLaoWizardGrupoAncla } from "../lao/useLaoWizardGrupoAncla.js";
import { subirCertificadoAvisoMedico } from "../../services/avisosMedicoStorage.js";
import {
  callActualizarAvisoMedicoIncompleto,
  callBuscarAvisoIncompletaVigente,
  callValidarPeriodoAvisoMedicoExclusivo,
} from "../../services/callables.js";
import { leerPlazoHorasLicenciaIncompleta } from "../../services/cfgParametrosSistemaService.js";
import { crearAvisoMedicoCajaNegra } from "../../services/solicitudesArticuloV2Service.js";
import { ymdHoyBa } from "./ticketeraUtils.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

function clampFechaNoRetroactiva(ymd) {
  const hoy = ymdHoyBa();
  const v = String(ymd || "").slice(0, 10);
  if (!RX_YMD.test(v)) return hoy;
  return v < hoy ? hoy : v;
}

/**
 * @param {{
 *   usarPerfil: boolean,
 *   perfilContacto: { telefono_celular: string, telefono_fijo: string, domicilio_declarado: string, email: string },
 *   telCelular: string,
 *   telFijo: string,
 *   domicilio: string,
 *   usarEmailPerfil: boolean,
 *   email: string,
 *   permaneceEnDomicilio: boolean,
 * }} p
 */
function armarDeclaracionContacto(p) {
  const usar = p.usarPerfil === true;
  const cel = usar ? p.perfilContacto.telefono_celular : String(p.telCelular || "").trim();
  const fijoRaw = usar ? p.perfilContacto.telefono_fijo : String(p.telFijo || "").trim();
  const dom = usar ? p.perfilContacto.domicilio_declarado : String(p.domicilio || "").trim();
  const usarEmail = p.usarEmailPerfil === true;
  const mail = usarEmail ? p.perfilContacto.email : String(p.email || "").trim();
  return {
    usar_datos_perfil: usar,
    telefono_celular: cel,
    ...(fijoRaw ? { telefono_fijo: fijoRaw } : {}),
    domicilio_declarado: dom,
    permanece_en_domicilio: p.permaneceEnDomicilio === true,
    usar_email_perfil: usarEmail,
    email: mail,
  };
}

/**
 * Alta / completar aviso médico Caja Negra — sin motor ni previsualización.
 * @param {{ personaId: string, authUid: string }} params
 */
export function useAvisoMedicoAlta({ personaId, authUid }) {
  const fechaMinimaYmd = ymdHoyBa();
  const [tipoIngresoId, setTipoIngresoIdRaw] = useState(TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA);
  const [fechaInicioReposo, setFechaInicioReposoRaw] = useState(fechaMinimaYmd);
  const [fechaFinReposo, setFechaFinReposoRaw] = useState(fechaMinimaYmd);
  const [comentarioAgente, setComentarioAgente] = useState("");
  const [esLicenciaIncompleta, setEsLicenciaIncompleta] = useState(false);
  const [plazoHorasCertificado, setPlazoHorasCertificado] = useState(/** @type {number | null} */ (null));
  const [avisoIncompletoVigente, setAvisoIncompletoVigente] = useState(
    /** @type {{
     *   solicitud_id: string,
     *   resumen?: {
     *     fecha_inicio_reposo_estimada?: string,
     *     vencimiento_plazo_certificado_iso?: string | null,
     *     tipo_ingreso_id?: string,
     *     familiar_atendido?: Record<string, string> | null,
     *     declaracion_contacto?: Record<string, unknown> | null,
     *   },
     * } | null} */ (null),
  );
  const [completarModalAbierto, setCompletarModalAbierto] = useState(false);
  const [archivoCompletar, setArchivoCompletar] = useState(/** @type {File | null} */ (null));
  const [adjuntoCompletarSubido, setAdjuntoCompletarSubido] = useState(
    /** @type {{ storage_path: string, content_type?: string, nombre_archivo?: string } | null} */ (null),
  );
  const [errorCompletar, setErrorCompletar] = useState("");
  const [enviandoCompletar, setEnviandoCompletar] = useState(false);
  const [buscandoAvisoPendiente, setBuscandoAvisoPendiente] = useState(false);
  const [archivo, setArchivo] = useState(/** @type {File | null} */ (null));
  const [adjuntoSubido, setAdjuntoSubido] = useState(
    /** @type {{ storage_path: string, content_type?: string, nombre_archivo?: string } | null} */ (null),
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(/** @type {{ solicitud_id: string, provisorio?: boolean } | null} */ (null));

  const [perfilCargando, setPerfilCargando] = useState(false);
  const [perfilContacto, setPerfilContacto] = useState({
    telefono_celular: "",
    telefono_fijo: "",
    domicilio_declarado: "",
    email: "",
  });
  const [contactoUsaPerfil, setContactoUsaPerfil] = useState(true);
  const [emailUsaPerfil, setEmailUsaPerfil] = useState(true);
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoTelCelular, setContactoTelCelular] = useState("");
  const [contactoTelFijo, setContactoTelFijo] = useState("");
  const [contactoDomicilio, setContactoDomicilio] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [enfermedad, setEnfermedad] = useState("");
  const [codigoCie, setCodigoCie] = useState("");
  const [detalleClinico, setDetalleClinico] = useState("");
  const [permaneceEnDomicilio, setPermaneceEnDomicilio] = useState(/** @type {boolean | null} */ (null));

  const [ddjjCargando, setDdjjCargando] = useState(false);
  const [ddjjDisponible, setDdjjDisponible] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [familiaresOpciones, setFamiliaresOpciones] = useState(
    /** @type {Array<{ value: string, label: string, payload: Record<string, unknown> }>} */ ([]),
  );
  const [familiarAtendidoId, setFamiliarAtendidoId] = useState("");

  const bloqueadoPorIncompleta = Boolean(avisoIncompletoVigente?.solicitud_id);
  const fechaRef = clampFechaNoRetroactiva(fechaInicioReposo);

  const fechaRefCompletar = useMemo(() => {
    const v = String(fechaInicioReposo || "").slice(0, 10);
    if (RX_YMD.test(v)) return v;
    const r = String(avisoIncompletoVigente?.resumen?.fecha_inicio_reposo_estimada || "").slice(0, 10);
    return RX_YMD.test(r) ? r : fechaMinimaYmd;
  }, [avisoIncompletoVigente, fechaInicioReposo, fechaMinimaYmd]);

  const setFechaFinReposo = useCallback((val) => {
    const v = clampFechaNoRetroactiva(val);
    setFechaFinReposoRaw(v < fechaRef ? fechaRef : v);
  }, [fechaRef]);

  const setFechaInicioReposo = useCallback((val) => {
    const v = clampFechaNoRetroactiva(val);
    setFechaInicioReposoRaw(v);
    setFechaFinReposoRaw((prev) => (prev < v ? v : prev));
  }, []);

  const setFechaInicioReposoCompletar = useCallback((val) => {
    const v = String(val || "").slice(0, 10);
    if (!RX_YMD.test(v)) return;
    setFechaInicioReposoRaw(v);
    setFechaFinReposoRaw((prev) => (prev < v ? v : prev));
  }, []);

  const setFechaFinReposoCompletar = useCallback(
    (val) => {
      const v = String(val || "").slice(0, 10);
      if (!RX_YMD.test(v)) return;
      const min = String(fechaInicioReposo || "").slice(0, 10);
      const floor = RX_YMD.test(min) ? min : fechaRefCompletar;
      setFechaFinReposoRaw(v < floor ? floor : v);
    },
    [fechaInicioReposo, fechaRefCompletar],
  );

  const setTipoIngresoId = useCallback((id) => {
    setTipoIngresoIdRaw(id);
    if (id !== TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR) {
      setFamiliarAtendidoId("");
    }
    setError("");
  }, []);

  const {
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    requiereSeleccionGrupo,
    grupoAnclaOk,
    isLoading: gruposCargando,
    error: gruposError,
  } = useLaoWizardGrupoAncla({
    personaId,
    fechaRefYmd: fechaRef,
    enabled: /^per_/i.test(personaId) && !bloqueadoPorIncompleta,
  });

  useEffect(() => {
    if (!/^per_/i.test(personaId)) return;
    let cancelled = false;
    (async () => {
      try {
        const horas = await leerPlazoHorasLicenciaIncompleta({ fallbackDevOnly: 24 });
        if (!cancelled) setPlazoHorasCertificado(horas);
      } catch {
        if (!cancelled) setPlazoHorasCertificado(24);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    if (!/^per_/i.test(personaId)) {
      setAvisoIncompletoVigente(null);
      return;
    }
    let cancelled = false;
    setBuscandoAvisoPendiente(true);
    (async () => {
      try {
        const res = await callBuscarAvisoIncompletaVigente();
        const data = res?.data;
        if (cancelled) return;
        if (data?.ok && data.solicitud_id) {
          setAvisoIncompletoVigente({
            solicitud_id: String(data.solicitud_id),
            resumen: data.resumen && typeof data.resumen === "object" ? data.resumen : undefined,
          });
        } else {
          setAvisoIncompletoVigente(null);
        }
      } catch {
        if (!cancelled) setAvisoIncompletoVigente(null);
      } finally {
        if (!cancelled) setBuscandoAvisoPendiente(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    if (!/^per_/i.test(personaId)) {
      setPerfilContacto({ telefono_celular: "", telefono_fijo: "", domicilio_declarado: "" });
      setDdjjDisponible(null);
      setFamiliaresOpciones([]);
      return;
    }
    let cancelled = false;
    setPerfilCargando(true);
    setDdjjCargando(true);
    (async () => {
      try {
        const [personas, ddjjRows, parentescoRows] = await Promise.all([
          listarColeccionPersonal("personas"),
          listarColeccionPersonal("declaraciones_grupo_familiar"),
          listarColeccionPersonal("cfg_parentesco"),
        ]);
        if (cancelled) return;
        const row = (personas || []).find((r) => String(r.id || "") === personaId);
        const contacto = contactoPerfilDesdePersona(row);
        setPerfilContacto(contacto);
        if (contactoUsaPerfil) {
          setContactoTelCelular(contacto.telefono_celular);
          setContactoTelFijo(contacto.telefono_fijo);
          setContactoDomicilio(contacto.domicilio_declarado);
          setContactoEmail(contacto.email);
        }
        const ddjj = seleccionarDdjjReferenciaParaAviso(ddjjRows || [], personaId);
        setDdjjDisponible(ddjj);
        const opts = familiaresOpcionesDesdeDdjj(ddjj, toOpts(parentescoRows || []));
        setFamiliaresOpciones(opts);
        if (!opts.some((o) => o.value === familiarAtendidoId)) {
          setFamiliarAtendidoId("");
        }
      } catch {
        if (!cancelled) {
          setDdjjDisponible(null);
          setFamiliaresOpciones([]);
        }
      } finally {
        if (!cancelled) {
          setPerfilCargando(false);
          setDdjjCargando(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga al cambiar persona; contactoUsaPerfil se sincroniza aparte
  }, [personaId]);

  const onToggleEmailUsaPerfil = useCallback(
    (usaPerfil) => {
      setEmailUsaPerfil(usaPerfil);
      if (usaPerfil) setContactoEmail(perfilContacto.email);
      setError("");
    },
    [perfilContacto.email],
  );

  const onToggleContactoUsaPerfil = useCallback(
    (usaPerfil) => {
      setContactoUsaPerfil(usaPerfil);
      if (usaPerfil) {
        setContactoTelCelular(perfilContacto.telefono_celular);
        setContactoTelFijo(perfilContacto.telefono_fijo);
        setContactoDomicilio(perfilContacto.domicilio_declarado);
      }
      setError("");
    },
    [perfilContacto],
  );

  const fechaFinRef = clampFechaNoRetroactiva(
    RX_YMD.test(fechaFinReposo) && fechaFinReposo >= fechaRef ? fechaFinReposo : fechaRef,
  );

  const declaracionClinicaPayload = useMemo(() => {
    const payload = {
      ...(sintomas.trim() ? { sintomas: sintomas.trim() } : {}),
      ...(enfermedad.trim() ? { enfermedad: enfermedad.trim() } : {}),
      ...(codigoCie.trim() ? { codigo_cie: codigoCie.trim() } : {}),
      ...(detalleClinico.trim() ? { detalle: detalleClinico.trim() } : {}),
    };
    return Object.keys(payload).length ? payload : null;
  }, [codigoCie, detalleClinico, enfermedad, sintomas]);

  const clinicaOk =
    esLicenciaIncompleta && !bloqueadoPorIncompleta
      ? true
      : Boolean(
          declaracionClinicaPayload &&
            (declaracionClinicaPayload.sintomas ||
              declaracionClinicaPayload.enfermedad ||
              declaracionClinicaPayload.codigo_cie),
        );

  const fechaFinOk =
    esLicenciaIncompleta && !bloqueadoPorIncompleta
      ? true
      : RX_YMD.test(fechaFinRef) && fechaFinRef >= fechaRef;

  const familiarPayload = useMemo(() => {
    const hit = familiaresOpciones.find((o) => o.value === familiarAtendidoId);
    return hit?.payload || null;
  }, [familiaresOpciones, familiarAtendidoId]);

  const declaracionContactoLista = useMemo(() => {
    const dc = armarDeclaracionContacto({
      usarPerfil: contactoUsaPerfil,
      perfilContacto,
      telCelular: contactoTelCelular,
      telFijo: contactoTelFijo,
      domicilio: contactoDomicilio,
      usarEmailPerfil: emailUsaPerfil,
      email: contactoEmail,
      permaneceEnDomicilio: permaneceEnDomicilio === true,
    });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dc.email);
    return (
      dc.telefono_celular.length >= 6 &&
      dc.domicilio_declarado.length >= 3 &&
      permaneceEnDomicilio !== null &&
      emailOk
    );
  }, [
    contactoDomicilio,
    contactoEmail,
    contactoTelCelular,
    contactoTelFijo,
    contactoUsaPerfil,
    emailUsaPerfil,
    perfilContacto,
    permaneceEnDomicilio,
  ]);

  const fechaReposoValida = RX_YMD.test(fechaRef) && fechaRef >= fechaMinimaYmd;

  const familiarOk =
    tipoIngresoId !== TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR ||
    (Boolean(ddjjDisponible) && Boolean(familiarPayload));

  const tieneAdjunto = Boolean(adjuntoSubido?.storage_path) || Boolean(archivo);

  const fechaFinRefCompletar = useMemo(() => {
    const raw = RX_YMD.test(fechaFinReposo) && fechaFinReposo >= fechaRefCompletar ? fechaFinReposo : fechaRefCompletar;
    return raw;
  }, [fechaFinReposo, fechaRefCompletar]);

  const clinicaOkCompletar = Boolean(
    declaracionClinicaPayload &&
      (declaracionClinicaPayload.sintomas ||
        declaracionClinicaPayload.enfermedad ||
        declaracionClinicaPayload.codigo_cie),
  );

  const fechaFinOkCompletar =
    RX_YMD.test(fechaFinRefCompletar) && fechaFinRefCompletar >= fechaRefCompletar;

  const fechaReposoValidaCompletar = RX_YMD.test(fechaRefCompletar);

  const tieneAdjuntoCompletar =
    Boolean(adjuntoCompletarSubido?.storage_path) || Boolean(archivoCompletar);

  const puedeCompletar = useMemo(() => {
    if (!bloqueadoPorIncompleta || !completarModalAbierto) return false;
    if (!/^per_/i.test(personaId)) return false;
    return (
      tieneAdjuntoCompletar &&
      fechaReposoValidaCompletar &&
      fechaFinOkCompletar &&
      clinicaOkCompletar &&
      declaracionContactoLista
    );
  }, [
    bloqueadoPorIncompleta,
    clinicaOkCompletar,
    completarModalAbierto,
    declaracionContactoLista,
    fechaFinOkCompletar,
    fechaReposoValidaCompletar,
    personaId,
    tieneAdjuntoCompletar,
  ]);

  const puedeEnviar = useMemo(() => {
    if (!/^per_/i.test(personaId)) return false;
    if (bloqueadoPorIncompleta) return false;
    if (!grupoAnclaOk) return false;
    if (!fechaReposoValida || !fechaFinOk) return false;
    if (!declaracionContactoLista) return false;
    if (!familiarOk) return false;
    if (!clinicaOk && !esLicenciaIncompleta) return false;
    if (esLicenciaIncompleta) {
      // aviso provisorio sin certificado
    } else if (!tieneAdjunto) {
      return false;
    }
    if (
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA &&
      tipoIngresoId !== TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR
    ) {
      return false;
    }
    return true;
  }, [
    bloqueadoPorIncompleta,
    clinicaOk,
    declaracionContactoLista,
    emailUsaPerfil,
    esLicenciaIncompleta,
    familiarOk,
    fechaFinOk,
    fechaReposoValida,
    grupoAnclaOk,
    personaId,
    tieneAdjunto,
    tipoIngresoId,
  ]);

  const onSeleccionarArchivo = useCallback((file) => {
    setArchivo(file || null);
    setAdjuntoSubido(null);
    setError("");
  }, []);

  const onToggleLicenciaIncompleta = useCallback((checked) => {
    setEsLicenciaIncompleta(checked);
    if (checked) {
      setArchivo(null);
      setAdjuntoSubido(null);
    }
    setError("");
  }, []);

  const buildPayloadAlta = useCallback(() => {
    const declaracionContacto = armarDeclaracionContacto({
      usarPerfil: contactoUsaPerfil,
      perfilContacto,
      telCelular: contactoTelCelular,
      telFijo: contactoTelFijo,
      domicilio: contactoDomicilio,
      usarEmailPerfil: emailUsaPerfil,
      email: contactoEmail,
      permaneceEnDomicilio: permaneceEnDomicilio === true,
    });
    const fin = esLicenciaIncompleta ? fechaRef : fechaFinRef;
    return {
      fechaInicioReposoEstimada: fechaRef,
      fechaFinReposoEstimada: fin,
      fechaReferenciaHoyBa: fechaMinimaYmd,
      declaracionContacto,
      declaracionClinica: declaracionClinicaPayload || undefined,
      familiarAtendido:
        tipoIngresoId === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR && familiarPayload
          ? familiarPayload
          : undefined,
    };
  }, [
    contactoDomicilio,
    contactoEmail,
    contactoTelCelular,
    contactoTelFijo,
    contactoUsaPerfil,
    declaracionClinicaPayload,
    emailUsaPerfil,
    esLicenciaIncompleta,
    familiarPayload,
    fechaFinRef,
    fechaMinimaYmd,
    fechaRef,
    tipoIngresoId,
  ]);

  const hidratarFormularioCompletar = useCallback(() => {
    const resumen = avisoIncompletoVigente?.resumen;
    if (!resumen) return;
    const inicio = String(resumen.fecha_inicio_reposo_estimada || "").slice(0, 10);
    if (RX_YMD.test(inicio)) {
      setFechaInicioReposoRaw(inicio);
      setFechaFinReposoRaw(inicio);
    }
    const dc = resumen.declaracion_contacto;
    if (dc && typeof dc === "object") {
      setContactoUsaPerfil(dc.usar_datos_perfil === true);
      setEmailUsaPerfil(dc.usar_email_perfil === true);
      if (dc.usar_datos_perfil !== true) {
        setContactoTelCelular(String(dc.telefono_celular || ""));
        setContactoTelFijo(String(dc.telefono_fijo || ""));
        setContactoDomicilio(String(dc.domicilio_declarado || ""));
      }
      if (dc.usar_email_perfil !== true) {
        setContactoEmail(String(dc.email || ""));
      }
      setPermaneceEnDomicilio(dc.permanece_en_domicilio === true ? true : dc.permanece_en_domicilio === false ? false : null);
    }
    setArchivoCompletar(null);
    setAdjuntoCompletarSubido(null);
    setErrorCompletar("");
  }, [avisoIncompletoVigente]);

  const abrirCompletarModal = useCallback(() => {
    hidratarFormularioCompletar();
    setCompletarModalAbierto(true);
  }, [hidratarFormularioCompletar]);

  const cerrarCompletarModal = useCallback(() => {
    if (enviandoCompletar) return;
    setCompletarModalAbierto(false);
    setErrorCompletar("");
    setArchivoCompletar(null);
    setAdjuntoCompletarSubido(null);
  }, [enviandoCompletar]);

  const onSeleccionarArchivoCompletar = useCallback((file) => {
    setArchivoCompletar(file || null);
    setAdjuntoCompletarSubido(null);
    setErrorCompletar("");
  }, []);

  const buildPayloadCompletar = useCallback(() => {
    const declaracionContacto = armarDeclaracionContacto({
      usarPerfil: contactoUsaPerfil,
      perfilContacto,
      telCelular: contactoTelCelular,
      telFijo: contactoTelFijo,
      domicilio: contactoDomicilio,
      usarEmailPerfil: emailUsaPerfil,
      email: contactoEmail,
      permaneceEnDomicilio: permaneceEnDomicilio === true,
    });
    return {
      fechaInicioReposoEstimada: fechaRefCompletar,
      fechaFinReposoEstimada: fechaFinRefCompletar,
      declaracionClinica: declaracionClinicaPayload || undefined,
      declaracionContacto,
    };
  }, [
    contactoDomicilio,
    contactoEmail,
    contactoTelCelular,
    contactoTelFijo,
    contactoUsaPerfil,
    declaracionClinicaPayload,
    emailUsaPerfil,
    fechaFinRefCompletar,
    fechaRefCompletar,
    perfilContacto,
    permaneceEnDomicilio,
  ]);

  const validarPeriodoExclusivo = useCallback(
    async (desde, hasta, excludeSolicitudId = "") => {
      await callValidarPeriodoAvisoMedicoExclusivo({
        fecha_desde: desde,
        fecha_hasta: hasta || desde,
        exclude_solicitud_id: excludeSolicitudId || undefined,
      });
    },
    [],
  );

  const enviarAviso = useCallback(async () => {
    if (!puedeEnviar || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const altaExtra = buildPayloadAlta();
      const hastaPeriodo = altaExtra.fechaFinReposoEstimada || altaExtra.fechaInicioReposoEstimada;

      if (tipoIngresoId === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR && !familiarPayload) {
        throw new Error("Seleccioná el familiar de tu DDJJ.");
      }

      if (esLicenciaIncompleta) {
        await validarPeriodoExclusivo(altaExtra.fechaInicioReposoEstimada, hastaPeriodo);
        const res = await crearAvisoMedicoCajaNegra({
          personaId,
          tipoIngresoId,
          grupoTrabajoIdAncla: grupoAnclaId,
          adjuntos: [],
          comentarioAgente: comentarioAgente.trim() || undefined,
          esLicenciaIncompleta: true,
          ...altaExtra,
        });
        setExito({ solicitud_id: res.solicitud_id, provisorio: true });
        return;
      }

      let adjunto = adjuntoSubido;
      if (!adjunto?.storage_path) {
        if (!archivo) {
          throw new Error("Adjuntá el certificado médico.");
        }
        adjunto = await subirCertificadoAvisoMedico(archivo, {
          authUid,
          year: Number(fechaRef.slice(0, 4)),
        });
        setAdjuntoSubido(adjunto);
      }

      await validarPeriodoExclusivo(altaExtra.fechaInicioReposoEstimada, hastaPeriodo);

      const res = await crearAvisoMedicoCajaNegra({
        personaId,
        tipoIngresoId,
        grupoTrabajoIdAncla: grupoAnclaId,
        adjuntos: [adjunto],
        comentarioAgente: comentarioAgente.trim() || undefined,
        esLicenciaIncompleta: false,
        ...altaExtra,
      });

      setExito({ solicitud_id: res.solicitud_id });
    } catch (e) {
      setError(e?.message || "No se pudo enviar el aviso. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }, [
    adjuntoSubido,
    archivo,
    authUid,
    buildPayloadAlta,
    comentarioAgente,
    enviando,
    esLicenciaIncompleta,
    familiarPayload,
    fechaRef,
    grupoAnclaId,
    personaId,
    puedeEnviar,
    validarPeriodoExclusivo,
    tipoIngresoId,
  ]);

  const enviarCompletar = useCallback(async () => {
    if (!puedeCompletar || enviandoCompletar || !avisoIncompletoVigente?.solicitud_id) return;
    setEnviandoCompletar(true);
    setErrorCompletar("");
    try {
      const payload = buildPayloadCompletar();
      const hastaPeriodo = payload.fechaFinReposoEstimada || payload.fechaInicioReposoEstimada;

      await validarPeriodoExclusivo(
        payload.fechaInicioReposoEstimada,
        hastaPeriodo,
        avisoIncompletoVigente.solicitud_id,
      );

      let adjunto = adjuntoCompletarSubido;
      if (!adjunto?.storage_path) {
        if (!archivoCompletar) {
          throw new Error("Adjuntá el certificado médico.");
        }
        adjunto = await subirCertificadoAvisoMedico(archivoCompletar, {
          authUid,
          year: Number(payload.fechaInicioReposoEstimada.slice(0, 4)),
        });
        setAdjuntoCompletarSubido(adjunto);
      }

      const res = await callActualizarAvisoMedicoIncompleto({
        solicitud_id: avisoIncompletoVigente.solicitud_id,
        adjuntos: [adjunto],
        fecha_inicio_reposo_estimada: payload.fechaInicioReposoEstimada,
        fecha_fin_reposo_estimada: hastaPeriodo,
        declaracion_clinica: payload.declaracionClinica,
      });
      const data = res?.data;
      if (!data?.ok) {
        throw new Error(data?.mensaje || "No se pudo completar el aviso.");
      }
      setCompletarModalAbierto(false);
      setExito({ solicitud_id: avisoIncompletoVigente.solicitud_id });
      setAvisoIncompletoVigente(null);
    } catch (e) {
      setErrorCompletar(e?.message || "No se pudo completar el aviso. Intentá de nuevo.");
    } finally {
      setEnviandoCompletar(false);
    }
  }, [
    adjuntoCompletarSubido,
    archivoCompletar,
    authUid,
    avisoIncompletoVigente,
    buildPayloadCompletar,
    enviandoCompletar,
    puedeCompletar,
    validarPeriodoExclusivo,
  ]);

  const reiniciar = useCallback(() => {
    setExito(null);
    setError("");
    setArchivo(null);
    setAdjuntoSubido(null);
    setComentarioAgente("");
    setEsLicenciaIncompleta(false);
    setPermaneceEnDomicilio(null);
  }, []);

  return {
    tipoIngresoId,
    setTipoIngresoId,
    fechaInicioReposo,
    setFechaInicioReposo,
    fechaFinReposo,
    setFechaFinReposo,
    setFechaInicioReposoCompletar,
    setFechaFinReposoCompletar,
    fechaMinimaYmd,
    comentarioAgente,
    setComentarioAgente,
    esLicenciaIncompleta,
    onToggleLicenciaIncompleta,
    plazoHorasCertificado,
    bloqueadoPorIncompleta,
    avisoIncompletoVigente,
    buscandoAvisoPendiente,
    completarModalAbierto,
    abrirCompletarModal,
    cerrarCompletarModal,
    archivoCompletar,
    onSeleccionarArchivoCompletar,
    puedeCompletar,
    enviandoCompletar,
    errorCompletar,
    enviarCompletar,
    archivo,
    onSeleccionarArchivo,
    gruposVigentes,
    grupoAnclaId,
    setGrupoAnclaId,
    requiereSeleccionGrupo,
    gruposCargando,
    gruposError,
    perfilCargando,
    perfilContacto,
    contactoUsaPerfil,
    onToggleContactoUsaPerfil,
    emailUsaPerfil,
    onToggleEmailUsaPerfil,
    contactoEmail,
    setContactoEmail,
    sintomas,
    setSintomas,
    enfermedad,
    setEnfermedad,
    codigoCie,
    setCodigoCie,
    detalleClinico,
    setDetalleClinico,
    contactoTelCelular,
    setContactoTelCelular,
    contactoTelFijo,
    setContactoTelFijo,
    contactoDomicilio,
    setContactoDomicilio,
    permaneceEnDomicilio,
    setPermaneceEnDomicilio,
    ddjjCargando,
    ddjjDisponible,
    familiaresOpciones,
    familiarAtendidoId,
    setFamiliarAtendidoId,
    puedeEnviar,
    enviando,
    error,
    exito,
    enviarAviso,
    reiniciar,
  };
}