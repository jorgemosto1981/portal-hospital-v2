import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updateEmail,
  updatePassword,
} from "firebase/auth";

import Card from "../components/ui/Card.jsx";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { guardarRegistroPersonal, listarColeccionPersonal } from "../services/datosPersonalesService.js";
import { callNotificarCambioEmailAuth, callNotificarCambioPasswordAuth } from "../services/callables.js";
import { authV2 } from "../services/firebase.js";
import { buildDatosPayload, hydrateDatosPersonales, validateDatosPersonales } from "./datos-personales/formLogic.js";
import { ESTADO_DDJJ_DEFAULT_PERSONALES, INITIAL_FORM_DATA_PERSONALES } from "./datos-personales/constants.js";
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
        const [rows, rowsEstadoCivil, rowsLocalidad, rowsProvincia] = await Promise.all([
          listarColeccionPersonal("personas"),
          listarColeccionPersonal("cfg_estado_civil"),
          listarColeccionPersonal("cfg_localidad"),
          listarColeccionPersonal("cfg_provincia"),
        ]);
        if (cancelled) return;
        setCfgEstadoCivil(rowsEstadoCivil || []);
        setCfgLocalidad(rowsLocalidad || []);
        setCfgProvincia(rowsProvincia || []);
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
      await updateEmail(user, emailTarget);
      await sendEmailVerification(user);
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
    if (String(claveNueva).length < 8) {
      setSeguridadMsg("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (claveNueva !== claveNueva2) {
      setSeguridadMsg("La confirmación de contraseña no coincide.");
      return;
    }
    setPassBusy(true);
    try {
      const user = await reauthWithPassword(claveActualPass);
      await updatePassword(user, claveNueva);
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
        <p className="text-base font-semibold text-slate-900">Seguridad de la cuenta</p>
        <p className="mt-1 text-sm text-slate-600">
          Cambios de autenticación con revalidación de contraseña y notificación automática a bandeja RRHH.
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
            <p className="text-sm font-semibold text-slate-800">Cambiar contraseña</p>
            <input
              type="password"
              value={claveActualPass}
              onChange={(e) => setClaveActualPass(e.target.value)}
              placeholder="Contraseña actual"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <input
              type="password"
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
              placeholder="Nueva contraseña (mín. 8)"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <input
              type="password"
              value={claveNueva2}
              onChange={(e) => setClaveNueva2(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <button
              type="submit"
              disabled={passBusy}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {passBusy ? "Procesando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

        {seguridadMsg ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${seguridadMsg.toLowerCase().includes("evento rrhh") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {seguridadMsg}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
