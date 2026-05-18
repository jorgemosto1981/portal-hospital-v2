import { Link } from "react-router-dom";

import Card from "../components/ui/Card.jsx";
import { PersonaAgenteCombobox } from "../components/persona/PersonaAgenteCombobox.jsx";
import { AltaOnboardingTracker } from "../features/altaOnboarding/AltaOnboardingTracker.jsx";
import { useAltaOnboardingPage } from "../features/altaOnboarding/useAltaOnboardingPage.js";

export default function AltaAgenteOnboardingRRHH() {
  const p = useAltaOnboardingPage();
  const t = p.tracker;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 md:max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Alta de agente (guía RRHH)</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Unifica pre-alta (cáscara), datos laborales (HLc, HLg, HLd) y check-in de saldos. Cada paso abre la
        pantalla correspondiente con el <code className="text-xs">persona_id</code> precargado.
      </p>

      <p className="mt-3 text-sm">
        <Link to="/portal/rrhh/alta" className="font-medium text-blue-600 hover:underline">
          Pre-alta y gestión de cuenta →
        </Link>
      </p>

      <Card className="mt-6 space-y-5 p-4 md:p-5">
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
    </div>
  );
}
