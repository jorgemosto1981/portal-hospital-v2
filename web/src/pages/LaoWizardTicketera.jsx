import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

import LaoDisponibilidadPaso from "../features/lao/LaoDisponibilidadPaso.jsx";
import LaoFechasPaso from "../features/lao/LaoFechasPaso.jsx";
import LaoSimulacionPaso from "../features/lao/LaoSimulacionPaso.jsx";
import { buildLaoWizardCtxFromResumen } from "../features/lao/laoWizardCtx.js";
import { useLaoContext } from "../features/lao/useLaoContext.js";
import { useLaoWizardComputo } from "../features/lao/useLaoWizardComputo.js";
import { useLaoWizardPreview } from "../features/lao/useLaoWizardPreview.js";
import { useLaoWizardSubmit } from "../features/lao/useLaoWizardSubmit.js";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { TICKETERA } from "../features/solicitudes/ticketeraUi.js";
import { LAO_ARTICULO_ID } from "../constants/laoArticulo.js";
import { ymdHoyBa } from "../features/solicitudes/ticketeraUtils.js";

const PASOS_LAO = [
  { n: 1, titulo: "Disponibilidad" },
  { n: 2, titulo: "Fechas" },
  { n: 3, titulo: "Derecho" },
  { n: 4, titulo: "Enviar" },
];

function articuloIdQuery(searchParams) {
  const id = String(searchParams.get("articulo_id") || searchParams.get("articulo") || "").trim();
  return /^art_/i.test(id) ? id : LAO_ARTICULO_ID;
}

function fechaDesdeQuery(searchParams) {
  const f = String(searchParams.get("fecha") || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : ymdHoyBa();
}

function LaoWizardStepper({ paso }) {
  const ultimoIdx = PASOS_LAO.length - 1;
  return (
    <div className="w-full" aria-label="Pasos LAO" role="list">
      <div className="flex w-full items-center px-1">
        {PASOS_LAO.map((step, idx) => {
          const activo = paso === step.n;
          const completado = paso > step.n;
          const dotClass = [
            "block h-3.5 w-3.5 shrink-0 rounded-full border-2 sm:h-4 sm:w-4",
            completado ? "border-emerald-600 bg-emerald-600" : "",
            activo && !completado ? "border-sky-600 bg-sky-600 ring-4 ring-sky-100" : "",
            !activo && !completado ? "border-slate-300 bg-white" : "",
          ].join(" ");
          return (
            <div
              key={step.n}
              className={idx < ultimoIdx ? "flex min-w-0 flex-1 items-center" : "flex shrink-0 items-center"}
              role="listitem"
              aria-current={activo ? "step" : undefined}
            >
              <span className={dotClass} title={step.titulo} />
              {idx < ultimoIdx ? (
                <div
                  className={`mx-2 h-0.5 min-w-[0.75rem] flex-1 rounded-full sm:mx-3 ${
                    completado ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex w-full justify-between gap-1 px-0.5">
        {PASOS_LAO.map((step) => (
          <span
            key={`lbl-${step.n}`}
            className={`max-w-[4.5rem] text-center text-[10px] font-medium leading-tight sm:max-w-[5rem] sm:text-xs ${
              paso === step.n ? "text-sky-800" : paso > step.n ? "text-emerald-800" : "text-slate-500"
            }`}
          >
            {step.titulo}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Wizard LAO en ticketera (F3a — flujo completo agente).
 */
export default function LaoWizardTicketera() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();
  const articuloId = useMemo(() => articuloIdQuery(searchParams), [searchParams]);
  const fechaReferencia = useMemo(() => fechaDesdeQuery(searchParams), [searchParams]);

  const [paso, setPaso] = useState(1);
  const [wizardCtx, setWizardCtx] = useState(null);
  const [rangoSnapshot, setRangoSnapshot] = useState(null);
  const [fechaDesde, setFechaDesde] = useState(fechaReferencia);
  const [fechaHasta, setFechaHasta] = useState(fechaReferencia);

  const anioCalendarioCivil = useMemo(() => Number(fechaReferencia.slice(0, 4)), [fechaReferencia]);

  const { resumen, okCallable, error, loading, puedeConsultar } = useLaoContext({
    articuloId,
    personaId,
    anioOrigenBolsa: null,
    enabled: paso === 1,
  });

  const computo = useLaoWizardComputo({
    versionComputo: wizardCtx?.version_computo ?? null,
    fechaDesde,
    fechaHasta,
    refYmd: fechaReferencia,
    enabled: paso === 2 && wizardCtx != null,
  });

  const preview = useLaoWizardPreview({
    articuloId,
    personaId,
    versionAplicadaId: wizardCtx?.version_aplicada_id ?? "",
    anioOrigenBolsa: wizardCtx?.anio_origen_bolsa_activo ?? 0,
    fechaDesde: rangoSnapshot?.fechaDesde ?? fechaDesde,
    fechaHasta: rangoSnapshot?.fechaHasta ?? fechaHasta,
    diasSolicitados: rangoSnapshot?.resumenComputo?.dias_consumo ?? 0,
    enabled: paso === 3 && wizardCtx != null && rangoSnapshot != null,
  });

  const onSubmitSuccess = useCallback(
    () => {
      navigate("/portal/solicitudes");
    },
    [navigate],
  );

  const { submit, enviando } = useLaoWizardSubmit({
    wizardCtx,
    rangoSnapshot,
    articuloId,
    personaId,
    actorAltaId: personaId,
    onSuccess: onSubmitSuccess,
  });

  const puedeAvanzarPaso1 = (() => {
    if (!okCallable || resumen?.fifo?.debe_respetar_fifo) return false;
    const bolsa = resumen?.bolsa_seleccionada;
    if (!bolsa) return false;
    const esLaoAnioEnCurso =
      Number.isInteger(anioCalendarioCivil) && Number(bolsa.anio_origen) === anioCalendarioCivil;
    if (esLaoAnioEnCurso) return true;
    return Number(bolsa.disponible) > 0;
  })();

  function handleIniciarSolicitud() {
    const ctx = buildLaoWizardCtxFromResumen(resumen);
    if (!ctx) {
      toast.error(
        "No se recibió la configuración de cómputo del servidor. Actualizá la app o contactá soporte.",
      );
      return;
    }
    setWizardCtx(ctx);
    setRangoSnapshot(null);
    setFechaDesde(fechaReferencia);
    setFechaHasta(fechaReferencia);
    setPaso(2);
  }

  function handleContinuarPaso2() {
    if (!computo.ok || !computo.resumenComputo) return;
    setRangoSnapshot({
      fechaDesde,
      fechaHasta,
      resumenComputo: computo.resumenComputo,
    });
    setPaso(3);
  }

  function handleAnterior() {
    setPaso((p) => Math.max(1, p - 1));
  }

  return (
    <div className="space-y-4">
      <div className={`${TICKETERA.chipArticulo} border-emerald-100 bg-emerald-50/60`}>
        <span className="text-xs font-medium uppercase tracking-wide text-emerald-800">Trámite</span>
        <p className={TICKETERA.codigoLao}>LAO</p>
        <p className="text-xs text-emerald-900">Licencia anual ordinaria</p>
      </div>

      <p className={TICKETERA.hubIntro}>
        Fecha de referencia del trámite: <span className="font-mono font-medium">{fechaReferencia}</span>
      </p>

      {!claimsLoading && !/^per_/i.test(personaId) ? (
        <p className="text-sm text-amber-800">
          Tu sesión no tiene persona vinculada (o RRHH debe indicar el agente). Volvé a iniciar sesión o usá el flujo
          desde check-in.
        </p>
      ) : null}

      <LaoWizardStepper paso={paso} />

      {paso === 1 ? (
        <button
          type="button"
          className={TICKETERA.btnPrimary}
          disabled={!puedeAvanzarPaso1 || loading || !puedeConsultar}
          onClick={handleIniciarSolicitud}
        >
          Iniciar solicitud
        </button>
      ) : null}

      {paso === 2 ? (
        <button
          type="button"
          className={TICKETERA.btnPrimary}
          disabled={!computo.ok || computo.isLoading}
          onClick={handleContinuarPaso2}
        >
          Continuar
        </button>
      ) : null}

      <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
        {paso === 1 ? (
          <LaoDisponibilidadPaso
            resumen={resumen}
            loading={loading}
            error={error}
            anioCalendarioCivil={anioCalendarioCivil}
          />
        ) : null}
        {paso === 2 && wizardCtx ? (
          <LaoFechasPaso
            ejercicioLabel={wizardCtx.ejercicio_label}
            anioOrigenBolsa={wizardCtx.anio_origen_bolsa_activo}
            fechaDesde={fechaDesde}
            setFechaDesde={setFechaDesde}
            fechaHasta={fechaHasta}
            setFechaHasta={setFechaHasta}
            isLoading={computo.isLoading}
            modoComputo={computo.modoComputo}
            resumenComputo={computo.resumenComputo}
            mensajes={computo.mensajes}
            ok={computo.ok}
          />
        ) : null}
        {paso === 2 && !wizardCtx ? (
          <p className={TICKETERA.muted}>
            Volvé al paso 1 y tocá <strong>Iniciar solicitud</strong> para cargar el contexto del ejercicio.
          </p>
        ) : null}
        {paso === 3 && rangoSnapshot && wizardCtx ? (
          <LaoSimulacionPaso
            fechaDesde={rangoSnapshot.fechaDesde}
            fechaHasta={rangoSnapshot.fechaHasta}
            diasConsumo={rangoSnapshot.resumenComputo?.dias_consumo}
            anioOrigenBolsa={wizardCtx.anio_origen_bolsa_activo}
            simulacion={preview.simulacion}
            ok={preview.ok}
            mensajes={preview.mensajes}
            loading={preview.loading}
            onVolverPaso2={() => setPaso(2)}
          />
        ) : null}
        {paso === 3 && !rangoSnapshot ? (
          <p className={TICKETERA.muted}>
            Completá el paso de fechas y tocá <strong>Continuar</strong> para simular tu derecho.
          </p>
        ) : null}
      </div>

      {paso === 3 ? (
        <button
          type="button"
          className={`${TICKETERA.btnSuccess} disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={!preview.ok || preview.loading || enviando || claimsLoading}
          onClick={() => void submit()}
        >
          {enviando ? "Enviando solicitud…" : "Confirmar y enviar solicitud"}
        </button>
      ) : null}

      {paso > 1 ? (
        <button type="button" className={TICKETERA.btnSecondary} onClick={handleAnterior}>
          Anterior
        </button>
      ) : null}
    </div>
  );
}
