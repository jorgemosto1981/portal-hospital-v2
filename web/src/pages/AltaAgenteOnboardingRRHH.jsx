import { Link } from "react-router-dom";

import Card from "../components/ui/Card.jsx";
import { PersonaAgenteCombobox } from "../components/persona/PersonaAgenteCombobox.jsx";
import AvisoPrimerAccesoRrhh from "../features/altaOnboarding/AvisoPrimerAccesoRrhh.jsx";
import CascaraAltaSection from "../features/altaOnboarding/CascaraAltaSection.jsx";
import { AltaOnboardingTracker } from "../features/altaOnboarding/AltaOnboardingTracker.jsx";
import { AYUDA_TRACKER } from "../features/altaOnboarding/altaNuevoUsuarioAyuda.js";
import { useAltaOnboardingPage } from "../features/altaOnboarding/useAltaOnboardingPage.js";

/** Hub RRHH: identidad → laboral → check-in → aviso al agente. */
export default function AltaAgenteOnboardingRRHH() {
  const p = useAltaOnboardingPage();
  const t = p.tracker;
  const dniSeleccionado = String(t.personaDoc?.dni || "").trim();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 md:max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Alta nuevo usuario</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Flujo unificado: crear identidad, completar datos laborales, cerrar check-in de saldos y recién entonces
        avisar al agente para su primer acceso.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Acciones de bloqueo, baja o reinicio:{" "}
        <Link to="/portal/rrhh/gestion-usuarios" className="font-medium text-blue-700 underline">
          Gestión de usuarios
        </Link>
        .
      </p>

      <Card className="mt-6 space-y-4 p-4 md:p-5">
        <h2 className="text-base font-semibold text-slate-900">1. Crear identidad</h2>
        <CascaraAltaSection onCreado={p.setPersonaId} />
      </Card>

      <Card className="mt-4 space-y-5 p-4 md:p-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{AYUDA_TRACKER.titulo}</p>
          {AYUDA_TRACKER.parrafos.map((txt) => (
            <p key={txt} className="mt-1 leading-relaxed">
              {txt}
            </p>
          ))}
        </div>

        <h2 className="text-base font-semibold text-slate-900">2. Seguir o retomar un alta</h2>
        <PersonaAgenteCombobox
          personaWrapRef={p.personaWrapRef}
          loadPersonas={p.loadPersonas}
          personaOpen={p.personaOpen}
          setPersonaOpen={p.setPersonaOpen}
          personaQuery={p.personaQuery}
          setPersonaQuery={p.setPersonaQuery}
          personaId={p.personaId}
          setPersonaId={p.setPersonaId}
          personaSeleccionadaLabel={p.personaSeleccionadaLabel}
          personaOptionsFiltradas={p.personaOptionsFiltradas}
          placeholderEmpty="Buscar agente para seguir el alta…"
        />

        <AltaOnboardingTracker
          personaId={p.personaId}
          loading={t.loading}
          error={t.error}
          estado={t.estado}
          pasosCompletos={t.pasosCompletos}
          hlcCount={t.hlcCount}
          checkinCerrado={t.checkinCerrado}
          anioA={t.anioA}
          onRefresh={t.refetch}
        />
      </Card>

      <div className="mt-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">3. Aviso al agente</h2>
        <AvisoPrimerAccesoRrhh habilitado={Boolean(t.pasosCompletos)} dni={dniSeleccionado} />
      </div>
    </div>
  );
}
