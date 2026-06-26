import { Link } from "react-router-dom";

import { TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR } from "../../constants/solicitudesArticuloV2.js";
import { TICKETERA } from "./ticketeraUi.js";

function formatYmdEs(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatIsoEs(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function textoPlazoRestante(iso) {
  const fin = new Date(String(iso || "")).getTime();
  if (!Number.isFinite(fin)) return "";
  const ms = fin - Date.now();
  if (ms <= 0) return "El plazo ya venció.";
  const horas = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (horas >= 48) {
    const dias = Math.floor(horas / 24);
    return `Quedan aproximadamente ${dias} día${dias === 1 ? "" : "s"} para subir el certificado.`;
  }
  if (horas >= 1) return `Quedan ${horas} h ${mins} min para completar el aviso.`;
  return `Quedan ${mins} minutos para completar el aviso.`;
}

/**
 * Modal para completar aviso médico provisorio (certificado + datos de aviso completo).
 */
export default function CompletarAvisoMedicoModal({
  abierto = false,
  onCerrar,
  avisoIncompletoVigente = null,
  plazoHorasCertificado = null,
  fechaInicioReposo = "",
  setFechaInicioReposo,
  fechaFinReposo = "",
  setFechaFinReposo,
  fechaMinimaYmd = "",
  perfilContacto = { telefono_celular: "", telefono_fijo: "", domicilio_declarado: "", email: "" },
  contactoUsaPerfil = true,
  onToggleContactoUsaPerfil,
  emailUsaPerfil = true,
  onToggleEmailUsaPerfil,
  contactoEmail = "",
  setContactoEmail,
  contactoTelCelular = "",
  setContactoTelCelular,
  contactoTelFijo = "",
  setContactoTelFijo,
  contactoDomicilio = "",
  setContactoDomicilio,
  permaneceEnDomicilio = null,
  setPermaneceEnDomicilio,
  sintomas = "",
  setSintomas,
  enfermedad = "",
  setEnfermedad,
  codigoCie = "",
  setCodigoCie,
  detalleClinico = "",
  setDetalleClinico,
  archivo = null,
  onSeleccionarArchivo,
  puedeCompletar = false,
  enviando = false,
  error = "",
  onCompletar,
}) {
  if (!abierto || !avisoIncompletoVigente?.solicitud_id) return null;

  const resumen = avisoIncompletoVigente.resumen || {};
  const plazoLabel =
    plazoHorasCertificado != null && Number.isFinite(plazoHorasCertificado)
      ? String(plazoHorasCertificado)
      : "24";
  const esFamiliar = resumen.tipo_ingreso_id === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR;
  const fam = resumen.familiar_atendido;
  const fechaDesde = resumen.fecha_inicio_reposo_estimada || fechaInicioReposo;
  const vencIso = resumen.vencimiento_plazo_certificado_iso;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completar-aviso-titulo"
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h2 id="completar-aviso-titulo" className="text-lg font-semibold text-slate-900">
            Completar solicitud existente
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Subí el certificado y confirmá los datos del aviso. Ref.{" "}
            <span className="font-mono text-xs">{avisoIncompletoVigente.solicitud_id}</span>
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
            <p>
              <span className="font-medium">Reposo desde (aviso incompleto):</span>{" "}
              {formatYmdEs(fechaDesde)}
            </p>
            <p className="mt-1.5">
              <span className="font-medium">Vencimiento del plazo ({plazoLabel} h):</span>{" "}
              {formatIsoEs(vencIso)}
            </p>
            {vencIso ? <p className="mt-1 text-xs text-amber-900/90">{textoPlazoRestante(vencIso)}</p> : null}
          </div>

          {esFamiliar && fam?.nombre ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3 text-sm text-sky-950">
              <p className="font-medium">Familiar atendido</p>
              <p className="mt-1">
                {fam.apellido}, {fam.nombre} — DNI {fam.dni}
              </p>
              <Link
                to="/portal/mi-perfil#ddjj-grupo-familiar"
                className="mt-2 inline-block text-sm font-medium text-sky-800 underline"
              >
                Ver DDJJ de grupo familiar en Mi perfil
              </Link>
            </div>
          ) : null}

          <div>
            <label htmlFor="modal_fecha_inicio" className={TICKETERA.label}>
              Fecha de inicio del reposo
            </label>
            <input
              id="modal_fecha_inicio"
              type="date"
              className={`mt-1.5 ${TICKETERA.input}`}
              value={fechaInicioReposo}
              onChange={(e) => setFechaInicioReposo?.(e.target.value)}
              disabled={enviando}
            />
            <p className="mt-1 text-xs text-slate-500">
              Corresponde al aviso provisorio. Podés ajustarla si el certificado indica otra fecha de inicio.
            </p>
          </div>

          <div>
            <label htmlFor="modal_fecha_fin" className={TICKETERA.label}>
              Fecha estimada de fin del reposo <span className="text-red-600">*</span>
            </label>
            <input
              id="modal_fecha_fin"
              type="date"
              min={fechaInicioReposo || fechaMinimaYmd || undefined}
              className={`mt-1.5 ${TICKETERA.input}`}
              value={fechaFinReposo}
              onChange={(e) => setFechaFinReposo?.(e.target.value)}
              disabled={enviando}
            />
          </div>

          <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={enviando}>
            <legend className={TICKETERA.label}>Datos de contacto</legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="modal_contacto_origen"
                  checked={contactoUsaPerfil}
                  onChange={() => onToggleContactoUsaPerfil?.(true)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Los datos de mi perfil son correctos</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="modal_contacto_origen"
                  checked={!contactoUsaPerfil}
                  onChange={() => onToggleContactoUsaPerfil?.(false)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Otros datos solo para este aviso</span>
              </label>
            </div>
            {contactoUsaPerfil ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                <p>
                  <span className="font-medium">Teléfono:</span> {perfilContacto.telefono_celular || "—"}
                  {perfilContacto.telefono_fijo ? ` / ${perfilContacto.telefono_fijo}` : ""}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Domicilio:</span> {perfilContacto.domicilio_declarado || "—"}
                </p>
                <p className="mt-2">
                  <span className="font-medium">Correo:</span> {perfilContacto.email || "—"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <input
                  type="tel"
                  className={TICKETERA.input}
                  placeholder="Teléfono celular"
                  value={contactoTelCelular}
                  onChange={(e) => setContactoTelCelular?.(e.target.value)}
                />
                <input
                  type="tel"
                  className={TICKETERA.input}
                  placeholder="Teléfono fijo (opcional)"
                  value={contactoTelFijo}
                  onChange={(e) => setContactoTelFijo?.(e.target.value)}
                />
                <textarea
                  rows={2}
                  className={`${TICKETERA.input} resize-y`}
                  placeholder="Domicilio durante el aviso"
                  value={contactoDomicilio}
                  onChange={(e) => setContactoDomicilio?.(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-800">Correo electrónico</p>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="modal_email_origen"
                  checked={emailUsaPerfil}
                  onChange={() => onToggleEmailUsaPerfil?.(true)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Usar el correo de mi perfil</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="modal_email_origen"
                  checked={!emailUsaPerfil}
                  onChange={() => onToggleEmailUsaPerfil?.(false)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Otro correo para este aviso</span>
              </label>
              {!emailUsaPerfil ? (
                <input
                  type="email"
                  className={TICKETERA.input}
                  value={contactoEmail}
                  onChange={(e) => setContactoEmail?.(e.target.value)}
                />
              ) : null}
            </div>
            <div>
              <p className={`${TICKETERA.label} mb-2`}>¿Permanecerás en el domicilio declarado?</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="modal_permanece"
                    checked={permaneceEnDomicilio === true}
                    onChange={() => setPermaneceEnDomicilio?.(true)}
                    className="h-4 w-4 border-slate-300 text-sky-600"
                  />
                  Sí
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="modal_permanece"
                    checked={permaneceEnDomicilio === false}
                    onChange={() => setPermaneceEnDomicilio?.(false)}
                    className="h-4 w-4 border-slate-300 text-sky-600"
                  />
                  No
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={enviando}>
            <legend className={TICKETERA.label}>Información clínica</legend>
            <p className="text-xs text-slate-600">Al menos uno: síntomas, enfermedad o código CIE.</p>
            <textarea
              rows={2}
              className={`${TICKETERA.input} resize-y`}
              placeholder="Síntomas"
              value={sintomas}
              onChange={(e) => setSintomas?.(e.target.value)}
            />
            <input
              type="text"
              className={TICKETERA.input}
              placeholder="Enfermedad / diagnóstico presunto"
              value={enfermedad}
              onChange={(e) => setEnfermedad?.(e.target.value)}
            />
            <input
              type="text"
              className={TICKETERA.input}
              placeholder="Código CIE (opcional)"
              value={codigoCie}
              onChange={(e) => setCodigoCie?.(e.target.value)}
            />
            <textarea
              rows={2}
              className={`${TICKETERA.input} resize-y`}
              placeholder="Detalle adicional"
              value={detalleClinico}
              onChange={(e) => setDetalleClinico?.(e.target.value)}
            />
          </fieldset>

          <div>
            <label htmlFor="modal_certificado" className={TICKETERA.label}>
              Certificado médico <span className="text-red-600">*</span>
            </label>
            <input
              id="modal_certificado"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-800"
              onChange={(e) => onSeleccionarArchivo?.(e.target.files?.[0] || null)}
              disabled={enviando}
            />
            {archivo ? (
              <p className="mt-1 text-xs text-slate-600">
                {archivo.name} ({Math.round(archivo.size / 1024)} KB)
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">PDF o imagen, hasta 10 MB.</p>
            )}
          </div>

          {error ? <div className={TICKETERA.alertError}>{error}</div> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className={TICKETERA.btnSecondary}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onCompletar}
            disabled={!puedeCompletar || enviando}
            className={TICKETERA.btnPrimary}
          >
            {enviando ? "Subiendo certificado…" : "Completar aviso con certificado"}
          </button>
        </div>
      </div>
    </div>
  );
}
