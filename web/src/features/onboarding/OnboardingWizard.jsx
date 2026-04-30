import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { useOnboardingWizard } from "./hooks/useOnboardingWizard.js";

const PARENTESCO_OTROS_ID = "CFG_PAR_OTROS";

export default function OnboardingWizard() {
  const {
    user,
    personaId,
    personaNombre,
    personaApellido,
    personaDni,
    loading,
    saving,
    step,
    prov,
    par,
    contacto,
    dom,
    famRows,
    ddjjAceptada,
    ddjjStage,
    localidadesFiltradas,
    setContacto,
    setDom,
    setFamRows,
    setDdjjAceptada,
    updateFam,
    iniciarDdjjAhora,
    cerrarDdjjParaRevision,
    volverEdicionDdjj,
    quitarIntegrante,
    guardarPasoA,
    guardarDdjj,
    omitirDdjj,
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
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600">
          <p><strong>Objetivo:</strong> completar requisitos iniciales del perfil.</p>
          <p><strong>Resultado:</strong> habilitación de acceso completo al portal.</p>
          <p><strong>Cuándo usar:</strong> inmediatamente después de vincular DNI.</p>
        </div>

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
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</p>
                  <p className="mt-1 font-medium text-slate-700">{personaNombre || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Apellido</p>
                  <p className="mt-1 font-medium text-slate-700">{personaApellido || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DNI</p>
                  <p className="mt-1 font-medium text-slate-700">{personaDni || "—"}</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium">Correo de registro (solo visualización)</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                  value={contacto.email_personal}
                  readOnly
                  disabled
                />
                <p className="text-xs text-slate-500">
                  Este correo se toma del registro inicial y no se edita en onboarding.
                </p>
                <label className="block text-sm font-medium">Celular</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={contacto.telefono_celular}
                  onChange={(e) => setContacto((c) => ({ ...c, telefono_celular: e.target.value }))}
                  placeholder="Ej: 1122334455"
                  required
                />
                <p className="-mt-2 text-xs text-slate-500">
                  Obligatorio. Ingresá solo números, sin 0 ni 15 (ejemplo: 1122334455).
                </p>
                <label className="block text-sm font-medium">Teléfono fijo con característica</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={contacto.telefono_fijo}
                  onChange={(e) => setContacto((c) => ({ ...c, telefono_fijo: e.target.value }))}
                  placeholder="Ej: 1145678901"
                />
                <p className="-mt-2 text-xs text-slate-500">
                  Opcional. Ingresá característica + número, solo dígitos (ejemplo: 1145678901).
                </p>
                <div className="pt-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={contacto.recibe_notificaciones_sms}
                      onChange={(e) =>
                        setContacto((c) => ({ ...c, recibe_notificaciones_sms: e.target.checked }))
                      }
                    />
                    Recibir avisos por WhatsApp
                  </label>
                </div>
                <h3 className="pt-2 text-sm font-semibold text-slate-800">Domicilio</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs">Provincia</label>
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
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio para completar el domicilio.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs">Localidad</label>
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
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio para completar el domicilio.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs">Calle</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.calle}
                      onChange={(e) => setDom((d) => ({ ...d, calle: e.target.value }))}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  </div>
                  <div>
                    <label className="block text-xs">Número</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.numero}
                      onChange={(e) => setDom((d) => ({ ...d, numero: e.target.value }))}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  </div>
                  <div>
                    <label className="block text-xs">Código postal</label>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                      required
                      value={dom.codigo_postal}
                      onChange={(e) => setDom((d) => ({ ...d, codigo_postal: e.target.value }))}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio.</p>
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
                  <label className="block text-xs">Referencias del domicilio</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm"
                    value={dom.referencia}
                    onChange={(e) => setDom((d) => ({ ...d, referencia: e.target.value }))}
                    placeholder="Ej: Portón negro, frente a la plaza"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Opcional. Podés agregar una referencia breve para facilitar ubicación.
                  </p>
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
              <p className="text-sm text-slate-600">
                Paso 2: DDJJ de grupo familiar. Podés completarla ahora o marcar que la harás más adelante.
              </p>
              {ddjjStage === "choice" ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">Realizá tu DDJJ de familiares</p>
                    <p className="mt-1">
                      Si la realizás ahora, deberás completar todos los datos requeridos del grupo familiar.
                    </p>
                    <p className="mt-1">
                      Si la realizás después, recordá que la presentación es obligatoria y debe completarse dentro de 5
                      días.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={iniciarDdjjAhora}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Realizar DDJJ ahora
                    </button>
                    <button
                      type="button"
                      onClick={omitirDdjj}
                      disabled={saving}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {saving ? "Guardando…" : "Realizarla después"}
                    </button>
                  </div>
                </div>
              ) : ddjjStage === "edit" ? (
                <>
                  {famRows.map((r, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-3">
                  <div className="text-xs font-medium text-slate-500">Integrante {i + 1}</div>
                  <input
                    placeholder="Nombre"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.nombre}
                    onChange={(e) =>
                      updateFam(i, "nombre", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    required
                  />
                  <p className="-mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  <input
                    placeholder="Apellido"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.apellido}
                    onChange={(e) =>
                      updateFam(i, "apellido", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    required
                  />
                  <p className="-mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  <input
                    placeholder="DNI"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={r.dni}
                    onChange={(e) => updateFam(i, "dni", e.target.value.replace(/\D/g, ""))}
                    maxLength={12}
                    required
                  />
                  <p className="-mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  <div>
                    <label className="block text-xs">Fecha de nacimiento</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      value={r.fecha_nacimiento}
                      onChange={(e) => updateFam(i, "fecha_nacimiento", e.target.value)}
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  </div>
                  <label className="block text-xs">Parentesco</label>
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
                  <p className="-mt-1 text-[11px] text-slate-500">Obligatorio.</p>
                  {String(r.parentesco_id || "").toUpperCase() === PARENTESCO_OTROS_ID ? (
                    <div>
                      <label className="block text-xs">
                        Detallar y presentar la documentación correspondiente ante Salud Laboral para su evaluación
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={r.parentesco_otro_detalle || ""}
                        onChange={(e) => updateFam(i, "parentesco_otro_detalle", e.target.value)}
                        placeholder="Detalle del parentesco (Otros)"
                        required
                      />
                      <p className="mt-1 text-[11px] text-slate-500">Obligatorio cuando seleccionás “Otros”.</p>
                    </div>
                  ) : null}
                  <div className="space-y-3 pt-1 text-xs text-slate-700">
                    <div className="space-y-1">
                      <p className="font-medium">Conviven en el mismo domicilio</p>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`convive-${i}`}
                            checked={r.convive === true}
                            onChange={() => updateFam(i, "convive", true)}
                          />
                          Si
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`convive-${i}`}
                            checked={r.convive === false}
                            onChange={() => updateFam(i, "convive", false)}
                          />
                          No
                        </label>
                      </div>
                    </div>
                    {r.convive === false ? (
                      <div>
                        <label className="block text-xs">Domicilio del familiar</label>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={r.domicilio_familiar || ""}
                          onChange={(e) => updateFam(i, "domicilio_familiar", e.target.value)}
                          placeholder="Calle, número, localidad"
                          required
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Obligatorio cuando no conviven en el mismo domicilio.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="font-medium">Dependiente</p>
                      <p className="text-[11px] text-slate-500">
                        Indica si el familiar depende económicamente del titular.
                      </p>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`dependiente-${i}`}
                            checked={r.dependiente === true}
                            onChange={() => updateFam(i, "dependiente", true)}
                          />
                          Si
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`dependiente-${i}`}
                            checked={r.dependiente === false}
                            onChange={() => updateFam(i, "dependiente", false)}
                          />
                          No
                        </label>
                      </div>
                    </div>
                    {r.dependiente === true ? (
                      <div>
                        <label className="block text-xs">Detalle de dependencia</label>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={r.detalle_dependencia || ""}
                          onChange={(e) => updateFam(i, "detalle_dependencia", e.target.value)}
                          placeholder="Ej: sin ingresos propios"
                          required
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Obligatorio cuando indicás dependencia.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="font-medium">Discapacidad declarada</p>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`discapacidad-${i}`}
                            checked={r.discapacidad_declarada === true}
                            onChange={() => updateFam(i, "discapacidad_declarada", true)}
                          />
                          Si
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`discapacidad-${i}`}
                            checked={r.discapacidad_declarada === false}
                            onChange={() => updateFam(i, "discapacidad_declarada", false)}
                          />
                          No
                        </label>
                      </div>
                      {r.discapacidad_declarada === true ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                          Para validación final debés presentar CUD en la oficina correspondiente.
                        </p>
                      ) : null}
                    </div>
                  </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFamRows((rows) => [
                          ...rows,
                          {
                            nombre: "",
                            apellido: "",
                            dni: "",
                            fecha_nacimiento: "",
                            parentesco_id: "",
                            parentesco_otro_detalle: "",
                            convive: true,
                            dependiente: false,
                            discapacidad_declarada: false,
                            domicilio_familiar: "",
                            detalle_dependencia: "",
                          },
                        ])
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      Agregar otro integrante
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={cerrarDdjjParaRevision}
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Cerrar DDJJ y revisar
                    </button>
                    <button
                      type="button"
                      onClick={omitirDdjj}
                      disabled={saving}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {saving ? "Guardando…" : "Completar más adelante"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Resumen DDJJ</p>
                    <p className="text-xs text-slate-600">
                      Revisá la información antes de presentar para evaluación de Salud Laboral.
                    </p>
                  </div>
                  {famRows
                    .filter(
                      (r) =>
                        (r.nombre || "").trim() ||
                        (r.apellido || "").trim() ||
                        (r.dni || "").trim() ||
                        (r.fecha_nacimiento || "").trim() ||
                        (r.parentesco_id || "").trim(),
                    )
                    .map((r, i) => (
                      <div key={`resumen-${i}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <p className="font-semibold text-slate-700">Integrante {i + 1}</p>
                        <p>
                          Nombre: {r.nombre || "—"} {r.apellido || ""}
                        </p>
                        <p>DNI: {r.dni || "—"}</p>
                        <p>Fecha nacimiento: {r.fecha_nacimiento || "—"}</p>
                        <p>Parentesco: {r.parentesco_id || "—"}</p>
                        {r.parentesco_otro_detalle ? <p>Detalle parentesco (Otros): {r.parentesco_otro_detalle}</p> : null}
                        <p>Convive: {r.convive === true ? "Si" : "No"}</p>
                        {r.convive === false ? <p>Domicilio familiar: {r.domicilio_familiar || "—"}</p> : null}
                        <p>Dependiente: {r.dependiente === true ? "Si" : "No"}</p>
                        {r.dependiente === true ? <p>Detalle dependencia: {r.detalle_dependencia || "—"}</p> : null}
                        <p>Discapacidad declarada: {r.discapacidad_declarada === true ? "Si" : "No"}</p>
                      </div>
                    ))}
                  <label className="inline-flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={ddjjAceptada === true}
                      onChange={(e) => setDdjjAceptada(e.target.checked)}
                      className="mt-0.5"
                      required
                    />
                    Declaro bajo juramento que la información del grupo familiar es veraz.
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={volverEdicionDdjj}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Volver a editar
                    </button>
                    <PrimaryButton type="submit" disabled={saving}>
                      {saving ? "Presentando…" : "PRESENTAR para evaluación de Salud Laboral"}
                    </PrimaryButton>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Quitar integrante del resumen</p>
                    <div className="flex flex-wrap gap-2">
                      {famRows
                        .filter(
                          (r) =>
                            (r.nombre || "").trim() ||
                            (r.apellido || "").trim() ||
                            (r.dni || "").trim() ||
                            (r.fecha_nacimiento || "").trim() ||
                            (r.parentesco_id || "").trim(),
                        )
                        .map((r, i) => (
                          <button
                            key={`rm-${i}`}
                            type="button"
                            onClick={() => quitarIntegrante(i)}
                            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                          >
                            Quitar {r.nombre || "integrante"} {i + 1}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
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
