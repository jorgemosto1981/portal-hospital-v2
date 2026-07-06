import {
  calcularPlazoProvisorioSenal,
  resolverBadgesBandejaAuditor,
} from "../../../../shared/utils/bandejaAuditorSenalesCore.js";

export { calcularPlazoProvisorioSenal, resolverBadgesBandejaAuditor };

/**
 * @param {import("../../../../shared/utils/bandejaAuditorSenalesCore.js").VarianteBadgeSenal | string} variant
 */
export function clasesBadgeSenalAuditor(variant) {
  const v = String(variant || "").trim();
  if (v === "provisoria") return "border-amber-200 bg-amber-100 text-amber-950";
  if (v === "lista") return "border-teal-200 bg-teal-100 text-teal-900";
  if (v === "urgente") return "border-orange-300 bg-orange-100 text-orange-950";
  if (v === "critico") return "border-rose-300 bg-rose-100 text-rose-900";
  if (v === "larga") return "border-violet-200 bg-violet-100 text-violet-900";
  if (v === "advertencia") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

/**
 * @param {import("../../../../shared/utils/bandejaAuditorSenalesCore.js").NivelPlazoProvisorio | string} nivel
 */
export function clasesCountdownSenalAuditor(nivel) {
  const n = String(nivel || "").trim();
  if (n === "vencida") return "text-rose-800";
  if (n === "urgente") return "text-orange-800 font-semibold";
  if (n === "advertencia") return "text-amber-800";
  if (n === "sin_plazo") return "text-slate-600";
  return "text-slate-700";
}
