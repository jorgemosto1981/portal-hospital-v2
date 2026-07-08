import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import {
  CAMBIO_DIA_TITULO_UI,
  ymdToDdMmYyyy,
} from "../features/solicitudes/cambioDiaUi.js";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { useSolicitudCambioDiaAlta } from "../features/solicitudes/useSolicitudCambioDiaAlta.js";

function articuloIdQuery(searchParams) {
  const id = String(searchParams.get("articulo") || searchParams.get("articulo_id") || "").trim();
  return /^art_/i.test(id) ? id : "";
}

/** @param {{ label: string, value: string, min?: string, max?: string, onChange: (v: string) => void, hint?: string, disabled?: boolean }} p */
function FechaCampo({ label, value, min, max, onChange, hint, disabled }) {
  const visible = ymdToDdMmYyyy(value);
  return (
    <label className="block space-y-1.5">
      <span className={TICKETERA.label}>{label}</span>
      <input
        type="date"
        className={TICKETERA.input}
        value={value}
        min={min || undefined}
        max={max || undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className={TICKETERA.muted}>
        {hint
          ? hint
          : visible
            ? `Fecha seleccionada: ${visible}`
            : "Formato visual: DD-MM-YYYY"}
      </span>
    </label>
  );
}

export default function TicketeraCambioDia() {
  const [searchParams] = useSearchParams();
  const articuloIdInicial = useMemo(() => articuloIdQuery(searchParams), [searchParams]);
  const [confirmacion, setConfirmacion] = useState(
    /** @type {{ solicitud_id: string, huerfana: boolean } | null} */ (null),
  );

  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();

  const form = useSolicitudCambioDiaAlta({ personaId, articuloIdInicial });

  if (!articuloIdInicial) {
    return <Navigate to="/portal/solicitudes" replace />;
  }

  async function onEnviar() {
    const result = await form.enviar();
    const solId = String(result?.solicitud_id || "").trim();
    if (!solId) return;
    setConfirmacion({
      solicitud_id: solId,
      huerfana: result?.autorizacion_rrhh_sustituta === true,
    });
    toast.success("Tu solicitud de cambio de día quedó registrada.");
    await form.recargar();
  }

  return (
    <div className="space-y-4">
      <Link to="/portal/solicitudes" className={TICKETERA.linkBack}>
        ← Volver a solicitudes
      </Link>

      {confirmacion ? (
        <div className={TICKETERA.confirmCard} role="status">
          <p className="text-base font-semibold text-emerald-950">Solicitud registrada</p>
          <p className="mt-2 font-mono text-sm text-emerald-900">{confirmacion.solicitud_id}</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            {confirmacion.huerfana
              ? "No requiere jefatura: es huérfana. Podés cerrarla desde Bandeja RRHH."
              : "Quedó pendiente de autorización de jefatura. Podés seguir el estado en «Mis solicitudes» (abajo en el hub). Si se aprueba, el traslado se aplica en la grilla del grupo elegido; si se rechaza, el día de asistencia no cambia."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setConfirmacion(null)} className={TICKETERA.btnSecondary}>
              Cargar otra solicitud
            </button>
            <Link to="/portal/solicitudes" className={`${TICKETERA.btnSuccess} inline-flex items-center justify-center`}>
              Volver a solicitudes
            </Link>
          </div>
        </div>
      ) : null}

      <div className={TICKETERA.card}>
        <div className={TICKETERA.cardPad}>
          <div className={TICKETERA.chipArticulo}>
            <span className="text-xs font-medium uppercase tracking-wide text-sky-800">Solicitud</span>
            <p className={`mt-0.5 ${TICKETERA.codigoPatron}`}>{CAMBIO_DIA_TITULO_UI}</p>
            <p className={`mt-2 ${TICKETERA.muted}`}>
              Un día de ausencia y un día de prestación. Anticipación mínima: {form.preaviso} día(s).
              Día mínimo: {ymdToDdMmYyyy(form.ymdMin) || form.ymdMin}. La prestación destino debe estar
              dentro de {form.ventanaMaxDias} días corridos de la ausencia inicial.
            </p>
          </div>

          {claimsLoading || form.cargando ? <p className={TICKETERA.muted}>Cargando…</p> : null}

          {form.error ? <div className={TICKETERA.alertError}>{form.error}</div> : null}

          <FechaCampo
            label="Indicar Fecha de Ausencia Inicial"
            value={form.fechaOrigen}
            min={form.ymdMin}
            onChange={form.setFechaOrigen}
          />

          <FechaCampo
            label="Indicar Fecha de Prestación Destino"
            value={form.fechaDestino}
            min={form.rangoDestino?.min || form.ymdMin}
            max={form.rangoDestino?.max || undefined}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(String(form.fechaOrigen || ""))}
            onChange={form.setFechaDestino}
            hint={
              /^\d{4}-\d{2}-\d{2}$/.test(String(form.fechaOrigen || "")) && form.rangoDestino?.ok
                ? `Ventana permitida: ${ymdToDdMmYyyy(form.rangoDestino.min)} a ${ymdToDdMmYyyy(form.rangoDestino.max)} (±${form.ventanaMaxDias} días corridos desde la ausencia inicial). Seleccionada: ${ymdToDdMmYyyy(form.fechaDestino) || "—"}.`
                : "Primero indicá la Fecha de Ausencia Inicial; el calendario del destino se limita a ±10 días corridos."
            }
          />

          {form.warningsFechas?.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="alert">
              <p className="font-semibold">Revisá las fechas</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {form.warningsFechas.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className={TICKETERA.label}>
              Justificativo para evaluación de autorización{" "}
              <span className="font-normal text-rose-600">(obligatorio)</span>
            </span>
            <textarea
              className={`${TICKETERA.input} min-h-[112px]`}
              maxLength={form.motivoMax}
              value={form.motivo}
              onChange={(e) => form.setMotivo(e.target.value)}
              placeholder="Detallá las razones sanitarias o de servicio que fundamentan el traslado (no motivos particulares)"
              required
            />
            <span className={TICKETERA.muted}>
              {form.motivo.trim().length}/{form.motivoMax} · cuanto más claro, mejor para la evaluación del jefe
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className={TICKETERA.label}>
              Grupo de trabajo <span className="font-normal text-rose-600">(obligatorio)</span>
            </span>
            <select
              className={TICKETERA.select}
              value={form.grupoAnclaId}
              onChange={(e) => {
                form.setGrupoAnclaId(e.target.value);
                form.reiniciarValidacionYPreview();
              }}
              disabled={form.gruposCargando || form.gruposVigentes.length === 0}
            >
              <option value="">Elegí el grupo de trabajo</option>
              {form.gruposVigentes.map((g) => {
                const id = String(g.grupo_trabajo_id || g.id || "").trim();
                const label = String(g.nombre || g.label || id);
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-amber-950">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 rounded border-amber-400 text-sky-600 focus:ring-sky-500"
                checked={form.tomaConocimiento}
                onChange={(e) => form.setTomaConocimiento(e.target.checked)}
              />
              <span>{form.tomaConocimientoTexto}</span>
            </label>
          </div>

          {form.entornoMensajes.length > 0 ? (
            <div className={form.entornoOk ? TICKETERA.alertOk : TICKETERA.alertError}>
              {form.entornoMensajes.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          ) : null}

          {form.previewError ? <div className={TICKETERA.alertError}>{form.previewError}</div> : null}

          {form.preview && (form.preview.ok === true || form.preview.eligible === true) ? (
            <div className={TICKETERA.alertOk}>
              Validación OK. Al enviar, la solicitud irá a la bandeja del jefe; si aprueba, se aplica el
              traslado en la grilla del grupo seleccionado. Podés seguir el estado en «Mis solicitudes».
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={TICKETERA.btnSecondary}
              disabled={
                !form.fechasOk ||
                !form.motivoOk ||
                !form.grupoAnclaOk ||
                form.validandoEntorno ||
                form.previewCargando
              }
              onClick={async () => {
                const okEntorno = form.entornoOk || (await form.validarEntornoPaso2());
                if (!okEntorno) return;
                await form.previsualizar();
              }}
            >
              {form.validandoEntorno || form.previewCargando ? "Validando…" : "Validar solicitud"}
            </button>
            <button
              type="button"
              className={TICKETERA.btnPrimary}
              disabled={
                !form.puedeEnviarTrasPreview ||
                !form.entornoOk ||
                !form.tomaConocimientoOk ||
                form.enviando
              }
              onClick={() => void onEnviar()}
            >
              {form.enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
