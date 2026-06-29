import {
  calcularVencimientoPlazoCertificadoDesdeInicioLicencia,
  diasCalendarioPlazoDesdeHorasParametro,
} from "../../../../shared/utils/licenciaMedicaParametrosCore.js";

const TZ = "America/Argentina/Buenos_Aires";

/**
 * @param {Date} date
 */
function formatFechaHoraVencimientoEs(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  if (!d) return "—";
  const fecha = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
  return `${fecha} a las 23:59 hs`;
}

/**
 * @param {number | null | undefined} horasParam
 * @param {string} fechaInicioYmd
 */
export function vencimientoProvisorioDesdeInicio(horasParam, fechaInicioYmd) {
  const horas = Number(horasParam);
  if (!Number.isFinite(horas) || horas <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(fechaInicioYmd || ""))) {
    return null;
  }
  return calcularVencimientoPlazoCertificadoDesdeInicioLicencia(fechaInicioYmd, horas);
}

/**
 * Texto legal / informativo del plazo provisorio (horas desde parámetro G3).
 * @param {number | null | undefined} horasParam
 * @param {string} fechaInicioYmd
 */
export function textoInformativoPlazoCertificado(horasParam, fechaInicioYmd) {
  const horas = Number(horasParam);
  if (!Number.isFinite(horas) || horas <= 0) {
    return "Tenés un plazo para cargar el certificado sobre el mismo trámite. Si vence sin certificado, el aviso puede invalidarse automáticamente.";
  }
  const dias = diasCalendarioPlazoDesdeHorasParametro(horas);
  const venc = vencimientoProvisorioDesdeInicio(horas, fechaInicioYmd);
  const cierre = venc ? formatFechaHoraVencimientoEs(venc) : "el día hábil correspondiente";
  const diasLabel = dias === 1 ? "1 día calendario" : `${dias} días calendario`;
  return `El plazo configurado es de ${horas} horas (${diasLabel}), contado desde la fecha de inicio de la licencia. Tenés hasta el ${cierre} para subir el certificado sobre el mismo trámite. Pasado ese plazo, el aviso provisorio puede invalidarse si no completás la documentación.`;
}

/**
 * Mensaje breve en pantalla de éxito (aviso provisorio).
 * @param {number | null | undefined} horasParam
 * @param {string} fechaInicioYmd
 */
export function textoExitoAvisoProvisorio(horasParam, fechaInicioYmd) {
  const inicio = String(fechaInicioYmd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const inicioLabel = inicio ? `${inicio[3]}/${inicio[2]}/${inicio[1]}` : "—";
  const horas = Number(horasParam);
  const venc = Number.isFinite(horas) && horas > 0 ? vencimientoProvisorioDesdeInicio(horas, fechaInicioYmd) : null;
  const cierre = venc ? formatFechaHoraVencimientoEs(venc) : "el plazo indicado en el trámite";
  return `Subí el certificado médico en el mismo trámite antes del ${cierre}. La licencia comienza el ${inicioLabel}. Si no completás la documentación a tiempo, el aviso provisorio puede invalidarse.`;
}
