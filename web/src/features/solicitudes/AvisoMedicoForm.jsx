import { Link } from "react-router-dom";

import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";
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
  comentarioAgente,
  setComentarioAgente,
  esLicenciaIncompleta = false,
  onToggleLicenciaIncompleta,
  plazoHorasCertificado = null,
  modoCompletar = false,
  avisoIncompletoVigente = null,
  buscandoAvisoPendiente = false,
  archivo,
  onSeleccionarArchivo,
  gruposVigentes = [],
  grupoAnclaId,
  setGrupoAnclaId,
  requiereSeleccionGrupo = false,
  gruposCargando = false,
  gruposError = "",
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
  const ocultarCertificado = esLicenciaIncompleta && !modoCompletar;
  const botonLabel = modoCompletar
    ? enviando
      ? "Subiendo certificado…"
      : "Completar aviso con certificado"
    : esLicenciaIncompleta
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
          {modoCompletar
            ? "Ya registraste un aviso sin certificado. Subí el documento para que medicina laboral pueda clasificar tu caso."
            : "Contanos si el reposo es para vos o para un familiar y adjuntá el certificado. Un médico auditor clasificará tu caso."}
        </p>
      </header>

      {buscandoAvisoPendiente ? (
        <p className={`text-sm ${TICKETERA.muted}`}>Verificando avisos pendientes…</p>
      ) : null}

      {modoCompletar && avisoIncompletoVigente?.solicitud_id ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Completar solicitud existente</p>
          <p className="mt-1 text-amber-900/90">
            Ref. <span className="font-mono text-xs">{avisoIncompletoVigente.solicitud_id}</span> — recordá
            subir el certificado dentro de las <strong>{plazoLabel} horas</strong> desde el aviso provisorio.
          </p>
        </div>
      ) : null}

      {sinPersona ? (
        <p className="text-sm text-amber-800">Tu sesión no tiene persona vinculada. Volvé a iniciar sesión.</p>
      ) : null}

      {!modoCompletar ? (
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
        </fieldset>
      ) : null}

      <div className={`${TICKETERA.card} ${TICKETERA.cardPad} space-y-4`}>
        <div>
          <label htmlFor="fecha_inicio_reposo" className={TICKETERA.label}>
            Fecha estimada de inicio del reposo
          </label>
          <input
            id="fecha_inicio_reposo"
            type="date"
            className={`mt-1.5 ${TICKETERA.input}`}
            value={fechaInicioReposo}
            onChange={(e) => setFechaInicioReposo(e.target.value)}
            disabled={sinPersona || enviando}
          />
        </div>

        {!modoCompletar ? (
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

        {!modoCompletar ? (
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
      {!ocultarCertificado && !archivo && !sinPersona && !modoCompletar && !esLicenciaIncompleta ? (
        <p className="text-center text-xs text-slate-500">Adjuntá el certificado para habilitar el envío.</p>
      ) : null}
    </div>
  );
}
