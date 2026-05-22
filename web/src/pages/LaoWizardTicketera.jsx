import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LaoDisponibilidadPaso from "../features/lao/LaoDisponibilidadPaso.jsx";
import { useLaoContext } from "../features/lao/useLaoContext.js";
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
 * Wizard LAO en ticketera (F3a.1 — paso 1 disponibilidad).
 */
export default function LaoWizardTicketera() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const personaId = String(claims?.persona_id || "").trim();
  const articuloId = useMemo(() => articuloIdQuery(searchParams), [searchParams]);
  const fechaReferencia = useMemo(() => fechaDesdeQuery(searchParams), [searchParams]);

  const [paso, setPaso] = useState(1);
  const anioCalendarioCivil = useMemo(() => Number(fechaReferencia.slice(0, 4)), [fechaReferencia]);

  const { resumen, okCallable, error, loading, puedeConsultar } = useLaoContext({
    articuloId,
    personaId,
    anioOrigenBolsa: null,
    enabled: paso === 1,
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
          onClick={() => setPaso(2)}
        >
          Iniciar solicitud
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
        ) : (
          <p className={TICKETERA.muted}>Paso {paso} en construcción (F3a.2). Volvé al paso 1 para revisar tu bolsa.</p>
        )}
      </div>

      {paso > 1 ? (
        <button type="button" className={TICKETERA.btnSecondary} onClick={() => setPaso((p) => Math.max(1, p - 1))}>
          Anterior
        </button>
      ) : null}
    </div>
  );
}
