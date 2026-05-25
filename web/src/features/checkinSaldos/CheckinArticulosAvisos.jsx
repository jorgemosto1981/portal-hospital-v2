/**
 * Artículos vigentes con error de meta o sin patrón reconocido (pestaña B/C).
 */
export function CheckinArticulosAvisos({ articulos, patronLabel }) {
  if (!articulos?.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
      <p className="text-xs font-semibold text-amber-900">
        Artículos con configuración incompleta (no aparecen en la tabla {patronLabel})
      </p>
      <ul className="mt-2 space-y-2 text-sm text-amber-950">
        {articulos.map((a) => (
          <li key={a.id}>
            <span className="font-medium">{a.codigo}</span>
            {a.nombre ? <span className="text-amber-800"> — {a.nombre}</span> : null}
            <span className="mt-0.5 block text-xs text-amber-900">{a.metaError || "Sin patrón"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
