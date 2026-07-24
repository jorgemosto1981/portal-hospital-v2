import PlantelPorGdtPanel from "../../features/plantel/PlantelPorGdtPanel.jsx";

/**
 * Plantel / estructura por GDT — RRHH (árbol completo).
 * Ruta: /portal/rrhh/plantel
 */
export default function PlantelRrhhPage() {
  return (
    <PlantelPorGdtPanel
      modo="rrhh"
      titulo="Plantel por grupo de trabajo"
      subtitulo="Árbol de GDT activos e integrantes vigentes (HLg + personas)."
    />
  );
}
