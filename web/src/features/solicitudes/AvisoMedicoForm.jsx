import { Link } from "react-router-dom";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
import CompletarAvisoMedicoModal from "./CompletarAvisoMedicoModal.jsx";
import AvisoMedicoDatosContacto from "./AvisoMedicoDatosContacto.jsx";
import { textoExitoAvisoProvisorio, textoInformativoPlazoCertificado } from "./avisoMedicoPlazoUi.js";
import {
  etiquetaTipoAvisoMedico,
  formatVencimientoProvisorioEs,
  formatYmdEs,
} from "./avisoMedicoProvisorioUi.js";
import { TICKETERA } from "./ticketeraUi.js";

const OPCIONES_MODO_ALTA = [
  {
    id: "con_certificado",
    titulo: "Tengo certificado médico",
    subtitulo: "Adjuntá el documento y completá el aviso en un solo paso.",
  },
  {
    id: "sin_certificado",
    titulo: "Aún no tengo certificado",
    subtitulo: "Registrá un aviso provisorio y subí el certificado después (mismo trámite).",
  },
];

function etiquetasGruposTrabajoVigentes(grupos) {
  return (grupos || [])
    .map((g) => String(g.etiqueta_ui || g.nombre || g.grupo_de_trabajo_id || "").trim())
    .filter(Boolean);
}

const OPCIONES_TIPO = [
  {
    id: TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
    titulo: "Es para mí",
    subtitulo: "Enfermedad propia",
  },
  {
    id: TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
    titulo: "Familiar enfermo",
    subtitulo: "Atención de familiar",
  },
];

/**
 * Wizard simple — aviso médico Caja Negra (sin motor en cliente).
 */
export default function AvisoMedicoForm({
  claimsLoading = false,
  personaId = "",
  tipoIngresoId,
  setTipoIngresoId,
  fechaInicioReposo,
  setFechaInicioReposo,
  fechaFinReposo = "",
  setFechaFinReposo,
  setFechaFinReposoCompletar,
  fechaMinimaYmd = "",
  modoAlta = null,
  setModoAlta,
  aceptoPlazoProvisorio = false,
  setAceptoPlazoProvisorio,
  detalleClinicoPrincipal = "",
  setDetalleClinicoPrincipal,
  detalleClinico = "",
  setDetalleClinico,
  domicilioReposoAlternativo = "",
  setDomicilioReposoAlternativo,
  plazoHorasCertificado = null,
  avisosProvisoriosVigentes = [],
  permiteNuevoProvisorio = true,
  maxProvisoriosVigentes = 2,
  tieneProvisoriosPendientes = false,
  avisoCompletarActivo = null,
  buscandoAvisoPendiente = false,
  completarModalAbierto = false,
  onAbrirCompletarModal,
  onCerrarCompletarModal,
  archivoCompletar = null,
  onSeleccionarArchivoCompletar,
  puedeCompletar = false,
  enviandoCompletar = false,
  errorCompletar = "",
  onCompletarAviso,
  archivo,
  onSeleccionarArchivo,
  gruposVigentes = [],
  gruposCargando = false,
  gruposError = "",
  perfilCargando = false,
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
  ddjjCargando = false,
  ddjjDisponible = null,
  familiaresOpciones = [],
  familiarAtendidoId = "",
  setFamiliarAtendidoId,
  puedeEnviar = false,
  enviando = false,
  error = "",
  exito = null,
  onEnviar,
  onReiniciar,
}) {
  const plazoHoras =
    plazoHorasCertificado != null && Number.isFinite(plazoHorasCertificado)
      ? plazoHorasCertificado
      : null;

  if (exito?.solicitud_id) {
    const provisorio = exito.provisorio === true;
    const textoPlazo = provisorio
      ? textoExitoAvisoProvisorio(
          plazoHoras,
          exito.fechaInicioLicenciaYmd || fechaInicioReposo,
        )
      : null;
    return (
      <div className="space-y-4">
        <div className={TICKETERA.confirmCard}>
          <h2 className="text-lg font-semibold text-emerald-950">
            {provisorio ? "Aviso provisorio registrado" : "Tu aviso fue recibido"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900/90">
            {provisorio ? textoPlazo : (
              <>
                El Médico Auditor revisará tu solicitud de licencia y se registrarán las novedades en este Portal
                Digital. Podés consultar siempre el estado de tu solicitud.
              </>
            )}
          </p>
          <p className="mt-3 font-mono text-xs text-emerald-800/80">Ref. {exito.solicitud_id}</p>
        </div>
        <Link to="/portal/solicitudes" className={`block text-center ${TICKETERA.btnSecondary}`}>
          Volver a solicitudes
        </Link>
        {!provisorio ? (
          <button type="button" onClick={onReiniciar} className={TICKETERA.btnSecondary}>
            Cargar otro aviso
          </button>
        ) : null}
      </div>
    );
  }

  const sinPersona = !claimsLoading && !/^per_/i.test(personaId);
  const requierePeriodoCompleto = modoAlta === "con_certificado";
  const ocultarCertificado = modoAlta === "sin_certificado";
  const mostrarFormulario = modoAlta != null;
  const botonLabel = modoAlta === "sin_certificado"
    ? enviando
      ? "Registrando aviso…"
      : "Registrar aviso provisorio"
    : enviando
      ? "Enviando aviso…"
      : "Enviar aviso";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Aviso de licencia médica</h1>
        <p className={`mt-1 ${TICKETERA.hubIntro}`}>
          {tieneProvisoriosPendientes
            ? `Tenés ${avisosProvisoriosVigentes.length} aviso${avisosProvisoriosVigentes.length === 1 ? "" : "s"} provisorio${avisosProvisoriosVigentes.length === 1 ? "" : "s"} pendiente${avisosProvisoriosVigentes.length === 1 ? "" : "s"} de certificado. Podés registrar hasta ${maxProvisoriosVigentes} en paralelo si las fechas no se superponen.`
            : "Elegí si tenés certificado o registrá un aviso provisorio. Un médico auditor clasificará tu caso."}
        </p>
      </header>

      {buscandoAvisoPendiente ? (
        <p className={`text-sm ${TICKETERA.muted}`}>Verificando avisos pendientes…</p>
      ) : null}

      {tieneProvisoriosPendientes ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-950">Avisos provisorios vigentes</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {avisosProvisoriosVigentes.map((aviso) => {
              const resumen = aviso.resumen || {};
              const desde = resumen.fecha_inicio_reposo_estimada;
              const vencIso = resumen.vencimiento_plazo_certificado_iso;
              return (
                <div
                  key={aviso.solicitud_id}
                  className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
                >
                  <p className="font-semibold text-amber-950">{etiquetaTipoAvisoMedico(resumen.tipo_ingreso_id)}</p>
                  <p className="mt-2">
                    <span className="font-medium">Desde:</span> {formatYmdEs(desde)}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Vencimiento del plazo:</span>{" "}
                    {formatVencimientoProvisorioEs(vencIso)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-amber-900/70">{aviso.solicitud_id}</p>
                  <button
                    type="button"
                    onClick={() => onAbrirCompletarModal?.(aviso)}
                    className={`mt-3 ${TICKETERA.btnPrimary}`}
                  >
                    Completar con certificado
                  </button>
                </div>
              );
            })}
          </div>
          {!permiteNuevoProvisorio ? (
            <p className="text-sm text-amber-900">
              Ya alcanzaste el máximo de {maxProvisoriosVigentes} avisos provisorios vigentes. Completá uno para
              registrar otro.
            </p>
          ) : null}
        </div>
      ) : null}

      {sinPersona ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
      ) : null}

      {!sinPersona && modoAlta == null ? (
        <fieldset className={`${TICKETERA.card} ${TICKETERA.cardPad}`} disabled={enviando}>
          <legend className={TICKETERA.label}>¿Cómo querés registrar el aviso?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {OPCIONES_MODO_ALTA.map((op) => {
              const deshabilitado = op.id === "sin_certificado" && !permiteNuevoProvisorio;
              return (
              <button
                key={op.id}
                type="button"
                disabled={deshabilitado}
                onClick={() => setModoAlta?.(op.id)}
                className={[
                  "flex flex-col rounded-xl border px-3 py-4 text-left text-sm transition-colors",
                  deshabilitado
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50",
                ].join(" ")}
              >
                <span className="font-semibold text-slate-900">{op.titulo}</span>
                <span className="mt-1 text-xs text-slate-600">{op.subtitulo}</span>
                {deshabilitado ? (
                  <span className="mt-2 text-xs text-amber-800">Máximo de avisos provisorios vigentes alcanzado.</span>
                ) : null}
              </button>
            );
            })}
          </div>
        </fieldset>
      ) : null}

      {mostrarFormulario ? (
        <fieldset className={`${TICKETERA.card} ${TICKETERA.cardPad}`} disabled={sinPersona || enviando}>
          <legend className={TICKETERA.label}>¿De qué se trata?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {OPCIONES_TIPO.map((op) => {
              const sel = tipoIngresoId === op.id;
              return (
                <label
                  key={op.id}
                  className={[
                    "flex cursor-pointer flex-col rounded-xl border px-3 py-3 transition-colors",
                    sel ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-100" : "border-slate-200 bg-white hover:border-sky-200",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo_ingreso_medico"
                      value={op.id}
                      checked={sel}
                      onChange={() => setTipoIngresoId(op.id)}
                      className="h-4 w-4 border-slate-300 text-sky-600"
                    />
                    <span className="text-sm font-semibold text-slate-900">{op.titulo}</span>
                  </span>
                  <span className="mt-1 pl-6 text-xs text-slate-600">{op.subtitulo}</span>
                </label>
              );
            })}
          </div>

          {tipoIngresoId === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className={TICKETERA.label}>Familiar a atender</p>
              {ddjjCargando || perfilCargando ? (
                <p className={`mt-2 text-sm ${TICKETERA.muted}`}>Cargando tu DDJJ de grupo familiar…</p>
              ) : null}
              {!ddjjCargando && !ddjjDisponible ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950">
                  <p>Necesitás tener cargada la DDJJ de grupo familiar (en cualquier estado de revisión).</p>
                  <Link to="/portal/mi-perfil" className="mt-2 inline-block font-medium text-sky-800 underline">
                    Ir a Mi perfil → DDJJ familiares
                  </Link>
                </div>
              ) : null}
              {ddjjDisponible && familiaresOpciones.length > 0 ? (
                <select
                  className={`mt-2 ${TICKETERA.select}`}
                  value={familiarAtendidoId}
                  onChange={(e) => setFamiliarAtendidoId(e.target.value)}
                  disabled={sinPersona || enviando}
                >
                  <option value="">Seleccioná el familiar…</option>
                  {familiaresOpciones.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {ddjjDisponible && familiaresOpciones.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800">
                  Tu DDJJ no tiene familiares con datos completos. Actualizala en{" "}
                  <Link to="/portal/mi-perfil" className="font-medium text-sky-800 underline">
                    Mi perfil
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {mostrarFormulario ? (
      <>
      <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <p className="text-sm text-slate-700">
            Modalidad:{" "}
            <span className="font-medium text-slate-900">
              {modoAlta === "sin_certificado" ? "Aviso provisorio" : "Con certificado"}
            </span>
          </p>
          <button
            type="button"
            className="text-sm font-medium text-sky-800 underline"
            onClick={() => setModoAlta?.(null)}
            disabled={enviando}
          >
            Cambiar opción
          </button>
        </div>
        <div>
          <label htmlFor="fecha_inicio_reposo" className={TICKETERA.label}>
            Fecha de inicio de la licencia <span className="text-red-600">*</span>
          </label>
          <input
            id="fecha_inicio_reposo"
            type="date"
            min={fechaMinimaYmd || undefined}
            className={`mt-1.5 ${TICKETERA.input}`}
            value={fechaInicioReposo}
            onChange={(e) => setFechaInicioReposo(e.target.value)}
            disabled={sinPersona || enviando}
          />
          <p className="mt-1 text-xs text-slate-500">No podés elegir una fecha anterior a hoy.</p>
        </div>

        {requierePeriodoCompleto ? (
          <div>
            <label htmlFor="fecha_fin_reposo" className={TICKETERA.label}>
              Fecha de fin de licencia <span className="text-red-600">*</span>
            </label>
            <input
              id="fecha_fin_reposo"
              type="date"
              min={fechaInicioReposo || fechaMinimaYmd || undefined}
              className={`mt-1.5 ${TICKETERA.input}`}
              value={fechaFinReposo}
              onChange={(e) => setFechaFinReposo(e.target.value)}
              disabled={sinPersona || enviando}
            />
          </div>
        ) : null}

        <AvisoMedicoDatosContacto
          disabled={sinPersona || enviando}
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
          mostrarPermanenciaReposo={modoAlta !== "sin_certificado"}
        />

        <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={sinPersona || enviando}>
          <legend className={TICKETERA.label}>Información clínica</legend>
          <div>
            <label htmlFor="detalle_clinico_principal" className={TICKETERA.label}>
              Detallar Síntomas / Enfermedad / CIE <span className="text-red-600">*</span>
            </label>
            <textarea
              id="detalle_clinico_principal"
              rows={3}
              maxLength={2000}
              className={`mt-1 ${TICKETERA.input} resize-y`}
              value={detalleClinicoPrincipal}
              onChange={(e) => setDetalleClinicoPrincipal(e.target.value)}
              placeholder="Síntomas, diagnóstico presunto o código CIE si lo conocés."
            />
          </div>
          {modoAlta !== "sin_certificado" ? (
          <div>
            <label htmlFor="detalle_clinico" className={TICKETERA.label}>
              {modoAlta === "con_certificado"
                ? "Detallar tratamiento indicado, medicación y/o toda información complementaria (opcional)"
                : "Detalles adicionales (opcional)"}
            </label>
            <textarea
              id="detalle_clinico"
              rows={2}
              maxLength={2000}
              className={`mt-1 ${TICKETERA.input} resize-y`}
              value={detalleClinico}
              onChange={(e) => setDetalleClinico(e.target.value)}
            />
          </div>
          ) : null}
        </fieldset>

        {gruposCargando ? <p className={TICKETERA.muted}>Cargando tus grupos de trabajo…</p> : null}
        {gruposError ? <p className="text-sm text-red-700">{gruposError}</p> : null}

        {!gruposCargando && gruposVigentes.length > 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-800">
            <p className={TICKETERA.label}>Tus grupos de trabajo actuales</p>
            <p className="mt-1 text-xs text-slate-600">
              La licencia se registra sobre tu persona y puede impactar en todos tus sectores. No tenés que
              elegir un grupo para este trámite.
            </p>
            <p className="mt-2 font-medium text-slate-900">
              {etiquetasGruposTrabajoVigentes(gruposVigentes).join(" · ") || "—"}
            </p>
          </div>
        ) : null}

        {!gruposCargando && gruposVigentes.length === 0 && !gruposError ? (
          <p className="text-sm text-amber-800">
            No encontramos grupos de trabajo vigentes para la fecha elegida. Revisá tu situación laboral con
            RRHH antes de continuar.
          </p>
        ) : null}

        {modoAlta === "sin_certificado" ? (
          <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-3 text-sm text-sky-950">
            <p>{textoInformativoPlazoCertificado(plazoHoras, fechaInicioReposo)}</p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                checked={aceptoPlazoProvisorio}
                onChange={(e) => setAceptoPlazoProvisorio?.(e.target.checked)}
                disabled={sinPersona || enviando}
              />
              <span className="font-medium">Comprendo y acepto</span>
            </label>
          </div>
        ) : null}
        {!ocultarCertificado ? (
          <div>
            <label htmlFor="certificado_medico" className={TICKETERA.label}>
              Certificado médico <span className="text-red-600">*</span>
            </label>
            <input
              id="certificado_medico"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className={`mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-800`}
              onChange={(e) => onSeleccionarArchivo(e.target.files?.[0] || null)}
              disabled={sinPersona || enviando}
            />
            {archivo ? (
              <p className="mt-1 text-xs text-slate-600">
                Archivo: {archivo.name} ({Math.round(archivo.size / 1024)} KB)
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">PDF o imagen, hasta 10 MB.</p>
            )}
          </div>
        ) : null}
      </div>
      {error ? <div className={TICKETERA.alertError}>{error}</div> : null}

      <button
        type="button"
        onClick={onEnviar}
        disabled={!puedeEnviar || enviando || sinPersona}
        className={TICKETERA.btnPrimary}
      >
        {botonLabel}
      </button>
      {!ocultarCertificado && !archivo && !sinPersona && modoAlta === "con_certificado" ? (
        <p className="text-center text-xs text-slate-500">Adjuntá el certificado para habilitar el envío.</p>
      ) : null}
      </>
      ) : null}

      <CompletarAvisoMedicoModal
        abierto={completarModalAbierto}
        onCerrar={onCerrarCompletarModal}
        avisoIncompletoVigente={avisoCompletarActivo}
        plazoHorasCertificado={plazoHorasCertificado}
        fechaInicioReposo={avisoCompletarActivo?.resumen?.fecha_inicio_reposo_estimada || ""}
        fechaFinReposo={fechaFinReposo}
        setFechaFinReposo={setFechaFinReposoCompletar}
        fechaMinimaYmd={fechaMinimaYmd}
        perfilContacto={perfilContacto}
        contactoUsaPerfil={contactoUsaPerfil}
        onToggleContactoUsaPerfil={onToggleContactoUsaPerfil}
        contactoEmail={contactoEmail}
        setContactoEmail={setContactoEmail}
        contactoTelCelular={contactoTelCelular}
        setContactoTelCelular={setContactoTelCelular}
        contactoTelFijo={contactoTelFijo}
        setContactoTelFijo={setContactoTelFijo}
        contactoDomicilio={contactoDomicilio}
        setContactoDomicilio={setContactoDomicilio}
        permaneceEnDomicilio={permaneceEnDomicilio}
        setPermaneceEnDomicilio={setPermaneceEnDomicilio}
        domicilioReposoAlternativo={domicilioReposoAlternativo}
        setDomicilioReposoAlternativo={setDomicilioReposoAlternativo}
        detalleClinicoPrincipal={detalleClinicoPrincipal}
        setDetalleClinicoPrincipal={setDetalleClinicoPrincipal}
        detalleClinico={detalleClinico}
        setDetalleClinico={setDetalleClinico}
        archivo={archivoCompletar}
        onSeleccionarArchivo={onSeleccionarArchivoCompletar}
        puedeCompletar={puedeCompletar}
        enviando={enviandoCompletar}
        error={errorCompletar}
        onCompletar={onCompletarAviso}
      />
    </div>
  );
}
