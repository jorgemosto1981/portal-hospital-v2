import { isHlcOperativo } from "../../../../shared/utils/hlcOperativo.js";

/** @typedef {'pendiente' | 'ok' | 'bloqueado'} PasoEstado */

export { isHlcOperativo };

/**
 * @param {Record<string, unknown> | null | undefined} personaDoc
 * @param {{ tieneCuenta?: boolean, hlcOperativos?: number }} ctx
 */
export function evalAltaOnboardingPasos(personaDoc, ctx = {}) {
  const tieneCuenta = ctx.tieneCuenta === true;
  const hlcCount = Number(ctx.hlcOperativos) || 0;
  const checkinCerrado = Boolean(personaDoc?.checkin_saldos_portal_en);
  const anioA = personaDoc?.anio_corte_portal_a;

  /** @type {Record<string, PasoEstado>} */
  const estado = {
    cascara: tieneCuenta ? "ok" : "pendiente",
    laboral: hlcCount > 0 ? "ok" : tieneCuenta ? "pendiente" : "bloqueado",
    checkin: checkinCerrado ? "ok" : hlcCount > 0 ? "pendiente" : "bloqueado",
  };

  const pasosCompletos = estado.cascara === "ok" && estado.laboral === "ok" && estado.checkin === "ok";

  return { estado, pasosCompletos, anioA, checkinCerrado, hlcCount };
}

/**
 * @param {string} basePath
 * @param {string} personaId
 */
export function buildAltaOnboardingHref(basePath, personaId) {
  const path = String(basePath || "").trim();
  const per = String(personaId || "").trim();
  if (!path) return "/portal/home";
  if (!/^per_/i.test(per)) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}persona_id=${encodeURIComponent(per)}`;
}

export const ALTA_ONBOARDING_STEPS = [
  {
    id: "cascara",
    numero: 1,
    titulo: "Cáscara (persona + cuenta)",
    descripcion: "Alta en RRHH: persona y cuenta en estado pendiente de registro.",
    path: "/portal/rrhh/alta",
    accionLabel: "Ir a pre-alta",
  },
  {
    id: "laboral",
    numero: 2,
    titulo: "Datos laborales",
    descripcion: "HLc vigente (y HLg/HLd según corresponda) para organigrama y roles.",
    path: "/portal/laboral",
    accionLabel: "Abrir laboral",
  },
  {
    id: "checkin",
    numero: 3,
    titulo: "Check-in de saldos",
    descripcion: "Fotografía inicial LAO / ciclos B / cuenta C y cierre global.",
    path: "/portal/rrhh/checkin-saldos",
    accionLabel: "Abrir check-in",
  },
];
