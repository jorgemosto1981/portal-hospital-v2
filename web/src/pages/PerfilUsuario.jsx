import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
} from "firebase/auth";

import Card from "../components/ui/Card.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { guardarRegistroPersonal, listarColeccionPersonal } from "../services/datosPersonalesService.js";
import { callNotificarCambioEmailAuth, callNotificarCambioPasswordAuth } from "../services/callables.js";
import { authV2 } from "../services/firebase.js";
import { buildDatosPayload, hydrateDatosPersonales, validateDatosPersonales } from "./datos-personales/formLogic.js";
import DdjjFields from "./datos-personales/sections/DdjjFields.jsx";
import { ESTADO_DDJJ_DEFAULT_PERSONALES, HELP, INITIAL_FORM_DATA_PERSONALES } from "./datos-personales/constants.js";
import { emptyFamiliar, toOpts } from "./datos-personales/utils.js";

function sameValue(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

function formatDdMmAaaa(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function mapEstadoDdjjToUiLabel(estadoIdRaw) {
  const estadoId = String(estadoIdRaw || "").trim().toUpperCase();
  if (estadoId === "CFG_DDJJ_03_PRESENTADA") return "Presentada";
  if (estadoId === "CFG_DDJJ_04_SUPERADA_POR_ACTUALIZACION") return "Superada por actualización";
  return "Pendiente de presentación";
}

function mapEstadoAuditoriaFamiliarToUi(estadoIdRaw) {
  const id = String(estadoIdRaw || "").trim().toUpperCase();
  if (id === "CFG_EAF_02_APROBADO") {
    return {
      label: "Aprobado",
      message: "Validado por AUDITOR.",
      badgeClass: "border-emerald-300 bg-emerald-100 text-emerald-800",
    };
  }
  if (id === "CFG_EAF_03_OBSERVADO") {
    return {
      label: "Observado",
      message: "Requiere revisión adicional por AUDITOR.",
      badgeClass: "border-amber-300 bg-amber-100 text-amber-800",
    };
  }
  if (id === "CFG_EAF_04_RECHAZADO") {
    return {
      label: "Rechazado",
      message: "No cumple criterios. Revisá el motivo informado.",
      badgeClass: "border-rose-300 bg-rose-100 text-rose-800",
    };
  }
  return {
    label: "Pendiente",
    message: "En evaluación por AUDITOR.",
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
  };
}

function toEpochMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function PerfilUsuario() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const personaId = String((claims && claims.persona_id) || "").trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM_DATA_PERSONALES }));
  const [baseForm, setBaseForm] = useState(() => ({ ...INITIAL_FORM_DATA_PERSONALES }));
  const [cfgEstadoCivil, setCfgEstadoCivil] = useState([]);
  const [cfgLocalidad, setCfgLocalidad] = useState([]);
  const [cfgProvincia, setCfgProvincia] = useState([]);
  const [cfgParentesco, setCfgParentesco] = useState([]);
  const [ddjjRows, setDdjjRows] = useState([]);
  const [ddjjModalAbierto, setDdjjModalAbierto] = useState(false);
  const [ddjjFlowMode, setDdjjFlowMode] = useState("idle");
  const [ddjjSaving, setDdjjSaving] = useState(false);
  const [ddjjMsg, setDdjjMsg] = useState("");
  const [ddjjForm, setDdjjForm] = useState(() => ({
    ...INITIAL_FORM_DATA_PERSONALES,
    persona_id: personaId,
  }));
  const [ddjjFamiliares, setDdjjFamiliares] = useState([emptyFamiliar()]);
  const [seguridadMsg, setSeguridadMsg] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [claveActualEmail, setClaveActualEmail] = useState("");
  const [claveActualPass, setClaveActualPass] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveNueva2, setClaveNueva2] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!personaId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [rows, rowsEstadoCivil, rowsLocalidad, rowsProvincia, rowsParentesco, rowsDdjj] = await Promise.all([
          listarColeccionPersonal("personas"),
          listarColeccionPersonal("cfg_estado_civil"),
          listarColeccionPersonal("cfg_localidad"),
          listarColeccionPersonal("cfg_provincia"),
          listarColeccionPersonal("cfg_parentesco"),
          listarColeccionPersonal("declaraciones_grupo_familiar"),
        ]);
        if (cancelled) return;
        setCfgEstadoCivil(rowsEstadoCivil || []);
        setCfgLocalidad(rowsLocalidad || []);
        setCfgProvincia(rowsProvincia || []);
        setCfgParentesco(rowsParentesco || []);
        setDdjjRows(rowsDdjj || []);
        const row = (rows || []).find((r) => String(r.id || "") === personaId);
        if (!row) {
          setSaveMsg("No se encontró el perfil de la persona en base de datos.");
          setLoading(false);
          return;
        }
        const next = hydrateDatosPersonales({
          record: row,
          prevForm: { ...INITIAL_FORM_DATA_PERSONALES, persona_id: personaId },
          emptyFamiliar,
        });
        if (!next) {
          setSaveMsg("No se pudo hidratar el perfil.");
          setLoading(false);
          return;
        }
        setForm(next.form);
        setBaseForm(next.form);
        setEditId(String(row.id || personaId));
      } catch (e) {
        setSaveMsg(e instanceof Error ? e.message : "Error al cargar perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const ddjjRowsPersona = useMemo(() => {
    const pid = String(personaId || "").trim();
    if (!pid) return [];
    return (ddjjRows || [])
      .filter((r) => String(r.titular_persona_id || "") === pid)
      .slice()
      .sort((a, b) => {
        const va = Number(a?.declaracion_version) || 0;
        const vb = Number(b?.declaracion_version) || 0;
        if (vb !== va) return vb - va;
        const ta = toEpochMs(a?.actualizado_en) || toEpochMs(a?.creado_en);
        const tb = toEpochMs(b?.actualizado_en) || toEpochMs(b?.creado_en);
        return tb - ta;
      });
  }, [ddjjRows, personaId]);

  const ultimaDdjj = useMemo(() => ddjjRowsPersona[0] || null, [ddjjRowsPersona]);
  const ddjjEstadoLabel = useMemo(
    () => mapEstadoDdjjToUiLabel(ultimaDdjj?.estado_declaracion_id),
    [ultimaDdjj],
  );
  const ddjjVersionActual = useMemo(() => String(Number(ultimaDdjj?.declaracion_version || 0) || 0), [ultimaDdjj]);
  const ddjjNextVersion = useMemo(() => String((Number(ultimaDdjj?.declaracion_version || 0) || 0) + 1), [ultimaDdjj]);
  const optsParentesco = useMemo(() => toOpts(cfgParentesco), [cfgParentesco]);

  function abrirModalDdjj() {
    setDdjjMsg("");
    if (ultimaDdjj) {
      const hydrated = hydrateDatosPersonales({
        record: ultimaDdjj,
        prevForm: { ...INITIAL_FORM_DATA_PERSONALES, persona_id: personaId },
        emptyFamiliar,
      });
      if (hydrated) {
        setDdjjForm({
          ...hydrated.form,
          persona_id: personaId,
          declaracion_version: ddjjNextVersion,
          declaracion_jurada_aceptada: false,
          consentimiento_evaluacion_rrhh: false,
          ddjj_en_revision: false,
        });
        setDdjjFamiliares(hydrated.familiares);
      }
      setDdjjFlowMode("edit");
    } else {
      setDdjjForm({
        ...INITIAL_FORM_DATA_PERSONALES,
        persona_id: personaId,
        declaracion_version: "1",
        estado_declaracion_id: ESTADO_DDJJ_DEFAULT_PERSONALES,
        declaracion_jurada_aceptada: false,
        consentimiento_evaluacion_rrhh: false,
        ddjj_en_revision: false,
      });
      setDdjjFamiliares([emptyFamiliar()]);
      setDdjjFlowMode("edit");
    }
    setDdjjModalAbierto(true);
  }

  async function recargarDdjj() {
    const rowsDdjj = await listarColeccionPersonal("declaraciones_grupo_familiar");
    setDdjjRows(rowsDdjj || []);
  }

  async function presentarNuevaDdjj() {
    setDdjjMsg("");
    const err = validateDatosPersonales({
      tipo: "declaraciones_grupo_familiar",
      form: ddjjForm,
      familiares: ddjjFamiliares,
    });
    if (err) {
      setDdjjMsg(err);
      return;
    }
    setDdjjSaving(true);
    try {
      const payload = buildDatosPayload({
        tipo: "declaraciones_grupo_familiar",
        form: { ...ddjjForm, persona_id: personaId },
        familiares: ddjjFamiliares,
        modoEdicion: false,
        editId: "",
        estadoDdjjDefault: ESTADO_DDJJ_DEFAULT_PERSONALES,
        fotoRostro: null,
      });
      await guardarRegistroPersonal("declaraciones_grupo_familiar", payload);
      await recargarDdjj();
      setDdjjMsg("DDJJ presentada correctamente.");
      setDdjjModalAbierto(false);
    } catch (ex) {
      setDdjjMsg(ex instanceof Error ? ex.message : "No se pudo presentar la DDJJ.");
    } finally {
      setDdjjSaving(false);
    }
  }

  const cambioEstadoCivil = useMemo(
    () => !sameValue(form.estado_civil_id, baseForm.estado_civil_id),
    [form.estado_civil_id, baseForm.estado_civil_id],
  );
  const cambioDomicilio = useMemo(() => {
    const keys = [
      "calle",
      "numero",
      "piso",
      "departamento",
      "localidad_id",
      "codigo_postal",
      "provincia_id",
      "referencia",
    ];
    return keys.some((k) => !sameValue(form[k], baseForm[k]));
  }, [form, baseForm]);

  const optsEstadoCivil = useMemo(() => toOpts(cfgEstadoCivil), [cfgEstadoCivil]);
  const optsLocalidad = useMemo(() => toOpts(cfgLocalidad), [cfgLocalidad]);
  const optsProvincia = useMemo(() => toOpts(cfgProvincia), [cfgProvincia]);
  const estadoCivilLabel = useMemo(
    () => optsEstadoCivil.find((o) => String(o.value) === String(form.estado_civil_id || ""))?.label || "—",
    [optsEstadoCivil, form.estado_civil_id],
  );
  const localidadLabel = useMemo(
    () => optsLocalidad.find((o) => String(o.value) === String(form.localidad_id || ""))?.label || "—",
    [optsLocalidad, form.localidad_id],
  );
  const provinciaLabel = useMemo(
    () => optsProvincia.find((o) => String(o.value) === String(form.provincia_id || ""))?.label || "—",
    [optsProvincia, form.provincia_id],
  );

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function sanitizeText(v) {
    return String(v || "").replace(/[^\p{L}\p{N}\s.,'°/#-]/gu, "");
  }

  function sanitizeNumberLike(v) {
    return String(v || "").replace(/[^\d]/g, "");
  }

  async function onSave(e) {
    e.preventDefault();
    setSaveMsg("");
    if (!acepta) {
      setSaveMsg("Debés confirmar que los datos son reales para notificar la actualización.");
      return;
    }
    const err = validateDatosPersonales({
      tipo: "personas",
      form,
      familiares: [emptyFamiliar()],
    });
    if (err) {
      setSaveMsg(err);
      return;
    }
    if (!optsEstadoCivil.some((o) => String(o.value) === String(form.estado_civil_id || ""))) {
      setSaveMsg("Seleccioná un estado civil válido.");
      return;
    }
    if (!optsLocalidad.some((o) => String(o.value) === String(form.localidad_id || ""))) {
      setSaveMsg("Seleccioná una localidad válida.");
      return;
    }
    if (!optsProvincia.some((o) => String(o.value) === String(form.provincia_id || ""))) {
      setSaveMsg("Seleccioná una provincia válida.");
      return;
    }
    if (!/^\d{6,15}$/.test(String(form.telefono_celular || ""))) {
      setSaveMsg("Teléfono celular inválido: solo números (6 a 15 dígitos).");
      return;
    }
    if (String(form.telefono_fijo || "").trim() && !/^\d{6,15}$/.test(String(form.telefono_fijo || ""))) {
      setSaveMsg("Teléfono fijo inválido: solo números (6 a 15 dígitos).");
      return;
    }
    if (String(form.codigo_postal || "").trim() && !/^\d{4,8}$/.test(String(form.codigo_postal || ""))) {
      setSaveMsg("Código postal inválido: solo números (4 a 8 dígitos).");
      return;
    }
    setSaving(true);
    try {
      const datos = buildDatosPayload({
        tipo: "personas",
        form,
        familiares: [emptyFamiliar()],
        modoEdicion: true,
        editId,
        estadoDdjjDefault: ESTADO_DDJJ_DEFAULT_PERSONALES,
        fotoRostro: null,
      });
      datos.origen_flujo = "perfil_usuario";
      const r = await guardarRegistroPersonal("personas", datos);
      const msgEvento = r?.evento_id
        ? `Evento auditado: ${String(r.evento_id)} (enviado a bandeja RRHH pendiente).`
        : "Evento auditado enviado a bandeja RRHH pendiente.";
      setSaveMsg(`Notificación enviada. ID actualización: ${String(r?.id || editId || personaId)}. ${msgEvento}`);
      setModoEdicion(false);
      setAcepta(false);
      setBaseForm(form);
    } catch (ex) {
      setSaveMsg(ex instanceof Error ? ex.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function reauthWithPassword(password) {
    const user = authV2.currentUser;
    const email = String(user?.email || "").trim().toLowerCase();
    if (!user || !email) throw new Error("No hay sesión activa con email para reautenticación.");
    const cred = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, cred);
    return user;
  }

  async function onCambiarEmail(e) {
    e.preventDefault();
    setSeguridadMsg("");
    const emailTarget = String(nuevoEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTarget)) {
      setSeguridadMsg("Ingresá un correo electrónico válido.");
      return;
    }
    if (!claveActualEmail.trim()) {
      setSeguridadMsg("Ingresá tu contraseña actual para confirmar el cambio de email.");
      return;
    }
    setEmailBusy(true);
    try {
      const user = await reauthWithPassword(claveActualEmail);
      const emailPrev = String(user.email || "").trim().toLowerCase();
      if (emailPrev === emailTarget) {
        throw new Error("El nuevo correo debe ser distinto al actual.");
      }
      await verifyBeforeUpdateEmail(user, emailTarget);
      const resp = await callNotificarCambioEmailAuth({
        etapa: "solicitado",
        nuevo_email: emailTarget,
      });
      setSeguridadMsg(
        `Cambio de email solicitado. Verificá tu nuevo correo. Evento RRHH: ${String(resp?.data?.evento_id || "—")}.`,
      );
      setNuevoEmail("");
      setClaveActualEmail("");
    } catch (err) {
      setSeguridadMsg(err instanceof Error ? err.message : "No se pudo cambiar el correo.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function onCambiarPassword(e) {
    e.preventDefault();
    setSeguridadMsg("");
    if (!claveActualPass.trim()) {
      setSeguridadMsg("Ingresá tu contraseña actual.");
      return;
    }
    const pinNuevo = String(claveNueva || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(pinNuevo)) {
      setSeguridadMsg(
        "El acceso con DNI en el portal usa un PIN de exactamente 6 dígitos como contraseña. Ingresá un nuevo PIN solo numérico (6 dígitos).",
      );
      return;
    }
    const pinConfirma = String(claveNueva2 || "").replace(/\D/g, "").slice(0, 6);
    if (pinNuevo !== pinConfirma) {
      setSeguridadMsg("La confirmación del PIN no coincide.");
      return;
    }
    setPassBusy(true);
    try {
      const user = await reauthWithPassword(claveActualPass);
      await updatePassword(user, pinNuevo);
      const resp = await callNotificarCambioPasswordAuth({});
      setSeguridadMsg(
        `Contraseña actualizada correctamente. Evento RRHH: ${String(resp?.data?.evento_id || "—")}.`,
      );
      setClaveActualPass("");
      setClaveNueva("");
      setClaveNueva2("");
    } catch (err) {
      setSeguridadMsg(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setPassBusy(false);
    }
  }

  if (loading) {
    return <Card className="px-4 py-5">Cargando perfil...</Card>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <Card className="px-4 py-5 md:px-6">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Perfil</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vista resumida para actualizar datos personales básicos.
        </p>
      </Card>

      <Card className="px-4 py-4 md:px-5">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setModoEdicion((v) => !v)}
            className={`h-11 rounded-xl border px-4 text-sm font-semibold ${
              modoEdicion
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            Actualizar información
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSave}>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
            <div><label className="block text-sm font-medium text-slate-700">Nombre completo legal</label><input disabled value={form.nombre_completo_legal || "—"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" /></div>
            <div><label className="block text-sm font-medium text-slate-700">DNI</label><input disabled value={form.dni || "—"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" /></div>
            <div><label className="block text-sm font-medium text-slate-700">CUIL</label><input disabled value={form.cuil || "—"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Fecha de nacimiento</label><input disabled value={formatDdMmAaaa(form.fecha_nacimiento)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Email personal</label><input disabled value={form.email_personal || "—"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" /></div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Estado civil</label>
              {modoEdicion ? (
                <select value={form.estado_civil_id} onChange={(e) => setField("estado_civil_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">Seleccionar...</option>
                  {optsEstadoCivil.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input disabled value={estadoCivilLabel} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" />
              )}
            </div>
            <div><label className="block text-sm font-medium text-slate-700">Teléfono celular</label><input value={form.telefono_celular} onChange={(e) => setField("telefono_celular", sanitizeNumberLike(e.target.value))} inputMode="numeric" disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Teléfono fijo</label><input value={form.telefono_fijo} onChange={(e) => setField("telefono_fijo", sanitizeNumberLike(e.target.value))} inputMode="numeric" disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Calle</label><input value={form.calle} onChange={(e) => setField("calle", sanitizeText(e.target.value))} disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Número</label><input value={form.numero} onChange={(e) => setField("numero", sanitizeNumberLike(e.target.value))} inputMode="numeric" disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Piso</label><input value={form.piso} onChange={(e) => setField("piso", sanitizeText(e.target.value))} disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div><label className="block text-sm font-medium text-slate-700">Departamento</label><input value={form.departamento} onChange={(e) => setField("departamento", sanitizeText(e.target.value))} disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Localidad</label>
              {modoEdicion ? (
                <select value={form.localidad_id} onChange={(e) => setField("localidad_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">Seleccionar...</option>
                  {optsLocalidad.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input disabled value={localidadLabel} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" />
              )}
            </div>
            <div><label className="block text-sm font-medium text-slate-700">Código postal</label><input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", sanitizeNumberLike(e.target.value))} inputMode="numeric" disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Provincia</label>
              {modoEdicion ? (
                <select value={form.provincia_id} onChange={(e) => setField("provincia_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">Seleccionar...</option>
                  {optsProvincia.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input disabled value={provinciaLabel} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm" />
              )}
            </div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Referencia</label><input value={form.referencia} onChange={(e) => setField("referencia", sanitizeText(e.target.value))} disabled={!modoEdicion} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>
          </div>

          {cambioEstadoCivil ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Si modificás estado civil, debés presentar documentación legal (acta de matrimonio, sentencia de divorcio, etc.) en RRHH del efector.
            </p>
          ) : null}
          {cambioDomicilio ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Si modificás domicilio, debés presentar documentación legal (constancia de cambio de domicilio, nuevo DNI, etc.) en RRHH del efector.
            </p>
          ) : null}

          {modoEdicion ? (
            <label className="inline-flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5"
              />
              Declaro que los datos ingresados son reales y notifico formalmente la actualización de datos personales.
            </label>
          ) : null}

          {saveMsg ? (
            <p className={`rounded-lg px-3 py-2 text-sm ${saveMsg.startsWith("Notificación enviada") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {saveMsg}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!modoEdicion || !acepta || saving}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Notificando..." : "Notificar actualización de datos"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-slate-900">Declaración de Grupo Familiar</p>
            <p className="mt-1 text-sm text-slate-600">
              Se visualiza la última DDJJ presentada del titular autenticado.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirModalDdjj}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Actualizar DDJJ
          </button>
        </div>
        {ultimaDdjj ? (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 text-xs text-slate-700 md:grid-cols-3">
              <p>
                <span className="font-semibold">Estado:</span> {ddjjEstadoLabel}
              </p>
              <p>
                <span className="font-semibold">Versión:</span> {ddjjVersionActual}
              </p>
              <p>
                <span className="font-semibold">Última presentación:</span> {formatDdMmAaaa(ultimaDdjj.actualizado_en || ultimaDdjj.creado_en)}
              </p>
            </div>
            <div className="space-y-2">
              {(Array.isArray(ultimaDdjj.familiares) ? ultimaDdjj.familiares : []).map((f, idx) => (
                <div key={`perfil-ddjj-fam-${idx}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                  {(() => {
                    const estado = mapEstadoAuditoriaFamiliarToUi(f.estado_auditoria_familiar_id);
                    return (
                      <>
                  <p className="font-semibold text-slate-800">
                    {String(f.apellido || "").trim()} {String(f.nombre || "").trim() || "Familiar sin nombre"}
                  </p>
                  <p>DNI: {String(f.dni || "—")}</p>
                  <p>Parentesco: {optsParentesco.find((o) => String(o.value) === String(f.parentesco_id || ""))?.label || "—"}</p>
                  <p>Fecha nacimiento: {formatDdMmAaaa(f.fecha_nacimiento)}</p>
                        <p className="mt-1">
                          Estado auditoría:{" "}
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estado.badgeClass}`}>
                            {estado.label}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-600">{estado.message}</p>
                        {String(f.motivo_rechazo_id || "").trim() ? (
                          <p className="text-[11px] text-slate-600">
                            Motivo: {String(f.motivo_rechazo_id)}
                            {String(f.motivo_rechazo_detalle || "").trim()
                              ? ` · ${String(f.motivo_rechazo_detalle)}`
                              : ""}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No hay DDJJ presentada todavía para esta persona.
          </p>
        )}
      </Card>

      <Card className="px-4 py-4 md:px-5">
        <p className="text-base font-semibold text-slate-900">Seguridad de la cuenta</p>
        <p className="mt-1 text-sm text-slate-600">
          Cambios de autenticación con revalidación y notificación a bandeja RRHH. La clave del portal es el mismo PIN de
          6 dígitos que usás al iniciar sesión con DNI; solo podés reemplazarlo por otro PIN de 6 dígitos.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={onCambiarEmail}>
            <p className="text-sm font-semibold text-slate-800">Cambiar correo electrónico</p>
            <input
              type="email"
              value={nuevoEmail}
              onChange={(e) => setNuevoEmail(e.target.value)}
              placeholder="Nuevo correo"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <input
              type="password"
              value={claveActualEmail}
              onChange={(e) => setClaveActualEmail(e.target.value)}
              placeholder="Contraseña actual"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <button
              type="submit"
              disabled={emailBusy}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {emailBusy ? "Procesando..." : "Cambiar correo"}
            </button>
          </form>

          <form className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={onCambiarPassword}>
            <p className="text-sm font-semibold text-slate-800">Cambiar PIN (6 dígitos)</p>
            <input
              type="password"
              value={claveActualPass}
              onChange={(e) => setClaveActualPass(e.target.value)}
              placeholder="PIN o contraseña actual"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <input
              type="password"
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Nuevo PIN (6 dígitos)"
              inputMode="numeric"
              maxLength={6}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <input
              type="password"
              value={claveNueva2}
              onChange={(e) => setClaveNueva2(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Confirmar nuevo PIN"
              inputMode="numeric"
              maxLength={6}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <button
              type="submit"
              disabled={passBusy}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {passBusy ? "Procesando..." : "Cambiar PIN"}
            </button>
          </form>
        </div>

        {seguridadMsg ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${seguridadMsg.toLowerCase().includes("evento rrhh") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {seguridadMsg}
          </p>
        ) : null}
      </Card>

      {ddjjModalAbierto ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 px-4 py-4 md:py-8">
          <div className="w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:max-h-[90vh] md:p-5">
            <p className="text-base font-semibold text-slate-900">Actualizar Declaración de Grupo Familiar</p>
            <p className="mt-1 text-sm text-slate-600">
              Esta presentación generará una nueva versión de DDJJ para tu persona.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <DdjjFields
                ESTADO_DDJJ_DEFAULT_PERSONALES={ESTADO_DDJJ_DEFAULT_PERSONALES}
                estadoDeclaracionIdActual={String(ddjjForm.estado_declaracion_id || ESTADO_DDJJ_DEFAULT_PERSONALES)}
                estadoDeclaracionUiLabel={mapEstadoDdjjToUiLabel(ddjjForm.estado_declaracion_id)}
                HELP={HELP}
                modoEdicion
                form={ddjjForm}
                nextDeclaracionVersion={ddjjNextVersion}
                setFamiliares={setDdjjFamiliares}
                emptyFamiliar={emptyFamiliar}
                familiares={ddjjFamiliares}
                optsParentesco={optsParentesco}
                setField={(key, value) => setDdjjForm((prev) => ({ ...prev, [key]: value }))}
                flowMode={ddjjFlowMode}
                onStartDdjj={() => setDdjjFlowMode("edit")}
                onActualizarDdjj={() => setDdjjFlowMode("edit")}
                onBackToEdit={() => setDdjjFlowMode("edit")}
                disabled={ddjjSaving}
                hideTopSummary
                hideOperationalNotes
              />
            </div>

            {ddjjMsg ? (
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${ddjjMsg.toLowerCase().includes("correctamente") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {ddjjMsg}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={ddjjSaving}
                onClick={() => {
                  setDdjjModalAbierto(false);
                  setDdjjMsg("");
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              {ddjjFlowMode === "edit" ? (
                <button
                  type="button"
                  disabled={ddjjSaving}
                  onClick={() => {
                    const familiaresLimpios = ddjjFamiliares.filter((f) =>
                      [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) =>
                        String(v || "").trim(),
                      ),
                    );
                    if (familiaresLimpios.length === 0) {
                      setDdjjMsg("Debés cargar al menos un familiar en DDJJ.");
                      return;
                    }
                    setDdjjFamiliares(familiaresLimpios);
                    const err = validateDatosPersonales({
                      tipo: "declaraciones_grupo_familiar",
                      form: { ...ddjjForm, ddjj_en_revision: false },
                      familiares: familiaresLimpios,
                    });
                    if (err) {
                      setDdjjMsg(err);
                      return;
                    }
                    setDdjjMsg("");
                    setDdjjForm((prev) => ({ ...prev, ddjj_en_revision: true }));
                    setDdjjFlowMode("review");
                  }}
                  className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Revisar y presentar DDJJ
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ddjjSaving}
                  onClick={presentarNuevaDdjj}
                  className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {ddjjSaving ? "Presentando..." : "Presentar nueva DDJJ"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
