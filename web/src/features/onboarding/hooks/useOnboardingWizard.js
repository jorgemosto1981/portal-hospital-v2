import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  callListarCatalogoOnboarding,
  callOnboardingMvpCompletar,
  callOnboardingMvpDdjjFamiliar,
  callOnboardingMvpOmitirDdjjFamiliar,
  callOnboardingMvpPasoA,
} from "../../../services/callables.js";
import { normalizeDni } from "../../../services/authService.js";
import { ESTADO_ACTIVO_MVP, subscribePersonaById } from "../../../services/personaService.js";
import { useAuthSession } from "../../auth/useAuthSession.js";
import { useAuthClaims } from "../../auth/useAuthClaims.js";

function str(row, key) {
  if (!row) return "";
  const v = row[key];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

const RX_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]+$/;
const PARENTESCO_OTROS_ID = "CFG_PAR_OTROS";
const DDJJ_ESTADO_OMITIDA_ONBOARDING_ID = "CFG_DDJJ_02_OMITIDA_ONBOARDING";
const DDJJ_ESTADO_PRESENTADA_ID = "CFG_DDJJ_03_PRESENTADA";

function isParentescoOtros(parCatalog, parentescoId) {
  const id = (parentescoId || "").trim();
  if (!id) return false;
  return id.toUpperCase() === PARENTESCO_OTROS_ID;
}

export function useOnboardingWizard() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const nav = useNavigate();
  const personaId = typeof claims?.persona_id === "string" ? claims.persona_id : null;
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prov, setProv] = useState([]);
  const [loc, setLoc] = useState([]);
  const [par, setPar] = useState([]);
  const [saving, setSaving] = useState(false);

  const [contacto, setContacto] = useState({
    email_personal: "",
    telefono_celular: "",
    telefono_fijo: "",
    recibe_notificaciones_sms: false,
  });
  const [dom, setDom] = useState({
    calle: "",
    numero: "",
    piso: "",
    departamento: "",
    codigo_postal: "",
    provincia_id: "",
    localidad_id: "",
    referencia: "",
  });
  const [famRows, setFamRows] = useState([
    {
      nombre: "",
      apellido: "",
      dni: "",
      fecha_nacimiento: "",
      parentesco_id: "",
      parentesco_otro_detalle: "",
      convive: true,
      domicilio_familiar: "",
      dependiente: false,
      detalle_dependencia: "",
      discapacidad_declarada: false,
    },
  ]);
  const [ddjjAceptada, setDdjjAceptada] = useState(false);
  const [ddjjEvaluacionAceptada, setDdjjEvaluacionAceptada] = useState(false);
  const [ddjjStage, setDdjjStage] = useState("choice");

  useEffect(() => {
    const emailSesion = (user && user.email ? String(user.email).trim().toLowerCase() : "") || "";
    if (!emailSesion) return;
    setContacto((prev) =>
      prev.email_personal === emailSesion ? prev : { ...prev, email_personal: emailSesion },
    );
  }, [user]);

  useEffect(() => {
    if (!personaId) return () => {};
    return subscribePersonaById(personaId, setPersona);
  }, [personaId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [r1, r2, r3] = await Promise.all([
          callListarCatalogoOnboarding({ collectionName: "cfg_provincia" }),
          callListarCatalogoOnboarding({ collectionName: "cfg_localidad" }),
          callListarCatalogoOnboarding({ collectionName: "cfg_parentesco" }),
        ]);
        if (!active) return;
        setProv((r1.data && r1.data.items) || []);
        setLoc((r2.data && r2.data.items) || []);
        setPar((r3.data && r3.data.items) || []);
      } catch {
        if (active) toast.error("No se pudieron cargar los catálogos. Reintentá.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const localidadesFiltradas = useMemo(() => {
    if (!dom.provincia_id) return loc;
    return loc.filter((l) => str(l, "provincia_id") === dom.provincia_id);
  }, [loc, dom.provincia_id]);

  const effectivePersona = personaId ? persona : null;
  const rawOnb = effectivePersona && effectivePersona.onboarding_mvp;
  const pOnb = rawOnb && typeof rawOnb === "object" ? rawOnb : null;
  const doneA = Boolean(pOnb && pOnb.paso_a);
  const doneB = Boolean(pOnb && (pOnb.paso_b || pOnb.paso_b_omitido));
  const step = !doneA ? 1 : !doneB ? 2 : 3;

  useEffect(() => {
    if (!pOnb) return;
    const estadoDdjjId = str(pOnb, "estado_declaracion_ddjj_id").toUpperCase();
    if (estadoDdjjId === DDJJ_ESTADO_PRESENTADA_ID) {
      const familiares = Array.isArray(pOnb.ddjj_familiares) ? pOnb.ddjj_familiares : [];
      if (familiares.length > 0) {
        setFamRows(
          familiares.map((r) => ({
            nombre: str(r, "nombre"),
            apellido: str(r, "apellido"),
            dni: str(r, "dni"),
            fecha_nacimiento: str(r, "fecha_nacimiento"),
            parentesco_id: str(r, "parentesco_id"),
            parentesco_otro_detalle: str(r, "parentesco_otro_detalle"),
            convive: r?.convive !== false,
            domicilio_familiar: str(r, "domicilio_familiar"),
            dependiente: r?.dependiente === true,
            detalle_dependencia: str(r, "dependiente_detalle"),
            discapacidad_declarada: r?.discapacidad_declarada === true,
          })),
        );
      }
      setDdjjAceptada(pOnb.declaracion_jurada_aceptada === true);
      setDdjjStage("review");
      return;
    }
    if (estadoDdjjId === DDJJ_ESTADO_OMITIDA_ONBOARDING_ID) {
      setDdjjAceptada(false);
      setDdjjStage("choice");
    }
  }, [pOnb]);

  useEffect(() => {
    if (effectivePersona && str(effectivePersona, "estado") === ESTADO_ACTIVO_MVP) {
      nav("/portal/home", { replace: true });
    }
  }, [effectivePersona, nav]);

  async function guardarPasoA(e) {
    e.preventDefault();
    setSaving(true);
    const t = toast.loading("Guardando contacto y domicilio…");
    try {
      const { data } = await callOnboardingMvpPasoA({ contacto, domicilio: { ...dom } });
      if (data?.ok) toast.success("Datos guardados", { id: t });
      else throw new Error();
    } catch (err) {
      toast.error((err && err.message) || "No se pudo guardar.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  function updateFam(i, key, v) {
    setFamRows((rows) => {
      const next = rows.slice();
      next[i] = { ...next[i], [key]: v };
      return next;
    });
  }

  function iniciarDdjjAhora() {
    setDdjjAceptada(false);
    setDdjjEvaluacionAceptada(false);
    setDdjjStage("edit");
  }

  function cerrarDdjjParaRevision() {
    const rows = famRows.filter(
      (r) =>
        (r.nombre || "").trim() ||
        (r.apellido || "").trim() ||
        (r.dni || "").trim() ||
        (r.fecha_nacimiento || "").trim() ||
        (r.parentesco_id || "").trim(),
    );
    if (rows.length < 1) {
      toast.error("Agregá al menos un integrante para cerrar la DDJJ.");
      return false;
    }
    for (const r of rows) {
      if (
        !(r.nombre || "").trim() ||
        !(r.apellido || "").trim() ||
        !normalizeDni(r.dni) ||
        !(r.fecha_nacimiento || "").trim() ||
        !(r.parentesco_id || "").trim()
      ) {
        toast.error("Cada integrante requiere nombre, apellido, DNI, fecha de nacimiento y parentesco.");
        return false;
      }
      if (!RX_NOMBRE.test((r.nombre || "").trim()) || !RX_NOMBRE.test((r.apellido || "").trim())) {
        toast.error("Nombre y apellido solo admiten letras y espacios.");
        return false;
      }
      if (!/^\d{6,12}$/.test(normalizeDni(r.dni))) {
        toast.error("DNI inválido: usá solo números (6 a 12 dígitos).");
        return false;
      }
      if (r.convive === false && !(r.domicilio_familiar || "").trim()) {
        toast.error("Si no convive, debés informar el domicilio del familiar.");
        return false;
      }
      if (isParentescoOtros(par, r.parentesco_id) && !(r.parentesco_otro_detalle || "").trim()) {
        toast.error("Si seleccionás parentesco 'Otros', debés completar el detalle.");
        return false;
      }
      if (r.dependiente === true && !(r.detalle_dependencia || "").trim()) {
        toast.error("Si es dependiente, debés informar el detalle de dependencia.");
        return false;
      }
    }
    setDdjjStage("review");
    return true;
  }

  function volverEdicionDdjj() {
    setDdjjStage("edit");
  }

  function quitarIntegrante(index) {
    setFamRows((rows) => {
      const next = rows.filter((_, i) => i !== index);
      if (next.length > 0) return next;
      setDdjjStage("edit");
      return [
        {
          nombre: "",
          apellido: "",
          dni: "",
          fecha_nacimiento: "",
          parentesco_id: "",
          parentesco_otro_detalle: "",
          convive: true,
          domicilio_familiar: "",
          dependiente: false,
          detalle_dependencia: "",
          discapacidad_declarada: false,
        },
      ];
    });
  }

  async function guardarDdjj(e) {
    e.preventDefault();
    if (ddjjEvaluacionAceptada !== true) {
      toast.error("Debés aceptar que tu DDJJ será evaluada por el área correspondiente.");
      return;
    }
    setSaving(true);
    const t = toast.loading("Guardando declaración…");
    const familiares = famRows
      .map((r) => ({
        nombre: r.nombre.trim(),
        apellido: (r.apellido || "").trim(),
        dni: normalizeDni(r.dni),
        fecha_nacimiento: (r.fecha_nacimiento || "").trim(),
        parentesco_id: r.parentesco_id.trim(),
        parentesco_otro_detalle: (r.parentesco_otro_detalle || "").trim(),
        convive: r.convive === true,
        domicilio_familiar: (r.domicilio_familiar || "").trim(),
        dependiente: r.dependiente === true,
        dependiente_detalle: (r.detalle_dependencia || "").trim(),
        discapacidad_declarada: r.discapacidad_declarada === true,
      }))
      .filter(
        (r) =>
          r.nombre ||
          r.apellido ||
          r.dni ||
          r.fecha_nacimiento ||
          r.parentesco_id ||
          r.parentesco_otro_detalle ||
          r.domicilio_familiar ||
          r.dependiente_detalle,
      );
    try {
      const { data } = await callOnboardingMvpDdjjFamiliar({
        familiares,
        declaracion_jurada_aceptada: ddjjAceptada === true,
        consentimiento_evaluacion_rrhh: ddjjEvaluacionAceptada === true,
      });
      if (data?.ok) toast.success("Grupo familiar registrado", { id: t });
      else throw new Error();
    } catch (err) {
      toast.error((err && err.message) || "Revisá los datos.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  async function omitirDdjj() {
    setSaving(true);
    const t = toast.loading("Guardando decisión…");
    try {
      const { data } = await callOnboardingMvpOmitirDdjjFamiliar();
      if (data?.ok) toast.success("Podrás completar la DDJJ más adelante.", { id: t });
      else throw new Error();
    } catch (err) {
      toast.error((err && err.message) || "No se pudo guardar la decisión.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  async function finalizarMvp() {
    setSaving(true);
    const t = toast.loading("Habilitando acceso…");
    try {
      const { data } = await callOnboardingMvpCompletar();
      if (!data?.ok) throw new Error();
      if (user) await user.getIdToken(true);
      toast.success("Tu ficha quedó activa", { id: t });
      nav("/portal/home", { replace: true });
    } catch (err) {
      toast.error((err && err.message) || "No se pudo finalizar.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    personaId,
    personaNombre: str(effectivePersona || {}, "nombre"),
    personaApellido: str(effectivePersona || {}, "apellido"),
    personaDni: str(effectivePersona || {}, "dni"),
    loading,
    saving,
    step,
    prov,
    par,
    contacto,
    dom,
    famRows,
    ddjjAceptada,
    ddjjEvaluacionAceptada,
    ddjjStage,
    localidadesFiltradas,
    setContacto,
    setDom,
    setFamRows,
    setDdjjAceptada,
    setDdjjEvaluacionAceptada,
    updateFam,
    iniciarDdjjAhora,
    cerrarDdjjParaRevision,
    volverEdicionDdjj,
    quitarIntegrante,
    guardarPasoA,
    guardarDdjj,
    omitirDdjj,
    finalizarMvp,
  };
}

