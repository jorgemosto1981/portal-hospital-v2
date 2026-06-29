import { Link } from "react-router-dom";

import { TICKETERA } from "./ticketeraUi.js";

/**
 * Bloque unificado de contacto (teléfono, domicilio y correo).
 */
export default function AvisoMedicoDatosContacto({
  disabled = false,
  perfilContacto = { telefono_celular: "", telefono_fijo: "", domicilio_declarado: "", email: "" },
  contactoUsaPerfil = true,
  onElegirUsarPerfil,
  contactoTelCelular = "",
  setContactoTelCelular,
  contactoTelFijo = "",
  setContactoTelFijo,
  contactoDomicilio = "",
  setContactoDomicilio,
  contactoEmail = "",
  setContactoEmail,
  permaneceEnDomicilio = true,
  setPermaneceEnDomicilio,
  domicilioReposoAlternativo = "",
  setDomicilioReposoAlternativo,
  mostrarPermanenciaReposo = true,
  idPrefix = "",
}) {
  const p = idPrefix ? `${idPrefix}_` : "";

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <legend className={`${TICKETERA.label} !mb-0`}>Tus datos de contacto</legend>
        <Link
          to="/portal/mi-perfil"
          className="text-sm font-medium text-sky-800 underline hover:text-sky-900"
        >
          Actualizar datos
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onElegirUsarPerfil?.(true)}
          className={[
            "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
            contactoUsaPerfil
              ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-100"
              : "border-slate-200 bg-white hover:border-sky-200",
          ].join(" ")}
        >
          <span className="font-semibold text-slate-900">Usar datos de mi perfil</span>
          <span className="mt-1 block text-xs text-slate-600">Teléfono, domicilio y correo registrados.</span>
        </button>
        <button
          type="button"
          onClick={() => onElegirUsarPerfil?.(false)}
          className={[
            "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
            !contactoUsaPerfil
              ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-100"
              : "border-slate-200 bg-white hover:border-sky-200",
          ].join(" ")}
        >
          <span className="font-semibold text-slate-900">Otros datos para este trámite</span>
          <span className="mt-1 block text-xs text-slate-600">Solo aplican a este aviso.</span>
        </button>
      </div>

      {contactoUsaPerfil ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 text-sm text-slate-800">
          <p>
            <span className="font-medium">Teléfono:</span> {perfilContacto.telefono_celular || "—"}
            {perfilContacto.telefono_fijo ? ` / ${perfilContacto.telefono_fijo}` : ""}
          </p>
          <p className="mt-1.5">
            <span className="font-medium">Domicilio:</span> {perfilContacto.domicilio_declarado || "—"}
          </p>
          <p className="mt-1.5">
            <span className="font-medium">Correo:</span> {perfilContacto.email || "—"}
          </p>
          {!perfilContacto.telefono_celular || !perfilContacto.domicilio_declarado || !perfilContacto.email ? (
            <p className="mt-2 text-xs text-amber-800">
              Completá los datos faltantes con &quot;Actualizar datos&quot; o elegí otros datos para este trámite.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${p}contacto_tel_cel`} className={TICKETERA.label}>
              Teléfono celular <span className="text-red-600">*</span>
            </label>
            <input
              id={`${p}contacto_tel_cel`}
              type="tel"
              className={`mt-1 ${TICKETERA.input}`}
              value={contactoTelCelular}
              onChange={(e) => setContactoTelCelular?.(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${p}contacto_tel_fijo`} className={TICKETERA.label}>
              Teléfono fijo (opcional)
            </label>
            <input
              id={`${p}contacto_tel_fijo`}
              type="tel"
              className={`mt-1 ${TICKETERA.input}`}
              value={contactoTelFijo}
              onChange={(e) => setContactoTelFijo?.(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${p}contacto_domicilio`} className={TICKETERA.label}>
              Domicilio <span className="text-red-600">*</span>
            </label>
            <textarea
              id={`${p}contacto_domicilio`}
              rows={2}
              maxLength={512}
              className={`mt-1 ${TICKETERA.input} resize-y`}
              value={contactoDomicilio}
              onChange={(e) => setContactoDomicilio?.(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${p}contacto_email`} className={TICKETERA.label}>
              Correo electrónico <span className="text-red-600">*</span>
            </label>
            <input
              id={`${p}contacto_email`}
              type="email"
              className={`mt-1 ${TICKETERA.input}`}
              value={contactoEmail}
              onChange={(e) => setContactoEmail?.(e.target.value)}
              placeholder="nombre@ejemplo.com"
            />
          </div>
        </div>
      )}

      {mostrarPermanenciaReposo ? (
      <div className="border-t border-slate-100 pt-3">
        <p className={`${TICKETERA.label} mb-2`}>
          ¿Permanecerás en el domicilio declarado durante el reposo? <span className="text-red-600">*</span>
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`${p}permanece_domicilio`}
              checked={permaneceEnDomicilio === true}
              onChange={() => setPermaneceEnDomicilio?.(true)}
              className="h-4 w-4 border-slate-300 text-sky-600"
            />
            Sí
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`${p}permanece_domicilio`}
              checked={permaneceEnDomicilio === false}
              onChange={() => setPermaneceEnDomicilio?.(false)}
              className="h-4 w-4 border-slate-300 text-sky-600"
            />
            No
          </label>
        </div>
        {permaneceEnDomicilio === false ? (
          <div className="mt-3">
            <label htmlFor={`${p}domicilio_reposo`} className={TICKETERA.label}>
              Domicilio donde permanecerás durante el reposo <span className="text-red-600">*</span>
            </label>
            <textarea
              id={`${p}domicilio_reposo`}
              rows={2}
              maxLength={512}
              className={`mt-1 ${TICKETERA.input} resize-y`}
              value={domicilioReposoAlternativo}
              onChange={(e) => setDomicilioReposoAlternativo?.(e.target.value)}
              placeholder="Indicá calle, número, localidad…"
            />
          </div>
        ) : null}
      </div>
      ) : null}
    </fieldset>
  );
}
