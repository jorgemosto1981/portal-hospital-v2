import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  callListarCatalogoOnboarding,
  callOnboardingMvpCompletar,
  callOnboardingMvpDdjjFamiliar,
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
  const [famRows, setFamRows] = useState([{ nombre: "", dni: "", parentesco_id: "" }]);

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
  const doneB = Boolean(pOnb && pOnb.paso_b);
  const step = !doneA ? 1 : !doneB ? 2 : 3;

  useEffect(() => {
    if (effectivePersona && str(effectivePersona, "estado") === ESTADO_ACTIVO_MVP) {
      nav("/inicio", { replace: true });
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

  async function guardarDdjj(e) {
    e.preventDefault();
    setSaving(true);
    const t = toast.loading("Guardando declaración…");
    const familiares = famRows
      .map((r) => ({ nombre: r.nombre.trim(), dni: normalizeDni(r.dni), parentesco_id: r.parentesco_id.trim() }))
      .filter((r) => r.nombre || r.dni || r.parentesco_id);
    try {
      const { data } = await callOnboardingMvpDdjjFamiliar({ familiares });
      if (data?.ok) toast.success("Grupo familiar registrado", { id: t });
      else throw new Error();
    } catch (err) {
      toast.error((err && err.message) || "Revisá los datos.", { id: t });
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
      nav("/inicio", { replace: true });
    } catch (err) {
      toast.error((err && err.message) || "No se pudo finalizar.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    personaId,
    loading,
    saving,
    step,
    prov,
    par,
    contacto,
    dom,
    famRows,
    localidadesFiltradas,
    setContacto,
    setDom,
    setFamRows,
    updateFam,
    guardarPasoA,
    guardarDdjj,
    finalizarMvp,
  };
}

