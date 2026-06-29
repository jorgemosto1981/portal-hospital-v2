import { Link } from "react-router-dom";

import { TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR } from "../../constants/solicitudesArticuloV2.js";
import AvisoMedicoDatosContacto from "./AvisoMedicoDatosContacto.jsx";
import { TICKETERA } from "./ticketeraUi.js";

import {
  formatVencimientoProvisorioEs,
  formatYmdEs,
} from "./avisoMedicoProvisorioUi.js";

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
  fechaFinReposo = "",
  setFechaFinReposo,
  fechaMinimaYmd = "",
  perfilContacto = { telefono_celular: "", telefono_fijo: "", domicilio_declarado: "", email: "" },
  contactoUsaPerfil = true,
  onToggleContactoUsaPerfil,
  contactoEmail = "",
  setContactoEmail,
  contactoTelCelular = "",
  setContactoTelCelular,
  contactoTelFijo = "",
  setContactoTelFijo,
  contactoDomicilio = "",
  setContactoDomicilio,
  permaneceEnDomicilio = true,
  setPermaneceEnDomicilio,
  domicilioReposoAlternativo = "",
  setDomicilioReposoAlternativo,
  detalleClinicoPrincipal = "",
  setDetalleClinicoPrincipal,
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
          <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 text-sm text-slate-800">
            <p>
              <span className="font-medium">Fecha de inicio de la licencia:</span> {formatYmdEs(fechaDesde)}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Este dato corresponde al aviso provisorio y no se puede modificar al completar el certificado.
            </p>
            {vencIso ? (
              <p className="mt-2">
                <span className="font-medium">Vencimiento del plazo:</span> {formatVencimientoProvisorioEs(vencIso)}
              </p>
            ) : null}
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
            <label htmlFor="modal_fecha_fin" className={TICKETERA.label}>
              Fecha de fin de licencia <span className="text-red-600">*</span>
            </label>
            <input
              id="modal_fecha_fin"
              type="date"
              min={fechaDesde || fechaMinimaYmd || undefined}
              className={`mt-1.5 ${TICKETERA.input}`}
              value={fechaFinReposo}
              onChange={(e) => setFechaFinReposo?.(e.target.value)}
              disabled={enviando}
            />
          </div>

          <AvisoMedicoDatosContacto
            disabled={enviando}
            perfilContacto={perfilContacto}
            contactoUsaPerfil={contactoUsaPerfil}
            onElegirUsarPerfil={onToggleContactoUsaPerfil}
            contactoTelCelular={contactoTelCelular}
            setContactoTelCelular={setContactoTelCelular}
            contactoTelFijo={contactoTelFijo}
            setContactoTelFijo={setContactoTelFijo}
            contactoDomicilio={contactoDomicilio}
            setContactoDomicilio={setContactoDomicilio}
            contactoEmail={contactoEmail}
            setContactoEmail={setContactoEmail}
            permaneceEnDomicilio={permaneceEnDomicilio}
            setPermaneceEnDomicilio={setPermaneceEnDomicilio}
            domicilioReposoAlternativo={domicilioReposoAlternativo}
            setDomicilioReposoAlternativo={setDomicilioReposoAlternativo}
            idPrefix="modal"
          />

          <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={enviando}>
            <legend className={TICKETERA.label}>Información clínica</legend>
            <div>
              <label htmlFor="modal_detalle_clinico_principal" className={TICKETERA.label}>
                Detallar Síntomas / Enfermedad / CIE <span className="text-red-600">*</span>
              </label>
              <textarea
                id="modal_detalle_clinico_principal"
                rows={3}
                maxLength={2000}
                className={`mt-1 ${TICKETERA.input} resize-y`}
                value={detalleClinicoPrincipal}
                onChange={(e) => setDetalleClinicoPrincipal?.(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="modal_detalle_clinico" className={TICKETERA.label}>
                Detallar tratamiento indicado, medicación y/o toda información complementaria (opcional)
              </label>
              <textarea
                id="modal_detalle_clinico"
                rows={2}
                maxLength={2000}
                className={`mt-1 ${TICKETERA.input} resize-y`}
                value={detalleClinico}
                onChange={(e) => setDetalleClinico?.(e.target.value)}
              />
            </div>
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
