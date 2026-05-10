/**
 * Ayuda contextual uniforme: borde azul suave y prefijo **Efecto:** en contenido.
 * @param {{ children: unknown, className?: string }} p
 */
export default function ContextNote({ children, className = "" }) {
  return (
    <p
      className={`mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 text-xs text-blue-900 ${className}`.trim()}
    >
      <strong>Efecto:</strong> {children}
    </p>
  );
}
