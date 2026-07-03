import { formatYmdEs } from "./avisoMedicoProvisorioUi.js";
import { TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR } from "../../constants/solicitudesArticuloV2.js";

/** @param {unknown} v */
function texto(v) {
  const s = String(v ?? "").trim();
  return s || "";
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 */
export function fichaIngresoAgenteTieneDatos(ficha) {
  if (!ficha || typeof ficha !== "object") return false;
  const keys = [
    "tipo_ingreso_id",
    "comentario_agente",
    "telefono_celular",
    "telefono_fijo",
    "email",
    "domicilio_declarado",
    "sintomas",
    "enfermedad",
    "codigo_cie_clinica",
    "detalle_clinico",
    "familiar_nombre",
    "fecha_estimada_desde",
  ];
  return keys.some((k) => texto(ficha[k]));
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 */
export function textoRangoEstimadoAgente(ficha) {
  const desde = texto(ficha?.fecha_estimada_desde);
  const hasta = texto(ficha?.fecha_estimada_hasta);
  if (!desde) return "";
  if (hasta && hasta !== desde) return `${formatYmdEs(desde)} → ${formatYmdEs(hasta)}`;
  return formatYmdEs(desde);
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 */
export function textoTelefonosFicha(ficha) {
  const cel = texto(ficha?.telefono_celular);
  const fijo = texto(ficha?.telefono_fijo);
  if (cel && fijo) return `${cel} / ${fijo}`;
  return cel || fijo || "";
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 */
export function esFichaAtencionFamiliar(ficha) {
  return texto(ficha?.tipo_ingreso_id) === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR;
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 */
export function textoFamiliarAtendido(ficha) {
  const nombre = texto(ficha?.familiar_nombre);
  const apellido = texto(ficha?.familiar_apellido);
  const dni = texto(ficha?.familiar_dni);
  if (!nombre && !apellido) return "";
  const nom = [apellido, nombre].filter(Boolean).join(", ");
  return dni ? `${nom} — DNI ${dni}` : nom;
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function filasContextoFichaIngreso(ficha) {
  const rango = textoRangoEstimadoAgente(ficha);
  const comentario = texto(ficha?.comentario_agente);
  return [
    rango ? { key: "rango", label: "Reposo estimado (agente)", value: rango } : null,
    comentario ? { key: "comentario", label: "Observaciones del agente", value: comentario } : null,
  ].filter(Boolean);
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function filasContactoFichaIngreso(ficha) {
  const tel = textoTelefonosFicha(ficha);
  const email = texto(ficha?.email);
  const dom = texto(ficha?.domicilio_declarado);
  const permanece = ficha?.permanece_en_domicilio === true;
  return [
    tel ? { key: "tel", label: "Teléfono", value: tel } : null,
    email ? { key: "email", label: "Correo", value: email } : null,
    dom ? { key: "dom", label: "Domicilio declarado", value: dom } : null,
    dom || ficha?.permanece_en_domicilio != null
      ? {
          key: "permanece",
          label: "Permanece en domicilio",
          value: permanece ? "Sí" : "No",
        }
      : null,
    ficha?.usar_datos_perfil === true
      ? { key: "perfil", label: "Origen contacto", value: "Datos del perfil del agente" }
      : ficha?.usar_datos_perfil === false
        ? { key: "perfil", label: "Origen contacto", value: "Datos declarados solo para este aviso" }
        : null,
  ].filter(Boolean);
}

/**
 * @param {Record<string, unknown> | null | undefined} ficha
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function filasClinicaFichaIngreso(ficha) {
  const cie = texto(ficha?.codigo_cie_clinica);
  const enf = texto(ficha?.enfermedad);
  const cieLinea = cie && enf ? `${cie} — ${enf}` : cie || enf || "";
  return [
    texto(ficha?.sintomas) ? { key: "sintomas", label: "Síntomas", value: texto(ficha.sintomas) } : null,
    cieLinea ? { key: "cie", label: "Enfermedad / CIE", value: cieLinea } : null,
    texto(ficha?.detalle_clinico)
      ? { key: "detalle", label: "Detalle clínico", value: texto(ficha.detalle_clinico) }
      : null,
  ].filter(Boolean);
}
