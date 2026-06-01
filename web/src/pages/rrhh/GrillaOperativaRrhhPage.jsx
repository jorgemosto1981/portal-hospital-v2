import GrillaMesLicenciasPanel from "../../features/grilla/GrillaMesLicenciasPanel.jsx";

/**
 * Grilla operativa GSO para RRHH (calendario MDC + vista sector).
 * Ruta: /portal/rrhh/grilla-operativa
 */
export default function GrillaOperativaRrhhPage() {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Grilla operativa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Calendario de licencias y vista por sector. Elegí un grupo de trabajo y el período mensual.
      </p>
      <GrillaMesLicenciasPanel variant="rrhh" />
    </section>
  );
}
