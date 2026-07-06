import { useEffect, useState } from "react";

import {
  calcularPlazoProvisorioSenal,
  clasesBadgeSenalAuditor,
  clasesCountdownSenalAuditor,
  resolverBadgesBandejaAuditor,
} from "./bandejaAuditorSenalesUi.js";

const TICK_MS = 60_000;

/**
 * Badges §5.8 + countdown provisorio (lista compacta o panel detalle).
 * @param {{ item: Record<string, unknown>, variant?: "compact" | "detalle" }} props
 */
export default function BandejaAuditorItemSenales({ item, variant = "compact" }) {
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAhoraMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const badges = resolverBadgesBandejaAuditor(item, ahoraMs);
  const plazo = calcularPlazoProvisorioSenal(item, ahoraMs);
  const esDetalle = variant === "detalle";

  if (!badges.length && !plazo.aplica) return null;

  const chips = (
    <>
      {badges.map((b) => (
        <span
          key={b.id}
          className={[
            "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide",
            esDetalle ? "min-h-[28px] px-2.5 py-1 text-xs" : "min-h-[22px] px-2 py-0.5 text-[11px]",
            clasesBadgeSenalAuditor(b.variant),
          ].join(" ")}
        >
          {b.label}
        </span>
      ))}
    </>
  );

  const countdown =
    plazo.aplica && plazo.texto_countdown ? (
      <span
        className={[
          "tabular-nums",
          esDetalle ? "text-sm" : "text-xs",
          clasesCountdownSenalAuditor(plazo.nivel),
        ].join(" ")}
        title="Plazo para completar certificado (aviso provisorio)"
      >
        {plazo.texto_countdown}
      </span>
    ) : null;

  if (esDetalle) {
    return (
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Señales del trámite</p>
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
        {countdown ? <p className="text-sm text-slate-800">{countdown}</p> : null}
        {plazo.vencida ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            Plazo de certificado vencido. El agente debe completar el trámite; no podés dictaminar hasta que
            cargue el certificado.
          </p>
        ) : null}
        {item?.es_licencia_incompleta === true && !plazo.vencida ? (
          <p className="text-xs text-slate-600">
            Aviso provisorio en curso — el agente puede subir el certificado sobre el mismo trámite antes del
            vencimiento.
          </p>
        ) : null}
        {item?.puede_clasificar === true ? (
          <p className="text-xs text-teal-800">Aviso completo — listo para dictamen médico.</p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips}
      {countdown}
    </div>
  );
}
