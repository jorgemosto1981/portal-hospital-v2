export function CheckinRectificacionAviso() {
  return (
    <p className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-950">
      <strong>Modo rectificación:</strong> aplica a <strong>LAO (patrón A)</strong>, ciclos (B) y cuenta continua (C).
      No se revalidan HLC ni solicitudes de licencia. Al guardar, solo se actualizan las bolsas que informes en la
      pestaña activa; el resto no se modifica. Se conservan versión y metadatos de cada bolsa rectificada.
    </p>
  );
}
