import { claseChipVariante } from "./grillaTurnosVisual.js";

/**
 * Chip de celda — mismo aspecto en editor mensual, grilla aprobada y grilla operativa.
 * @param {{ variant?: string, children: import('react').ReactNode, className?: string, title?: string }} props
 */
export default function GrillaTurnosCeldaChip({ variant = "vacio", children, className = "", title }) {
  return (
    <div className={claseChipVariante(variant, className)} title={title}>
      {children}
    </div>
  );
}
