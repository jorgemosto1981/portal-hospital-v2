import {
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../../constants/solicitudesArticuloV2.js";

const TZ = "America/Argentina/Buenos_Aires";

export function formatYmdEs(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * @param {string | null | undefined} iso
 */
export function formatVencimientoProvisorioEs(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "—";
  const fecha = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
  const hora = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
  return `${fecha} ${hora} hs`;
}

/**
 * @param {string | null | undefined} tipoIngresoId
 */
export function etiquetaTipoAvisoMedico(tipoIngresoId) {
  const id = String(tipoIngresoId || "").trim();
  if (id === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR) return "Atención de familiar";
  if (id === TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA) return "Enfermedad propia";
  return "Licencia médica";
}
