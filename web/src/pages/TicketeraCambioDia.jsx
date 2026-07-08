import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { useSolicitudCambioDiaAlta } from "../features/solicitudes/useSolicitudCambioDiaAlta.js";

function articuloIdQuery(searchParams) {
  const id = String(searchParams.get("articulo") || searchParams.get("articulo_id") || "").trim();
  return /^art_/i.test(id) ? id : "";
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

  const art = form.articuloSel;
  const cod = String(art?.codigo_grilla || "").trim() || "C-DIA";
  const nom = String(art?.nombre || "Cambio de día").trim();

  return (
    <div className="space-y-4">
      {confirmacion ? (
        <div className={TICKETERA.confirmCard} role="status">
          <p className="text-base font-semibold text-emerald-950">Solicitud registrada</p>
          <p className="mt-2 font-mono text-sm text-emerald-900">{confirmacion.solicitud_id}</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            {confirmacion.huerfana
              ? "No requiere jefatura: es huérfana. Podés cerrarla desde Bandeja RRHH."
              : "Quedó pendiente de jefatura. Al aprobarse se aplicará el traslado en la grilla."}
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
            <p className={TICKETERA.codigoPatron}>{cod}</p>
            <p className="mt-1 text-sm text-slate-600">{nom}</p>
            <p className={`mt-2 ${TICKETERA.muted}`}>
              Anticipación mínima: {form.preaviso} día(s) (configurable en ABM). Día mínimo: {form.ymdMin}.
            </p>
          </div>

          {claimsLoading || form.cargando ? (
            <p className={TICKETERA.muted}>Cargando…</p>
          ) : null}

          {form.error ? <div className={TICKETERA.alertError}>{form.error}</div> : null}

          <label className="block space-y-1.5">
            <span className={TICKETERA.label}>Día origen (a dejar franco)</span>
            <input
              type="date"
              className={TICKETERA.input}
              value={form.fechaOrigen}
              min={form.ymdMin}
              onChange={(e) => form.setFechaOrigen(e.target.value)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={TICKETERA.label}>Día destino (donde trabajás)</span>
            <input
              type="date"
              className={TICKETERA.input}
              value={form.fechaDestino}
              min={form.ymdMin}
              onChange={(e) => form.setFechaDestino(e.target.value)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={TICKETERA.label}>Motivo</span>
            <textarea
              className={`${TICKETERA.input} min-h-[96px]`}
              maxLength={form.motivoMax}
              value={form.motivo}
              onChange={(e) => form.setMotivo(e.target.value)}
              placeholder="Breve justificación del traslado propio"
            />
            <span className={TICKETERA.muted}>
              {form.motivo.trim().length}/{form.motivoMax}
            </span>
          </label>

          {form.requiereSeleccionGrupo ? (
            <label className="block space-y-1.5">
              <span className={TICKETERA.label}>Grupo de trabajo</span>
              <select
                className={TICKETERA.select}
                value={form.grupoAnclaId}
                onChange={(e) => {
                  form.setGrupoAnclaId(e.target.value);
                  form.reiniciarValidacionYPreview();
                }}
                disabled={form.gruposCargando}
              >
                <option value="">Seleccioná…</option>
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
          ) : form.grupoAnclaOk ? (
            <p className={TICKETERA.muted}>Grupo: {form.grupoAnclaId}</p>
          ) : null}

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
              Previsualización OK. Al enviar, la solicitud irá a la bandeja del jefe; si aprueba, se aplica el
              traslado en la grilla.
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
              {form.validandoEntorno || form.previewCargando ? "Validando…" : "Validar y previsualizar"}
            </button>
            <button
              type="button"
              className={TICKETERA.btnPrimary}
              disabled={!form.puedeEnviarTrasPreview || !form.entornoOk || form.enviando}
              onClick={() => void onEnviar()}
            >
              {form.enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
            <Link to="/portal/solicitudes" className={TICKETERA.linkBack}>
              ← Volver
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
