/**
 * Contenedor blanco, borde sutil, esquinas redondeadas (estilo app fintech móvil).
 */
export default function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`.trim()}
    >
      {children}
    </div>
  );
}
