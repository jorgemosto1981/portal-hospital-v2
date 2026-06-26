import { Link } from "react-router-dom";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
import CompletarAvisoMedicoModal from "./CompletarAvisoMedicoModal.jsx";
import { TICKETERA } from "./ticketeraUi.js";

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
  setFechaInicioReposoCompletar,
  setFechaFinReposoCompletar,
  emailUsaPerfil = true,
  onToggleEmailUsaPerfil,
  contactoEmail = "",
  setContactoEmail,
  sintomas = "",
  setSintomas,
  enfermedad = "",
  setEnfermedad,
  codigoCie = "",
  setCodigoCie,
  detalleClinico = "",
  setDetalleClinico,
  fechaMinimaYmd = "",
  comentarioAgente,
  setComentarioAgente,
  esLicenciaIncompleta = false,
  onToggleLicenciaIncompleta,
  plazoHorasCertificado = null,
  bloqueadoPorIncompleta = false,
  avisoIncompletoVigente = null,
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
  grupoAnclaId,
  setGrupoAnclaId,
  requiereSeleccionGrupo = false,
  gruposCargando = false,
  gruposError = "",
  perfilCargando = false,
  perfilContacto = { telefono_celular: "", telefono_fijo: "", domicilio_declarado: "" },
  contactoUsaPerfil = true,
  onToggleContactoUsaPerfil,
  contactoTelCelular = "",
  setContactoTelCelular,
  contactoTelFijo = "",
  setContactoTelFijo,
  contactoDomicilio = "",
  setContactoDomicilio,
  permaneceEnDomicilio = null,
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
  const plazoLabel =
    plazoHorasCertificado != null && Number.isFinite(plazoHorasCertificado)
      ? String(plazoHorasCertificado)
      : "24";

  if (exito?.solicitud_id) {
    const provisorio = exito.provisorio === true;
    return (
      <div className="space-y-4">
        <div className={TICKETERA.confirmCard}>
          <h2 className="text-lg font-semibold text-emerald-950">
            {provisorio ? "Aviso provisorio registrado" : "Tu aviso fue recibido"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900/90">
            {provisorio ? (
              <>
                Tenés <strong>{plazoLabel} horas</strong> para subir el certificado médico sobre el mismo
                trámite. Si vence el plazo sin certificado, el aviso puede invalidarse automáticamente.
              </>
            ) : (
              <>
                Medicina laboral revisará tu certificado y te notificará cuando haya novedades. No
                necesitás elegir artículo ni tramos de sueldo en este paso.
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
  const requierePeriodoCompleto = !esLicenciaIncompleta;
  const ocultarCertificado = esLicenciaIncompleta;
  const botonLabel = esLicenciaIncompleta
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
          {bloqueadoPorIncompleta
            ? "Tenés un aviso provisorio pendiente de certificado. Completalo antes de cargar uno nuevo."
            : "Contanos si el reposo es para vos o para un familiar y adjuntá el certificado. Un médico auditor clasificará tu caso."}
        </p>
      </header>

      {buscandoAvisoPendiente ? (
        <p className={`text-sm ${TICKETERA.muted}`}>Verificando avisos pendientes…</p>
      ) : null}

      {bloqueadoPorIncompleta && avisoIncompletoVigente?.solicitud_id ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Completar solicitud existente</p>
          <p className="mt-1 text-amber-900/90">
            Tenés un aviso sin certificado vigente (ref.{" "}
            <span className="font-mono text-xs">{avisoIncompletoVigente.solicitud_id}</span>). Subí el
            documento dentro de las <strong>{plazoLabel} horas</strong> desde el aviso provisorio.
          </p>
          <button
            type="button"
            onClick={onAbrirCompletarModal}
            className={`mt-3 ${TICKETERA.btnPrimary}`}
          >
            Completar solicitud existente
          </button>
        </div>
      ) : null}

      {sinPersona ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
      ) : null}

      {!bloqueadoPorIncompleta ? (
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

      {!bloqueadoPorIncompleta ? (
      <>
      <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
        <div>
          <label htmlFor="fecha_inicio_reposo" className={TICKETERA.label}>
            Fecha estimada de inicio del reposo
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
              Fecha estimada de fin del reposo
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

        <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={sinPersona || enviando}>
            <legend className={TICKETERA.label}>Datos de contacto para este aviso</legend>
            <p className="text-xs text-slate-600">
              Confirmá si tu teléfono y domicilio del perfil están actualizados, o informá otros datos solo para
              este trámite.
            </p>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="contacto_origen"
                  checked={contactoUsaPerfil}
                  onChange={() => onToggleContactoUsaPerfil?.(true)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Los datos de mi perfil son correctos</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="contacto_origen"
                  checked={!contactoUsaPerfil}
                  onChange={() => onToggleContactoUsaPerfil?.(false)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Quiero usar otros datos solo para este aviso</span>
              </label>
            </div>

            {contactoUsaPerfil ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                <p>
                  <span className="font-medium">Teléfono:</span>{" "}
                  {perfilContacto.telefono_celular || "—"}
                  {perfilContacto.telefono_fijo ? ` / ${perfilContacto.telefono_fijo}` : ""}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Domicilio:</span> {perfilContacto.domicilio_declarado || "—"}
                </p>
                {!perfilContacto.telefono_celular || !perfilContacto.domicilio_declarado ? (
                  <p className="mt-2 text-xs text-amber-800">
                    Completá teléfono y domicilio en{" "}
                    <Link to="/portal/mi-perfil" className="underline">
                      Mi perfil
                    </Link>{" "}
                    o elegí “otros datos para este aviso”.
                  </p>
                ) : null}
                <p className="mt-2">
                  <span className="font-medium">Correo:</span> {perfilContacto.email || "—"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="contacto_tel_cel" className={TICKETERA.label}>
                    Teléfono celular
                  </label>
                  <input
                    id="contacto_tel_cel"
                    type="tel"
                    className={`mt-1 ${TICKETERA.input}`}
                    value={contactoTelCelular}
                    onChange={(e) => setContactoTelCelular(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="contacto_tel_fijo" className={TICKETERA.label}>
                    Teléfono fijo (opcional)
                  </label>
                  <input
                    id="contacto_tel_fijo"
                    type="tel"
                    className={`mt-1 ${TICKETERA.input}`}
                    value={contactoTelFijo}
                    onChange={(e) => setContactoTelFijo(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="contacto_domicilio" className={TICKETERA.label}>
                    Domicilio durante el aviso
                  </label>
                  <textarea
                    id="contacto_domicilio"
                    rows={2}
                    maxLength={512}
                    className={`mt-1 ${TICKETERA.input} resize-y`}
                    value={contactoDomicilio}
                    onChange={(e) => setContactoDomicilio(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-800">Correo electrónico</p>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="email_origen"
                  checked={emailUsaPerfil}
                  onChange={() => onToggleEmailUsaPerfil?.(true)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Usar el correo de mi perfil</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="email_origen"
                  checked={!emailUsaPerfil}
                  onChange={() => onToggleEmailUsaPerfil?.(false)}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-sky-600"
                />
                <span>Otro correo solo para este aviso</span>
              </label>
              {!emailUsaPerfil ? (
                <input
                  type="email"
                  className={TICKETERA.input}
                  value={contactoEmail}
                  onChange={(e) => setContactoEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                />
              ) : null}
            </div>

            <div>
              <p className={`${TICKETERA.label} mb-2`}>¿Permanecerás en el domicilio declarado durante el reposo?</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="permanece_domicilio"
                    checked={permaneceEnDomicilio === true}
                    onChange={() => setPermaneceEnDomicilio?.(true)}
                    className="h-4 w-4 border-slate-300 text-sky-600"
                  />
                  Sí
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="permanece_domicilio"
                    checked={permaneceEnDomicilio === false}
                    onChange={() => setPermaneceEnDomicilio?.(false)}
                    className="h-4 w-4 border-slate-300 text-sky-600"
                  />
                  No
                </label>
              </div>
            </div>
          </fieldset>

        {requierePeriodoCompleto ? (
          <fieldset className="space-y-3 border-t border-slate-100 pt-4" disabled={sinPersona || enviando}>
            <legend className={TICKETERA.label}>Información clínica (aviso completo)</legend>
            <p className="text-xs text-slate-600">Completá al menos uno: síntomas, enfermedad o código CIE.</p>
            <div>
              <label htmlFor="sintomas" className={TICKETERA.label}>
                Síntomas
              </label>
              <textarea
                id="sintomas"
                rows={2}
                maxLength={2000}
                className={`mt-1 ${TICKETERA.input} resize-y`}
                value={sintomas}
                onChange={(e) => setSintomas(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="enfermedad" className={TICKETERA.label}>
                Enfermedad / diagnóstico presunto
              </label>
              <input
                id="enfermedad"
                type="text"
                maxLength={500}
                className={`mt-1 ${TICKETERA.input}`}
                value={enfermedad}
                onChange={(e) => setEnfermedad(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="codigo_cie" className={TICKETERA.label}>
                Código CIE (si lo conocés)
              </label>
              <input
                id="codigo_cie"
                type="text"
                maxLength={16}
                className={`mt-1 ${TICKETERA.input}`}
                value={codigoCie}
                onChange={(e) => setCodigoCie(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="detalle_clinico" className={TICKETERA.label}>
                Detalle adicional
              </label>
              <textarea
                id="detalle_clinico"
                rows={2}
                maxLength={2000}
                className={`mt-1 ${TICKETERA.input} resize-y`}
                value={detalleClinico}
                onChange={(e) => setDetalleClinico(e.target.value)}
                placeholder="Cualquier dato que consideres relevante para medicina laboral."
              />
            </div>
          </fieldset>
        ) : null}

        <>
            {gruposCargando ? <p className={TICKETERA.muted}>Cargando grupo de trabajo…</p> : null}
            {gruposError ? <p className="text-sm text-red-700">{gruposError}</p> : null}

            {requiereSeleccionGrupo ? (
              <div>
                <label htmlFor="grupo_ancla" className={TICKETERA.label}>
                  Grupo de trabajo
                </label>
                <select
                  id="grupo_ancla"
                  className={`mt-1.5 ${TICKETERA.select}`}
                  value={grupoAnclaId}
                  onChange={(e) => setGrupoAnclaId(e.target.value)}
                  disabled={sinPersona || enviando}
                >
                  <option value="">Seleccioná…</option>
                  {gruposVigentes.map((g) => {
                    const id = String(g.grupo_de_trabajo_id || "");
                    const label = String(g.etiqueta_ui || g.nombre || id);
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                checked={esLicenciaIncompleta}
                onChange={(e) => onToggleLicenciaIncompleta?.(e.target.checked)}
                disabled={sinPersona || enviando}
              />
              <span className="text-sm text-slate-800">
                <span className="font-medium">¿No poseo certificado médico en este momento?</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Podés registrar un aviso provisorio y subir el certificado después (mismo trámite).
                </span>
              </span>
            </label>

            {esLicenciaIncompleta ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5 text-sm text-sky-950">
                Tenés <strong>{plazoLabel} horas</strong> para cargar el certificado. Pasado ese plazo, el aviso
                provisorio puede invalidarse si no completás la documentación.
              </div>
            ) : null}
          </>

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

        <div>
            <label htmlFor="comentario_agente" className={TICKETERA.label}>
              Comentario (opcional)
            </label>
            <textarea
              id="comentario_agente"
              rows={3}
              maxLength={2000}
              className={`mt-1.5 ${TICKETERA.input} min-h-[5rem] resize-y`}
              value={comentarioAgente}
              onChange={(e) => setComentarioAgente(e.target.value)}
              placeholder="Ej.: certificado del efector, teléfono de contacto…"
              disabled={sinPersona || enviando}
            />
          </div>
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
      {!ocultarCertificado && !archivo && !sinPersona && !esLicenciaIncompleta ? (
        <p className="text-center text-xs text-slate-500">Adjuntá el certificado para habilitar el envío.</p>
      ) : null}
      </>
      ) : null}

      <CompletarAvisoMedicoModal
        abierto={completarModalAbierto}
        onCerrar={onCerrarCompletarModal}
        avisoIncompletoVigente={avisoIncompletoVigente}
        plazoHorasCertificado={plazoHorasCertificado}
        fechaInicioReposo={fechaInicioReposo}
        setFechaInicioReposo={setFechaInicioReposoCompletar}
        fechaFinReposo={fechaFinReposo}
        setFechaFinReposo={setFechaFinReposoCompletar}
        fechaMinimaYmd={fechaMinimaYmd}
        perfilContacto={perfilContacto}
        contactoUsaPerfil={contactoUsaPerfil}
        onToggleContactoUsaPerfil={onToggleContactoUsaPerfil}
        emailUsaPerfil={emailUsaPerfil}
        onToggleEmailUsaPerfil={onToggleEmailUsaPerfil}
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
        sintomas={sintomas}
        setSintomas={setSintomas}
        enfermedad={enfermedad}
        setEnfermedad={setEnfermedad}
        codigoCie={codigoCie}
        setCodigoCie={setCodigoCie}
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
