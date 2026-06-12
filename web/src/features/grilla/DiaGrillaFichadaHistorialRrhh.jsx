import { useMemo, useState } from "react";

/**
 * @param {{
 *   celdaVis: Record<string, unknown> | null;
 *   eventosTicketDia?: Array<Record<string, unknown>>;
 * }} props
 */
export default function DiaGrillaFichadaHistorialRrhh({ celdaVis, eventosTicketDia = [] }) {
  const [abierto, setAbierto] = useState(false);
  const borradas = useMemo(() => {
    const raw = celdaVis?.fichadas_borradas;
    return Array.isArray(raw) ? raw : [];
  }, [celdaVis]);
  const eventos = useMemo(
    () => (Array.isArray(eventosTicketDia) ? eventosTicketDia : []),
    [eventosTicketDia],
  );
  const tieneAlgo = borradas.length > 0 || eventos.length > 0;
  if (!celdaVis) return null;

  return (
    <details
      className="mt-3 rounded-lg border border-slate-200 bg-white"
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
        Historial de cambios / auditoría
        {tieneAlgo ? ` (${borradas.length} baja${borradas.length === 1 ? "" : "s"})` : ""}
      </summary>
      {abierto ? (
        <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-2 text-xs text-slate-800">
          {borradas.length === 0 ? (
            <p className="text-slate-500">Sin bajas lógicas registradas en esta celda.</p>
          ) : (
            <ul className="space-y-2">
              {borradas.map((b, i) => (
                <li key={i} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="font-semibold text-slate-700">
                    {String(b.origen_borrado || b.origen || "GRILLA_ABM")}
                  </p>
                  <p className="text-slate-600">Motivo: {String(b.motivo || "—")}</p>
                  <p className="text-slate-500">
                    Actor: {String(b.borrado_por_persona_id || "—")}
                  </p>
                  {Array.isArray(b.marcas_snapshot) && b.marcas_snapshot.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-600">
                      Snapshot: {b.marcas_snapshot.length} fila(s) preservada(s) en auditoría.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {eventos.length > 0 ? (
            <div>
              <p className="mb-1 font-semibold text-slate-700">Eventos del día (ticket)</p>
              <ul className="space-y-1">
                {eventos.slice(0, 8).map((ev) => (
                  <li key={String(ev.evento_id || ev.id)} className="text-[11px] text-slate-600">
                    {String(ev.tipo_evento || ev.codigo || "evento")} — {String(ev.resumen || ev.mensaje || "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
