import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import {
  callListarCatalogoOnboarding,
  callOnboardingMvpCompletar,
  callOnboardingMvpDdjjFamiliar,
  callOnboardingMvpPasoA,
} from "../../services/callables.js";
import { normalizeDni } from "../../services/authService.js";
import { ESTADO_ACTIVO_MVP, subscribePersonaById } from "../../services/personaService.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";

/**
 * @typedef {{ id: string, nombre?: string }} CatItem
 */

/**
 * @param {Record<string, unknown> | null} row
 * @param {string} key
 */
function str(row, key) {
  if (!row) return "";
  const v = row[key];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

export default function OnboardingWizard() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const nav = useNavigate();
  const personaId = typeof claims?.persona_id === "string" ? /** @type {string} */ (claims.persona_id) : null;
  const [persona, setPersona] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [prov, setProv] = useState(/** @type {CatItem[]} */ ([]));
  const [loc, setLoc] = useState(/** @type {CatItem[]} */ ([]));
  const [par, setPar] = useState(/** @type {CatItem[]} */ ([]));

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
  const [famRows, setFamRows] = useState(
    /** @type {{ nombre: string, dni: string, parentesco_id: string }[]} */ ([
      { nombre: "", dni: "", parentesco_id: "" },
    ]),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!personaId) {
      return () => {};
    }
    return subscribePersonaById(personaId, setPersona);
  }, [personaId]);

  useEffect(() => {
    let a = true;
    void (async () => {
      await Promise.resolve();
      if (!a) return;
      setLoading(true);
      try {
        const [r1, r2, r3] = await Promise.all([
          callListarCatalogoOnboarding({ collectionName: "cfg_provincia" }),
          callListarCatalogoOnboarding({ collectionName: "cfg_localidad" }),
          callListarCatalogoOnboarding({ collectionName: "cfg_parentesco" }),
        ]);
        if (!a) return;
        const pItems = (r1.data && r1.data.items) || [];
        const lItems = (r2.data && r2.data.items) || [];
        const sItems = (r3.data && r3.data.items) || [];
        setProv(/** @type {CatItem[]} */ (pItems));
        setLoc(/** @type {CatItem[]} */ (lItems));
        setPar(/** @type {CatItem[]} */ (sItems));
      } catch {
        if (a) toast.error("No se pudieron cargar los catálogos. Reintentá.");
      } finally {
        if (a) setLoading(false);
      }
    })();
    return () => {
      a = false;
    };
  }, []);

  const localidadesFiltradas = useMemo(() => {
    if (!dom.provincia_id) return loc;
    return loc.filter((l) => {
      const r = /** @type {Record<string, unknown>} */ (l);
      return str(r, "provincia_id") === dom.provincia_id;
    });
  }, [loc, dom.provincia_id]);

  const effectivePersona = personaId ? persona : null;
  const rawOnb =
    effectivePersona && /** @type {Record<string, unknown>} */ (effectivePersona).onboarding_mvp;
  const pOnb = rawOnb && typeof rawOnb === "object" ? rawOnb : null;
  const doneA = Boolean(pOnb && pOnb.paso_a);
  const doneB = Boolean(pOnb && pOnb.paso_b);
  const step = !doneA ? 1 : !doneB ? 2 : 3;

  useEffect(() => {
    if (effectivePersona && str(/** @type {Record<string, unknown>} */ (effectivePersona), "estado") === ESTADO_ACTIVO_MVP) {
      nav("/", { replace: true });
    }
  }, [effectivePersona, nav]);

  async function guardarPasoA(e) {
    e.preventDefault();
    setSaving(true);
    const t = toast.loading("Guardando contacto y domicilio…");
    try {
      const { data } = await callOnboardingMvpPasoA({ contacto, domicilio: { ...dom } });
      if (data?.ok) {
        toast.success("Datos guardados", { id: t });
      } else {
        throw new Error();
      }
    } catch (err) {
      const m = (err && /** @type {{ message?: string }} */ (err).message) || "No se pudo guardar.";
      toast.error(m, { id: t });
    } finally {
      setSaving(false);
    }
  }

  function updateFam(i, key, v) {
    setFamRows((rows) => {
      const n = rows.slice();
      n[i] = { ...n[i], [key]: v };
      return n;
    });
  }

  async function guardarDdjj(e) {
    e.preventDefault();
    setSaving(true);
    const t = toast.loading("Guardando declaración…");
    const familiares = famRows
      .map((r) => ({
        nombre: r.nombre.trim(),
        dni: normalizeDni(r.dni),
        parentesco_id: r.parentesco_id.trim(),
      }))
      .filter((r) => r.nombre || r.dni || r.parentesco_id);
    try {
      const { data } = await callOnboardingMvpDdjjFamiliar({ familiares });
      if (data?.ok) {
        toast.success("Grupo familiar registrado", { id: t });
      } else {
        throw new Error();
      }
    } catch (err) {
      const m = (err && /** @type {{ message?: string }} */ (err).message) || "Revisá los datos.";
      toast.error(m, { id: t });
    } finally {
      setSaving(false);
    }
  }

  async function finalizarMvp() {
    setSaving(true);
    const t = toast.loading("Habilitando acceso…");
    try {
      const { data } = await callOnboardingMvpCompletar();
      if (data?.ok) {
        if (user) {
          await user.getIdToken(true);
        }
        toast.success("Tu ficha quedó activa", { id: t });
        nav("/", { replace: true });
      } else {
        throw new Error();
      }
    } catch (err) {
      const m = (err && /** @type {{ message?: string }} */ (err).message) || "No se pudo finalizar.";
      toast.error(m, { id: t });
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <p className="p-6 text-center text-slate-500">Necesitás una sesión.</p>;
  }
  if (!personaId) {
    return <p className="p-6 text-center text-slate-500">Aún no hay ficha vinculada. Pasá por el paso de DNI.</p>;
  }
  if (loading && !prov.length) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center text-slate-500">Cargando asistente…</div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-3 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-slate-500">Completá la ficha para acceder a todas las funciones.</p>

        <div className="mb-4 mt-4 flex gap-2 text-sm">
          {["Contacto y domicilio", "Grupo familiar", "Habilitar"].map((l, i) => (
            <div
              key={l}
              className={
                "flex-1 rounded-lg border px-2 py-1.5 text-center " +
                (step === i + 1 ? "border-blue-500 bg-blue-50 font-medium" : "border-slate-200 bg-white")
              }
            >
              {i + 1}. {l}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <Card className="p-5 sm:p-6">
            <form onSubmit={guardarPasoA} className="space-y-4">
              <p className="text-sm text-slate-600">Paso 1: datos de contacto y domicilio (catálogos oficiales).</p>
              <div className="space-y-3">
                <label className="block text-sm font-medium">Email personal (opcional)</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={contacto.email_personal}
                  onChange={(e) => setContacto((c) => ({ ...c, email_personal: e.target.value }))}
                />
                <label className="block text-sm font-medium">Celular *</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={contacto.telefono_celular}
                  onChange={(e) => setContacto((c) => ({ ...c, telefono_celular: e.target.value }))}
                  required
                />
                <label className="block text-sm font-medium">Tel. fijo</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={contacto.telefono_fijo}
                  onChange={(e) => setContacto((c) => ({ ...c, telefono_fijo: e.target.value }))}
                />
                <div className="pt-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contacto.recibe_notificaciones_sms}
                      onChange={(e) =>
                        setContacto((c) => ({ ...c, recibe_notificaciones_sms: e.target.checked }))
                      }
                    />
                    Recibir avisos por SMS (si aplica)
                  </label>
                </div>
                <h3 className="pt-2 text-sm font-semibold text-slate-800">Domicilio</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs">Provincia *</label>
                    <select
                      required
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      value={dom.provincia_id}
                      onChange={(e) => {
                        setDom((d) => ({ ...d, provincia_id: e.target.value, localidad_id: "" }));
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {prov.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre || p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs">Localidad *</label>
                    <select
                      required
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      value={dom.localidad_id}
                      onChange={(e) => setDom((d) => ({ ...d, localidad_id: e.target.value }))}
                    >
                      <option value="">Seleccionar…</option>
                      {localidadesFiltradas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre || p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs">Calle *</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.calle}
                      onChange={(e) => setDom((d) => ({ ...d, calle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs">Número *</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.numero}
                      onChange={(e) => setDom((d) => ({ ...d, numero: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs">Código postal *</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.codigo_postal}
                      onChange={(e) => setDom((d) => ({ ...d, codigo_postal: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs">Piso</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      value={dom.piso}
                      onChange={(e) => setDom((d) => ({ ...d, piso: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs">Dpto</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      value={dom.departamento}
                      onChange={(e) => setDom((d) => ({ ...d, departamento: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs">Referencia (opcional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                    value={dom.referencia}
                    onChange={(e) => setDom((d) => ({ ...d, referencia: e.target.value }))}
                  />
                </div>
              </div>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Continuar"}
              </PrimaryButton>
            </form>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="p-5 sm:p-6">
            <form onSubmit={guardarDdjj} className="space-y-4">
              <p className="text-sm text-slate-600">Paso 2: declaración de grupo familiar (DNI, nombre, parentesco).</p>
              {famRows.map((r, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-3">
                  <div className="text-xs font-medium text-slate-500">Integrante {i + 1}</div>
                  <input
                    placeholder="Nombre y apellido *"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.nombre}
                    onChange={(e) => updateFam(i, "nombre", e.target.value)}
                    required
                  />
                  <input
                    placeholder="DNI *"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.dni}
                    onChange={(e) => updateFam(i, "dni", e.target.value.replace(/\D/g, ""))}
                    maxLength={12}
                    required
                  />
                  <label className="block text-xs">Parentesco *</label>
                  <select
                    required
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.parentesco_id}
                    onChange={(e) => updateFam(i, "parentesco_id", e.target.value)}
                  >
                    <option value="">Elegir…</option>
                    {par.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-sm text-blue-600"
                  onClick={() =>
                    setFamRows((rows) => [...rows, { nombre: "", dni: "", parentesco_id: "" }])
                  }
                >
                  + Agregar familiar
                </button>
              </div>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Enviando…" : "Continuar"}
              </PrimaryButton>
            </form>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="p-5 sm:p-6">
            <p className="text-sm text-slate-600">
              Confirmá para pasar a estado <strong>ACTIVO</strong> y destrabar el acceso a la plataforma.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <PrimaryButton type="button" onClick={finalizarMvp} disabled={saving}>
                {saving ? "Procesando…" : "Habilitar mi acceso"}
              </PrimaryButton>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
