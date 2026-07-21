import { ymdToDdMmYyyy } from "./cambioDiaUi.js";
import { TICKETERA } from "./ticketeraUi.js";

/**
 * Panel informativo Art. 64: saldos con/sin goce + pendientes (sin exigir Validar).
 * @param {{
 *   resumen: Record<string, unknown> | null,
 *   cargando?: boolean,
 *   error?: string,
 * }} props
 */
export default function Familia64SaldoInfo({ resumen, cargando = false, error = "" }) {
  if (cargando) {
    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" role="status">
        Consultando saldos Art. 64…
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${TICKETERA.alertError} mb-3`} role="alert">
        {error}
      </div>
    );
  }
  if (!resumen) return null;

  const anio = resumen.anio_ciclo ?? "—";
  const con = resumen.con_goce_disponible;
  const sin = resumen.sin_goce_disponible;
  const pendientes = Array.isArray(resumen.pendientes) ? resumen.pendientes : [];

  return (
    <div
      className="mb-3 space-y-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3 text-base text-slate-800"
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-900">Tu saldo Art. 64 · ciclo {anio}</p>
      <p>
        Disponible: <strong>{con != null ? con : "—"} con sueldo</strong>
        {" · "}
        <strong>{sin != null ? sin : "—"} sin sueldo</strong>
      </p>
      {pendientes.length === 0 ? (
        <p className={`${TICKETERA.muted} text-sm`}>No tenés solicitudes 64 pendientes en este ciclo.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-800">
          {pendientes.map((p) => {
            const fecha = ymdToDdMmYyyy(p.fecha_desde) || String(p.fecha_desde || "—");
            const mod = String(p.modalidad_label || "Art. 64");
            const dias = Number(p.dias) || 1;
            const reservado = p.saldo_reservado === true;
            return (
              <li key={String(p.solicitud_id)} className="rounded-lg border border-sky-100 bg-white/70 px-2.5 py-2">
                Además tenés una solicitud <strong>{mod}</strong> de fecha <strong>{fecha}</strong> aún pendiente
                {reservado
                  ? ` (ya reservó ${dias} día${dias === 1 ? "" : "s"} de tu saldo).`
                  : ` (a descontar ${dias} día${dias === 1 ? "" : "s"} de tu saldo).`}
              </li>
            );
          })}
        </ul>
      )}
      <p className={`${TICKETERA.muted} text-sm`}>
        La modalidad final (con o sin goce) la define tu jefe al autorizar.
      </p>
    </div>
  );
}
