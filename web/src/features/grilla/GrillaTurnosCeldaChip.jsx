import { claseChipEquipoOperativa } from "./grillaTurnosVisual.js";

/**
 * Chip de celda — mismo aspecto en editor mensual, grilla aprobada y grilla operativa.
 * @param {{
 *   variant?: string;
 *   children: import('react').ReactNode;
 *   className?: string;
 *   title?: string;
 *   rellenoCelda?: boolean;
 * }} props
 */
export default function GrillaTurnosCeldaChip({
  variant = "vacio",
  children,
  className = "",
  title,
  rellenoCelda = false,
}) {
  return (
    <div
      className={claseChipEquipoOperativa(variant, { relleno: rellenoCelda, extra: className })}
      title={title}
    >
      {children}
    </div>
  );
}
