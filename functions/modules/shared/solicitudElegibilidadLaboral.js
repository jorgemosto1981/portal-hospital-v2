"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { calcularAntiguedad } = require("./antiguedadCalculator");
const { isHlcVigenteEnFecha } = require("./hlcVigenciaFecha");

/**
 * Elegibilidad laboral y circuito de ingreso para alta de solicitud.
 * @see docs/v2/RFC_TICKETERA_SLICE_64A_MVP_V2.md
 */


const CFG_USUARIO = "CFG_USUARIO";

/** Roles de login que heredan menú y flujos del agente (usuario + extras). */
const PORTAL_ROLES_FLUJO_AGENTE = [
  "usuario",
  "rrhh",
  "admin",
  "medico",
  "jefe",
  "visualizador",
];
const CODIGO_CIRCUITO_ROL = "CIRCUITO_ROL";
const CODIGO_ELEG_SIN_HLC = "ELEG_SIN_HLC";
const CODIGO_ELEG_ESCALAFON = "ELEG_ESCALAFON";
const CODIGO_ELEG_AGRUPAMIENTO = "ELEG_AGRUPAMIENTO";
const CODIGO_ELEG_CARGO = "ELEG_CARGO";
const CODIGO_ELEG_VINCULO = "ELEG_VINCULO";
const CODIGO_ELEG_ANTIGUEDAD = "ELEG_ANTIGUEDAD";
const CODIGO_ELEG_PERSONA = "ELEG_PERSONA";
const CODIGO_SALDO_CICLO = "SALDO_CICLO";
const CODIGO_SALDO_MES = "SALDO_MES";
const CODIGO_SALDO_EVENTO = "SALDO_EVENTO";
const CODIGO_FECHA_RANGO = "FECHA_RANGO";

const MENSAJES = {
  [CODIGO_CIRCUITO_ROL]: "Tu perfil no puede iniciar solicitudes de este artículo.",
  [CODIGO_ELEG_SIN_HLC]: "No tenés un cargo vigente para la fecha elegida.",
  [CODIGO_ELEG_ESCALAFON]: "Este artículo no aplica a tu escalafón vigente.",
  [CODIGO_ELEG_AGRUPAMIENTO]: "Tu agrupamiento no está habilitado para este artículo.",
  [CODIGO_ELEG_CARGO]: "Tu cargo no está habilitado para este artículo.",
  [CODIGO_ELEG_VINCULO]: "Tu tipo de vínculo no está habilitado.",
  [CODIGO_ELEG_ANTIGUEDAD]: "No alcanzás la antigüedad mínima requerida.",
  [CODIGO_ELEG_PERSONA]: "Este artículo no está disponible para tu legajo.",
  ELEG_GRUPO: "Tu grupo de trabajo no está habilitado para este artículo.",
  [CODIGO_SALDO_CICLO]: "No hay saldo disponible en el ciclo.",
  [CODIGO_SALDO_MES]: "Ya usaste la solicitud permitida este mes.",
  [CODIGO_SALDO_EVENTO]: "Este artículo permite un solo día por solicitud.",
  [CODIGO_FECHA_RANGO]: "Revisá las fechas del pedido.",
};

/**
 * ¿Puede actuar como agente en solicitudes? (menú Rol usuario para todos los roles con extras.)
 * @param {unknown} token
 */
function isPortalRoleUsuario(token) {
  if (!token || typeof token !== "object") return false;
  const role = typeof token.portal_role === "string" ? token.portal_role.trim().toLowerCase() : "";
  if (PORTAL_ROLES_FLUJO_AGENTE.includes(role)) return true;
  const perfil = typeof token.perfil_rol_id === "string" ? token.perfil_rol_id.trim().toUpperCase() : "";
  return perfil === "CFG_RRHH";
}

/**
 * @param {unknown} row
 */
function mapHlcRow(row, hlcId = "") {
  const r = row && typeof row === "object" ? row : {};
  return {
    ...r,
    id: String(hlcId || r.id || "").trim(),
    fecha_inicio: r.fecha_inicio || r.fecha_desde || null,
    fecha_fin: r.fecha_fin || r.fecha_hasta || null,
    escalafon_id: String(r.escalafon_id || r.escalafon || "").trim(),
    agrupamiento_id: String(r.agrupamiento_id || r.agrupamiento || "").trim(),
    cargo_funcional_id: String(r.cargo_funcional_id || "").trim(),
    tipo_vinculo_id: String(r.tipo_vinculo_id || r.tipo_vinculo || "").trim(),
    grupo_de_trabajo_id: String(r.grupo_de_trabajo_id || "").trim(),
    rol_id: String(r.rol_id || "").trim(),
  };
}

/**
 * @param {Array<Record<string, unknown>>} hlcArray
 * @param {string} fechaDesde
 */
function filterHlcVigentesEnFecha(hlcArray, fechaDesde) {
  return (hlcArray || []).filter((row) => isHlcVigenteEnFecha(row, fechaDesde));
}

/**
 * @param {string[]} ids
 * @param {string} value
 */
function listaPermite(ids, value) {
  const list = Array.isArray(ids) ? ids.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (list.length === 0) return true;
  const v = String(value || "").trim();
  return v && list.includes(v);
}

/**
 * @param {Record<string, unknown>} filtros
 * @param {Record<string, unknown>} hlc
 * @param {string} personaId
 * @param {number} antiguedadMeses
 * @returns {string | null} código error o null si OK
 */
function evaluarFiltrosElegibilidadHlc(filtros, hlc, personaId, antiguedadMeses) {
  const f = filtros && typeof filtros === "object" ? filtros : {};
  if (!listaPermite(f.escalafon_ids, hlc.escalafon_id)) return CODIGO_ELEG_ESCALAFON;
  if (!listaPermite(f.agrupamiento_ids, hlc.agrupamiento_id)) return CODIGO_ELEG_AGRUPAMIENTO;
  if (!listaPermite(f.cargo_funcional_ids, hlc.cargo_funcional_id)) return CODIGO_ELEG_CARGO;
  if (!listaPermite(f.tipo_vinculo_ids, hlc.tipo_vinculo_id)) return CODIGO_ELEG_VINCULO;
  if (!listaPermite(f.grupo_trabajo_ids, hlc.grupo_de_trabajo_id)) return "ELEG_GRUPO";

  const personaIds = f.persona_ids;
  if (Array.isArray(personaIds) && personaIds.length > 0) {
    const pid = String(personaId || "").trim();
    if (!personaIds.map((x) => String(x || "").trim()).includes(pid)) return CODIGO_ELEG_PERSONA;
  }

  const minMeses = Number(f.antiguedad_minima_meses);
  if (Number.isFinite(minMeses) && minMeses > 0 && antiguedadMeses < minMeses) {
    return CODIGO_ELEG_ANTIGUEDAD;
  }

  return null;
}

/**
 * D4: login agente + rol HLC en circuito.
 * @param {Record<string, unknown>} versionData
 * @param {unknown} authToken
 * @param {Record<string, unknown>} hlc
 */
function evaluarCircuitoIngreso(versionData, authToken, hlc, opts = {}) {
  if (!opts.skipPortalRoleCheck && !isPortalRoleUsuario(authToken)) return CODIGO_CIRCUITO_ROL;

  const bloque = versionData?.bloque_workflow_sla_cobertura;
  const circuito = bloque && typeof bloque === "object" ? bloque.circuito_ingreso_ids : [];
  const list = Array.isArray(circuito) ? circuito.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (list.length === 0) return CODIGO_CIRCUITO_ROL;

  const rolHlc = String(hlc.rol_id || "").trim();
  if (!rolHlc || !list.includes(rolHlc)) return CODIGO_CIRCUITO_ROL;

  return null;
}

/**
 * @param {number} diasExternos
 * @param {Array<Record<string, unknown>>} hlcArray
 * @param {string} fechaDesde
 */
function computeAntiguedadMeses(hlcArray, fechaDesde, diasExternos = 0) {
  try {
    const r = calcularAntiguedad(hlcArray, fechaDesde, diasExternos);
    const años = Number(r.años) || 0;
    const meses = Number(r.meses) || 0;
    return años * 12 + meses;
  } catch {
    return 0;
  }
}

/**
 * @param {{
 *   versionData: Record<string, unknown>,
 *   hlcVigentes: Array<Record<string, unknown>>,
 *   personaId: string,
 *   fechaDesde: string,
 *   diasExternos?: number,
 *   authToken?: unknown,
 * }} params
 */
function resolverElegibilidadSolicitud(params) {
  const {
    versionData,
    hlcVigentes,
    personaId,
    fechaDesde,
    diasExternos = 0,
    authToken,
    skipPortalRoleCheck = false,
  } = params;
  const hlcArray = (hlcVigentes || []).map((h) => mapHlcRow(h, h.id));

  if (hlcArray.length === 0) {
    return {
      ok: false,
      codigos: [CODIGO_ELEG_SIN_HLC],
      mensajes: [MENSAJES[CODIGO_ELEG_SIN_HLC]],
      hlc_id: null,
    };
  }

  const filtros = versionData?.bloque_elegibilidad_filtros || {};
  const antiguedadMeses = computeAntiguedadMeses(hlcArray, fechaDesde, diasExternos);

  for (const hlc of hlcArray) {
    const codEleg = evaluarFiltrosElegibilidadHlc(filtros, hlc, personaId, antiguedadMeses);
    if (codEleg) continue;

    const codCircuito = evaluarCircuitoIngreso(versionData, authToken, hlc, { skipPortalRoleCheck });
    if (codCircuito) continue;

    return {
      ok: true,
      codigos: [],
      mensajes: [],
      hlc_id: hlc.id || null,
      hlc,
      antiguedad_meses: antiguedadMeses,
    };
  }

  const codigos = [];
  const lastHlc = hlcArray[0];
  const c1 = evaluarFiltrosElegibilidadHlc(filtros, lastHlc, personaId, antiguedadMeses);
  const c2 = evaluarCircuitoIngreso(versionData, authToken, lastHlc);
  if (c2) codigos.push(c2);
  else if (c1) codigos.push(c1);
  else codigos.push(CODIGO_ELEG_ESCALAFON);

  const uniq = [...new Set(codigos)];
  return {
    ok: false,
    codigos: uniq,
    mensajes: uniq.map((c) => MENSAJES[c] || "No cumple requisitos del artículo."),
    hlc_id: null,
  };
}

function mensajeParaCodigo(codigo) {
  return MENSAJES[codigo] || "No cumple requisitos del artículo.";
}

module.exports = { CFG_USUARIO, PORTAL_ROLES_FLUJO_AGENTE, CODIGO_CIRCUITO_ROL, CODIGO_ELEG_SIN_HLC, CODIGO_ELEG_ESCALAFON, CODIGO_ELEG_AGRUPAMIENTO, CODIGO_ELEG_CARGO, CODIGO_ELEG_VINCULO, CODIGO_ELEG_ANTIGUEDAD, CODIGO_ELEG_PERSONA, CODIGO_SALDO_CICLO, CODIGO_SALDO_MES, CODIGO_SALDO_EVENTO, CODIGO_FECHA_RANGO, isPortalRoleUsuario, mapHlcRow, filterHlcVigentesEnFecha, evaluarFiltrosElegibilidadHlc, evaluarCircuitoIngreso, computeAntiguedadMeses, resolverElegibilidadSolicitud, mensajeParaCodigo };
