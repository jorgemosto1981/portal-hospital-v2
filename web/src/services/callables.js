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

/** RRHH: listar subcolección `cfg_articulos/{articuloId}/versiones` vía Admin (evita fallos de Rules en cliente). */
export function callListarVersionesCfgArticulo(data) {
  return httpsCallable(getFunctionsV2(), "listarVersionesCfgArticulo")(data);
}

/** Temporal: lectura pública acotada a colecciones laborales mientras se ajustan Rules. */
export function callListarColeccionPublicaTemporal(data) {
  return httpsCallable(getFunctionsV2(), "listarColeccionPublicaTemporal")(data);
}

/** Temporal: alta/edición de registros laborales (HLc/HLd/HLg) para carga operativa. */
export function callGuardarRegistroLaboralTemporal(data) {
  return httpsCallable(getFunctionsV2(), "guardarRegistroLaboralTemporal")(data);
}

/** RRHH: deshabilita un ciclo HLc y cierra cadena HLd/HLg asociada. */
export function callRrhhDeshabilitarHlc(data) {
  return httpsCallable(getFunctionsV2(), "rrhhDeshabilitarHlc")(data);
}

/** Deshabilita una asignación HLg (activo=false, fecha_fin=corte). */
export function callRrhhDeshabilitarHlg(data) {
  return httpsCallable(getFunctionsV2(), "rrhhDeshabilitarHlg")(data);
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

/** RRHH: lista paginada de eventos operativos desde read model `eventos_bandeja_rrhh`. */
export function callRrhhListarBandejaEventos(data) {
  return httpsCallable(getFunctionsV2(), "rrhhListarBandejaEventos")(data);
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

/** Seguridad sesión: registra login/sesión activa y detecta concurrencia reciente. */
export function callRegistrarSesionActiva(data) {
  return httpsCallable(getFunctionsV2(), "registrarSesionActiva")(data);
}

/** Seguridad sesión: verifica concurrencia y opcionalmente actualiza latido con throttle. */
export function callVerificarSesionConcurrente(data) {
  return httpsCallable(getFunctionsV2(), "verificarSesionConcurrente")(data);
}

/** Preview motor LAO (callable `simularLaoPreview`). */
export function callSimularLaoPreview(data) {
  return httpsCallable(getFunctionsV2(), "simularLaoPreview")(data);
}

/** Check-in LAO histórico → bolsas (callable `persistirCheckinLaoBolsas`). */
export function callPersistirCheckinLaoBolsas(data) {
  return httpsCallable(getFunctionsV2(), "persistirCheckinLaoBolsas")(data);
}

/** Check-in Patrón B / C (`persistirCheckinSaldoEstandar`). */
export function callPersistirCheckinSaldoEstandar(data) {
  return httpsCallable(getFunctionsV2(), "persistirCheckinSaldoEstandar")(data);
}

/** Check-in RRHH: guardado atómico de varias bolsas patrón B o C (`persistirCheckinSaldoEstandarLote`). */
export function callPersistirCheckinSaldoEstandarLote(data) {
  return httpsCallable(getFunctionsV2(), "persistirCheckinSaldoEstandarLote")(data);
}

/** Check-in / guía alta: búsqueda acotada de personas activas. */
export function callBuscarPersonasCheckinRrhh(data) {
  return httpsCallable(getFunctionsV2(), "buscarPersonasCheckinRrhh")(data);
}

/** Cierra el check-in global de la persona (`cerrarCheckinGlobal`). */
export function callCerrarCheckinGlobal(data) {
  return httpsCallable(getFunctionsV2(), "cerrarCheckinGlobal")(data);
}

/** @deprecated Usar `callCerrarCheckinGlobal`. */
export function callCerrarCheckinSaldosPortal(data) {
  return callCerrarCheckinGlobal(data);
}

/** Bolsas existentes para precargar check-in RRHH (`obtenerSaldosCheckinPersona`). */
export function callObtenerSaldosCheckinPersona(data) {
  return httpsCallable(getFunctionsV2(), "obtenerSaldosCheckinPersona")(data);
}

/** RRHH: cuenta + HLc operativos de una persona (guía alta, sin listar colecciones enteras). */
export function callObtenerResumenAltaOnboardingPersona(data) {
  return httpsCallable(getFunctionsV2(), "obtenerResumenAltaOnboardingPersona")(data);
}

/** Acreditación LAO motor por agente/ejercicio (callable `acreditarLaoBolsaAgente`). */
export function callAcreditarLaoBolsaAgente(data) {
  return httpsCallable(getFunctionsV2(), "acreditarLaoBolsaAgente")(data);
}

/** Contexto laboral vigente en fecha_desde (slice 64-A). */
export function callResolverContextoLaboralSolicitud(data) {
  return httpsCallable(getFunctionsV2(), "resolverContextoLaboralSolicitud")(data);
}

/** Artículos Patrón B elegibles para el agente en fecha_desde. */
export function callListarArticulosIngresoAgente(data) {
  return httpsCallable(getFunctionsV2(), "listarArticulosIngresoAgente")(data);
}

/** Preview Patrón B (elegibilidad + saldos) sin crear solicitud. */
export function callPrevisualizarSolicitudPatronB(data) {
  return httpsCallable(getFunctionsV2(), "previsualizarSolicitudPatronB")(data);
}

/** Bandeja jefe: solicitudes en revisión jerárquica. */
export function callListarSolicitudesBandejaJefe(data) {
  return httpsCallable(getFunctionsV2(), "listarSolicitudesBandejaJefe")(data || {});
}

/** Aprobar (→ RRHH) o rechazar solicitud en bandeja jefe. */
export function callResolverDecisionJefeSolicitud(data) {
  return httpsCallable(getFunctionsV2(), "resolverDecisionJefeSolicitud")(data);
}

/** Bandeja RRHH: solicitudes en revisión RRHH (post jefe). */
export function callListarSolicitudesBandejaRrhh(data) {
  return httpsCallable(getFunctionsV2(), "listarSolicitudesBandejaRrhh")(data || {});
}

/** Aprobar (definitivo) o rechazar solicitud en bandeja RRHH. */
export function callResolverDecisionRrhhSolicitud(data) {
  return httpsCallable(getFunctionsV2(), "resolverDecisionRrhhSolicitud")(data);
}
