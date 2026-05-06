import { httpsCallable } from "firebase/functions";

import { getFunctionsV2 } from "./functionsV2.js";

/** Callable de comprobación (sin auth). */
export function callHealthV2() {
  return httpsCallable(getFunctionsV2(), "healthV2")();
}

/** Sincroniza claims de sesión: `persona_id`, `cuenta_id`, perfil laboral (`perfil_rol_id`, `cargo_activo`, …). */
export function callSyncSessionClaims() {
  return httpsCallable(getFunctionsV2(), "syncSessionClaims")();
}

/** RRHH: alta mínima persona + cuenta (Callable verifica `portal_role` o `perfil_rol_id` CFG_RRHH en token). */
export function callRrhhAltaAgente(data) {
  return httpsCallable(getFunctionsV2(), "rrhhAltaAgente")(data);
}

/** RRHH: actualizar estado de acceso de la cuenta por persona_id. */
export function callRrhhActualizarEstadoCuentaAcceso(data) {
  return httpsCallable(getFunctionsV2(), "rrhhActualizarEstadoCuentaAcceso")(data);
}

/** RRHH: aplicar baja laboral transaccional (cierra HLc vigentes + persona/cuenta). */
export function callRrhhAplicarBajaLaboral(data) {
  return httpsCallable(getFunctionsV2(), "rrhhAplicarBajaLaboral")(data);
}

/** RRHH: revoca sesión y reinicia vínculo Auth<->cuenta para re-vinculación por DNI. */
export function callRrhhReiniciarVinculacionCuenta(data) {
  return httpsCallable(getFunctionsV2(), "rrhhReiniciarVinculacionCuenta")(data);
}

/** RRHH: calcula antigüedad por persona y fecha de corte (default hoy). */
export function callRrhhCalcularAntiguedadPersona(data) {
  return httpsCallable(getFunctionsV2(), "rrhhCalcularAntiguedadPersona")(data);
}

/** RRHH: registra antigüedad externa reconocida (licencias) con fecha de impacto. */
export function callRrhhGuardarAntiguedadExternaPersona(data) {
  return httpsCallable(getFunctionsV2(), "rrhhGuardarAntiguedadExternaPersona")(data);
}

/** RRHH: elimina la antigüedad externa guardada para permitir nueva carga. */
export function callRrhhEliminarAntiguedadExternaPersona(data) {
  return httpsCallable(getFunctionsV2(), "rrhhEliminarAntiguedadExternaPersona")(data);
}

/** Primer acceso: DNI + email + PIN 6 (no requiere sesión previa del agente en Auth). */
export function callRegistroPrimerAcceso(data) {
  return httpsCallable(getFunctionsV2(), "registrarPrimerAcceso")(data);
}

/** Resuelve email (username) para DNI; luego el cliente hace signIn con email+PIN. Sin sesión. */
export function callResolverEmailLoginDni(data) {
  return httpsCallable(getFunctionsV2(), "resolverEmailLoginDni")(data);
}

/** RRHH: listar documentos de una colección de catálogo (incluye inactivos). */
export function callListarColeccion(data) {
  return httpsCallable(getFunctionsV2(), "listarColeccion")(data);
}

/** Temporal: lectura pública acotada a colecciones laborales mientras se ajustan Rules. */
export function callListarColeccionPublicaTemporal(data) {
  return httpsCallable(getFunctionsV2(), "listarColeccionPublicaTemporal")(data);
}

/** Temporal: alta/edición de registros laborales (HLc/HLd/HLg) para carga operativa. */
export function callGuardarRegistroLaboralTemporal(data) {
  return httpsCallable(getFunctionsV2(), "guardarRegistroLaboralTemporal")(data);
}

/** Read-model laboral operativo (C1) para Ticket/RDA/Grilla, con filtros por fecha/persona/grupo. */
export function callListarReadModelLaboralOperativoTemporal(data) {
  return httpsCallable(getFunctionsV2(), "listarReadModelLaboralOperativoTemporal")(data);
}

/** Temporal: alta/edición de datos personales (persona, formación, DDJJ, consentimientos). */
export function callGuardarRegistroPersonalTemporal(data) {
  return httpsCallable(getFunctionsV2(), "guardarRegistroPersonalTemporal")(data);
}

/** RRHH: marca una notificación de datos personales como vista. */
export function callRrhhMarcarEventoDatosPersonalesVisto(data) {
  return httpsCallable(getFunctionsV2(), "rrhhMarcarEventoDatosPersonalesVisto")(data);
}

/** RRHH: guardar opción de catálogo (`set` + merge, id en mayúsculas). */
export function callGuardarOpcion(data) {
  return httpsCallable(getFunctionsV2(), "guardarOpcion")(data);
}

/** Catálogos de solo lectura para el wizard (provincia, localidad, parentesco, grupos). */
export function callListarCatalogoOnboarding(data) {
  return httpsCallable(getFunctionsV2(), "listarCatalogoOnboarding")(data);
}

/** Vincular sesión de Auth a legajo pre-alta por DNI. */
export function callVincularCuentaConDni(data) {
  return httpsCallable(getFunctionsV2(), "vincularCuentaConDni")(data);
}

export function callOnboardingMvpPasoA(data) {
  return httpsCallable(getFunctionsV2(), "onboardingMvpPasoA")(data);
}

export function callOnboardingMvpDdjjFamiliar(data) {
  return httpsCallable(getFunctionsV2(), "onboardingMvpDdjjFamiliar")(data);
}

export function callOnboardingMvpOmitirDdjjFamiliar() {
  return httpsCallable(getFunctionsV2(), "onboardingMvpOmitirDdjjFamiliar")();
}

export function callOnboardingMvpCompletar() {
  return httpsCallable(getFunctionsV2(), "onboardingMvpCompletar")();
}

export function callNotificarCambioEmailAuth(data) {
  return httpsCallable(getFunctionsV2(), "notificarCambioEmailAuth")(data);
}

export function callNotificarCambioPasswordAuth(data = {}) {
  return httpsCallable(getFunctionsV2(), "notificarCambioPasswordAuth")(data);
}
