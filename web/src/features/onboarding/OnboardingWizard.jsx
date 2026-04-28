import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { useOnboardingWizard } from "./hooks/useOnboardingWizard.js";

export default function OnboardingWizard() {
  const {
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
  } = useOnboardingWizard();

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
