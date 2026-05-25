import { formatFirestoreFecha } from "./formatFirestoreFecha.js";

export function CheckinPersonaEstadoBanner({
  personaId,
  loading,
  personaData,
  confirmarRecargaGlobal,
  setConfirmarRecargaGlobal,
  confirmarRecargaLao,
  setConfirmarRecargaLao,
  showLaoRecarga,
}) {
  if (!personaId) return null;

  if (loading) {
    return <p className="text-xs text-slate-500">Cargando estado de check-in del agente…</p>;
  }

  const globalEn = personaData?.checkin_saldos_portal_en;
  const globalFecha = formatFirestoreFecha(globalEn);
  const laoEn = personaData?.checkin_lao_registrado_en;
  const laoFecha = formatFirestoreFecha(laoEn);
  const anioA = personaData?.anio_corte_portal_a;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">
      {anioA != null ? (
        <p>
          Año de corte portal (A) registrado: <strong>{anioA}</strong>
        </p>
      ) : null}
      {globalEn ? (
        <p className="text-amber-900">
          Check-in global cerrado el <strong>{globalFecha}</strong>. Para volver a guardar saldos, autorizá recarga
          global abajo.
        </p>
      ) : (
        <p className="text-slate-600">
          Check-in global aún <strong>abierto</strong>. Cuando termines todos los artículos, usá «Finalizar check-in
          global».
        </p>
      )}
      {laoEn ? (
        <p className="text-slate-600">
          Check-in LAO previo: <strong>{laoFecha}</strong>
        </p>
      ) : null}
      {globalEn && setConfirmarRecargaGlobal ? (
        <label className="flex min-h-11 items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/90 p-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={Boolean(confirmarRecargaGlobal)}
            onChange={(e) => setConfirmarRecargaGlobal(e.target.checked)}
          />
          <span>Autorizo recargar bolsas (check-in global ya cerrado).</span>
        </label>
      ) : null}
      {showLaoRecarga && laoEn && setConfirmarRecargaLao ? (
        <label className="flex min-h-11 items-start gap-3 rounded-lg border border-slate-300 bg-white p-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={Boolean(confirmarRecargaLao)}
            onChange={(e) => setConfirmarRecargaLao(e.target.checked)}
          />
          <span>Autorizo recargar bolsas LAO (check-in LAO previo).</span>
        </label>
      ) : null}
    </div>
  );
}
