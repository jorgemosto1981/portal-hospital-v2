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
 *   domicilioAlternativo: string,
 *   usarEmailPerfil: boolean,
 *   email: string,
 *   permaneceEnDomicilio: boolean,
 * }} p
 */
function armarDeclaracionContacto(p) {
  const usar = p.usarPerfil === true;
  const cel = usar ? p.perfilContacto.telefono_celular : String(p.telCelular || "").trim();
  const fijoRaw = usar ? p.perfilContacto.telefono_fijo : String(p.telFijo || "").trim();
  const dom = (() => {
    if (p.permaneceEnDomicilio === false) {
      const alt = String(p.domicilioAlternativo || "").trim();
      if (alt.length >= 3) return alt;
    }
    return usar ? p.perfilContacto.domicilio_declarado : String(p.domicilio || "").trim();
  })();
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
  const [modoAlta, setModoAltaRaw] = useState(/** @type {null | "con_certificado" | "sin_certificado"} */ (null));
  const [esLicenciaIncompleta, setEsLicenciaIncompleta] = useState(false);
  const [aceptoPlazoProvisorio, setAceptoPlazoProvisorio] = useState(false);
  const [plazoHorasCertificado, setPlazoHorasCertificado] = useState(/** @type {number | null} */ (null));
  const [avisosProvisoriosVigentes, setAvisosProvisoriosVigentes] = useState(
    /** @type {Array<{ solicitud_id: string, resumen?: Record<string, unknown> }>} */ ([]),
  );
  const [permiteNuevoProvisorio, setPermiteNuevoProvisorio] = useState(true);
  const [maxProvisoriosVigentes, setMaxProvisoriosVigentes] = useState(2);
  const [avisoCompletarActivo, setAvisoCompletarActivo] = useState(
    /** @type {{ solicitud_id: string, resumen?: Record<string, unknown> } | null} */ (null),
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
  const [exito, setExito] = useState(
    /** @type {{ solicitud_id: string, provisorio?: boolean, fechaInicioLicenciaYmd?: string } | null} */ (null),
  );

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
  const [domicilioReposoAlternativo, setDomicilioReposoAlternativo] = useState("");
  const [detalleClinicoPrincipal, setDetalleClinicoPrincipal] = useState("");
  const [detalleClinico, setDetalleClinico] = useState("");
  const [permaneceEnDomicilio, setPermaneceEnDomicilio] = useState(/** @type {boolean} */ (true));

  const [ddjjCargando, setDdjjCargando] = useState(false);
  const [ddjjDisponible, setDdjjDisponible] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [familiaresOpciones, setFamiliaresOpciones] = useState(
    /** @type {Array<{ value: string, label: string, payload: Record<string, unknown> }>} */ ([]),
  );
  const [familiarAtendidoId, setFamiliarAtendidoId] = useState("");

  const tieneProvisoriosPendientes = avisosProvisoriosVigentes.length > 0;
  const fechaRef = clampFechaNoRetroactiva(fechaInicioReposo);

  const fechaRefCompletar = useMemo(() => {
    const r = String(avisoCompletarActivo?.resumen?.fecha_inicio_reposo_estimada || "").slice(0, 10);
    return RX_YMD.test(r) ? r : fechaMinimaYmd;
  }, [avisoCompletarActivo, fechaMinimaYmd]);

  const setFechaFinReposo = useCallback((val) => {
    const v = clampFechaNoRetroactiva(val);
    setFechaFinReposoRaw(v < fechaRef ? fechaRef : v);
  }, [fechaRef]);

  const setFechaInicioReposo = useCallback((val) => {
    const v = clampFechaNoRetroactiva(val);
    setFechaInicioReposoRaw(v);
    setFechaFinReposoRaw((prev) => (prev < v ? v : prev));
  }, []);

  const setFechaFinReposoCompletar = useCallback(
    (val) => {
      const v = String(val || "").slice(0, 10);
      if (!RX_YMD.test(v)) return;
      setFechaFinReposoRaw(v < fechaRefCompletar ? fechaRefCompletar : v);
    },
    [fechaRefCompletar],
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
    enabled: /^per_/i.test(personaId),
    anclaAutomaticaSiMultiples: true,
  });

  const cargarAvisosProvisorios = useCallback(async () => {
    if (!/^per_/i.test(personaId)) {
      setAvisosProvisoriosVigentes([]);
      setPermiteNuevoProvisorio(true);
      return;
    }
    setBuscandoAvisoPendiente(true);
    try {
      const res = await callBuscarAvisoIncompletaVigente();
      const data = res?.data;
      /** @type {Array<{ solicitud_id: string, resumen?: Record<string, unknown> }>} */
      let lista = [];
      if (Array.isArray(data?.avisos)) {
        lista = data.avisos
          .map((row) => ({
            solicitud_id: String(row?.solicitud_id || ""),
            resumen: row?.resumen && typeof row.resumen === "object" ? row.resumen : undefined,
          }))
          .filter((row) => /^sol_/i.test(row.solicitud_id));
      } else if (data?.ok && data.solicitud_id) {
        lista = [
          {
            solicitud_id: String(data.solicitud_id),
            resumen: data.resumen && typeof data.resumen === "object" ? data.resumen : undefined,
          },
        ];
      }
      setAvisosProvisoriosVigentes(lista);
      setPermiteNuevoProvisorio(data?.permite_nuevo_provisorio !== false);
      if (Number.isFinite(Number(data?.max_provisorios_vigentes))) {
        setMaxProvisoriosVigentes(Math.floor(Number(data.max_provisorios_vigentes)));
      }
    } catch {
      setAvisosProvisoriosVigentes([]);
      setPermiteNuevoProvisorio(true);
    } finally {
      setBuscandoAvisoPendiente(false);
    }
  }, [personaId]);

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
      setAvisosProvisoriosVigentes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      await cargarAvisosProvisorios();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId, cargarAvisosProvisorios]);

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
      setEmailUsaPerfil(usaPerfil);
      if (usaPerfil) {
        setContactoTelCelular(perfilContacto.telefono_celular);
        setContactoTelFijo(perfilContacto.telefono_fijo);
        setContactoDomicilio(perfilContacto.domicilio_declarado);
        setContactoEmail(perfilContacto.email);
      }
      setError("");
    },
    [perfilContacto],
  );

  const setModoAlta = useCallback((modo) => {
    setModoAltaRaw(modo);
    const inc = modo === "sin_certificado";
    setEsLicenciaIncompleta(inc);
    if (inc) {
      setArchivo(null);
      setAdjuntoSubido(null);
      setAceptoPlazoProvisorio(false);
    } else {
      setAceptoPlazoProvisorio(false);
    }
    setError("");
  }, []);

  const fechaFinRef = clampFechaNoRetroactiva(
    RX_YMD.test(fechaFinReposo) && fechaFinReposo >= fechaRef ? fechaFinReposo : fechaRef,
  );

  const declaracionClinicaPayload = useMemo(() => {
    const principal = String(detalleClinicoPrincipal || "").trim();
    const payload = {
      ...(principal ? { sintomas: principal } : {}),
      ...(detalleClinico.trim() ? { detalle: detalleClinico.trim() } : {}),
    };
    return Object.keys(payload).length ? payload : null;
  }, [detalleClinico, detalleClinicoPrincipal]);

  const clinicaOk = Boolean(declaracionClinicaPayload?.sintomas);

  const fechaFinOk = esLicenciaIncompleta
      ? true
      : RX_YMD.test(fechaFinRef) && fechaFinRef >= fechaRef;

  const familiarPayload = useMemo(() => {
    const hit = familiaresOpciones.find((o) => o.value === familiarAtendidoId);
    return hit?.payload || null;
  }, [familiaresOpciones, familiarAtendidoId]);

  const declaracionContactoLista = useMemo(() => {
    const omitirPermanenciaReposo = esLicenciaIncompleta && !completarModalAbierto;
    const dc = armarDeclaracionContacto({
      usarPerfil: contactoUsaPerfil,
      perfilContacto,
      telCelular: contactoTelCelular,
      telFijo: contactoTelFijo,
      domicilio: contactoDomicilio,
      domicilioAlternativo: domicilioReposoAlternativo,
      usarEmailPerfil: emailUsaPerfil,
      email: contactoEmail,
      permaneceEnDomicilio: omitirPermanenciaReposo ? true : permaneceEnDomicilio === true,
    });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dc.email);
    const domOk = omitirPermanenciaReposo
      ? dc.domicilio_declarado.length >= 3
      : permaneceEnDomicilio === false
        ? String(domicilioReposoAlternativo || "").trim().length >= 3
        : dc.domicilio_declarado.length >= 3;
    return dc.telefono_celular.length >= 6 && domOk && emailOk;
  }, [
    completarModalAbierto,
    contactoDomicilio,
    contactoEmail,
    contactoTelCelular,
    contactoTelFijo,
    contactoUsaPerfil,
    domicilioReposoAlternativo,
    emailUsaPerfil,
    esLicenciaIncompleta,
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

  const clinicaOkCompletar = Boolean(declaracionClinicaPayload?.sintomas);

  const fechaFinOkCompletar =
    RX_YMD.test(fechaFinRefCompletar) && fechaFinRefCompletar >= fechaRefCompletar;

  const fechaReposoValidaCompletar = RX_YMD.test(fechaRefCompletar);

  const tieneAdjuntoCompletar =
    Boolean(adjuntoCompletarSubido?.storage_path) || Boolean(archivoCompletar);

  const puedeCompletar = useMemo(() => {
    if (!avisoCompletarActivo?.solicitud_id || !completarModalAbierto) return false;
    if (!/^per_/i.test(personaId)) return false;
    return (
      tieneAdjuntoCompletar &&
      fechaReposoValidaCompletar &&
      fechaFinOkCompletar &&
      clinicaOkCompletar &&
      declaracionContactoLista
    );
  }, [
    avisoCompletarActivo,
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
    if (modoAlta == null) return false;
    if (!grupoAnclaOk) return false;
    if (!fechaReposoValida || !fechaFinOk) return false;
    if (!declaracionContactoLista) return false;
    if (!familiarOk) return false;
    if (!clinicaOk) return false;
    if (esLicenciaIncompleta) {
      if (!permiteNuevoProvisorio) return false;
      if (!aceptoPlazoProvisorio) return false;
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
    aceptoPlazoProvisorio,
    clinicaOk,
    declaracionContactoLista,
    esLicenciaIncompleta,
    familiarOk,
    fechaFinOk,
    fechaReposoValida,
    grupoAnclaOk,
    modoAlta,
    permiteNuevoProvisorio,
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
    setModoAlta(checked ? "sin_certificado" : "con_certificado");
  }, [setModoAlta]);

  const buildPayloadAlta = useCallback(() => {
    const declaracionContacto = armarDeclaracionContacto({
      usarPerfil: contactoUsaPerfil,
      perfilContacto,
      telCelular: contactoTelCelular,
      telFijo: contactoTelFijo,
      domicilio: contactoDomicilio,
      domicilioAlternativo: domicilioReposoAlternativo,
      usarEmailPerfil: emailUsaPerfil,
      email: contactoEmail,
      permaneceEnDomicilio: esLicenciaIncompleta ? true : permaneceEnDomicilio === true,
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
    domicilioReposoAlternativo,
    emailUsaPerfil,
    esLicenciaIncompleta,
    familiarPayload,
    fechaFinRef,
    fechaMinimaYmd,
    fechaRef,
    permaneceEnDomicilio,
    tipoIngresoId,
  ]);

  const hidratarFormularioCompletar = useCallback(() => {
    const resumen = avisoCompletarActivo?.resumen;
    if (!resumen) return;
    const inicio = String(resumen.fecha_inicio_reposo_estimada || "").slice(0, 10);
    if (RX_YMD.test(inicio)) {
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
      setPermaneceEnDomicilio(dc.permanece_en_domicilio === false ? false : true);
    }
    setArchivoCompletar(null);
    setAdjuntoCompletarSubido(null);
    setErrorCompletar("");
  }, [avisoCompletarActivo]);

  const abrirCompletarModal = useCallback(
    (aviso) => {
      if (!aviso?.solicitud_id) return;
      setAvisoCompletarActivo(aviso);
      setCompletarModalAbierto(true);
    },
    [],
  );

  useEffect(() => {
    if (!completarModalAbierto || !avisoCompletarActivo?.solicitud_id) return;
    hidratarFormularioCompletar();
  }, [avisoCompletarActivo, completarModalAbierto, hidratarFormularioCompletar]);

  const cerrarCompletarModal = useCallback(() => {
    if (enviandoCompletar) return;
    setCompletarModalAbierto(false);
    setAvisoCompletarActivo(null);
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
      domicilioAlternativo: domicilioReposoAlternativo,
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
    domicilioReposoAlternativo,
    emailUsaPerfil,
    fechaFinRefCompletar,
    fechaRefCompletar,
    perfilContacto,
    permaneceEnDomicilio,
  ]);

  const validarPeriodoExclusivo = useCallback(
    async (desde, hasta, excludeSolicitudId = "", opts = {}) => {
      await callValidarPeriodoAvisoMedicoExclusivo({
        fecha_desde: desde,
        fecha_hasta: hasta || desde,
        exclude_solicitud_id: excludeSolicitudId || undefined,
        es_alta_licencia_incompleta: opts.esAltaLicenciaIncompleta === true,
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
        await validarPeriodoExclusivo(altaExtra.fechaInicioReposoEstimada, hastaPeriodo, "", {
          esAltaLicenciaIncompleta: true,
        });
        const res = await crearAvisoMedicoCajaNegra({
          personaId,
          tipoIngresoId,
          grupoTrabajoIdAncla: grupoAnclaId,
          adjuntos: [],
          comentarioAgente: comentarioAgente.trim() || undefined,
          esLicenciaIncompleta: true,
          ...altaExtra,
        });
        setExito({
          solicitud_id: res.solicitud_id,
          provisorio: true,
          fechaInicioLicenciaYmd: altaExtra.fechaInicioReposoEstimada,
        });
        await cargarAvisosProvisorios();
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
    if (!puedeCompletar || enviandoCompletar || !avisoCompletarActivo?.solicitud_id) return;
    setEnviandoCompletar(true);
    setErrorCompletar("");
    try {
      const payload = buildPayloadCompletar();
      const hastaPeriodo = payload.fechaFinReposoEstimada || payload.fechaInicioReposoEstimada;

      await validarPeriodoExclusivo(
        payload.fechaInicioReposoEstimada,
        hastaPeriodo,
        avisoCompletarActivo.solicitud_id,
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

      const solId = avisoCompletarActivo.solicitud_id;
      const res = await callActualizarAvisoMedicoIncompleto({
        solicitud_id: solId,
        adjuntos: [adjunto],
        fecha_fin_reposo_estimada: hastaPeriodo,
        declaracion_clinica: payload.declaracionClinica,
        declaracion_contacto: payload.declaracionContacto,
      });
      const data = res?.data;
      if (!data?.ok) {
        throw new Error(data?.mensaje || "No se pudo completar el aviso.");
      }
      setCompletarModalAbierto(false);
      setAvisoCompletarActivo(null);
      setExito({ solicitud_id: solId });
      await cargarAvisosProvisorios();
    } catch (e) {
      setErrorCompletar(e?.message || "No se pudo completar el aviso. Intentá de nuevo.");
    } finally {
      setEnviandoCompletar(false);
    }
  }, [
    adjuntoCompletarSubido,
    archivoCompletar,
    authUid,
    avisoCompletarActivo,
    buildPayloadCompletar,
    cargarAvisosProvisorios,
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
    setModoAltaRaw(null);
    setEsLicenciaIncompleta(false);
    setAceptoPlazoProvisorio(false);
    setPermaneceEnDomicilio(true);
    setDomicilioReposoAlternativo("");
    setDetalleClinicoPrincipal("");
    setDetalleClinico("");
  }, []);

  return {
    tipoIngresoId,
    setTipoIngresoId,
    fechaInicioReposo,
    setFechaInicioReposo,
    fechaFinReposo,
    setFechaFinReposo,
    setFechaFinReposoCompletar,
    fechaMinimaYmd,
    comentarioAgente,
    setComentarioAgente,
    modoAlta,
    setModoAlta,
    esLicenciaIncompleta,
    onToggleLicenciaIncompleta,
    aceptoPlazoProvisorio,
    setAceptoPlazoProvisorio,
    plazoHorasCertificado,
    avisosProvisoriosVigentes,
    permiteNuevoProvisorio,
    maxProvisoriosVigentes,
    tieneProvisoriosPendientes,
    avisoCompletarActivo,
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
    detalleClinicoPrincipal,
    setDetalleClinicoPrincipal,
    detalleClinico,
    setDetalleClinico,
    contactoTelCelular,
    setContactoTelCelular,
    contactoTelFijo,
    setContactoTelFijo,
    contactoDomicilio,
    setContactoDomicilio,
    domicilioReposoAlternativo,
    setDomicilioReposoAlternativo,
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