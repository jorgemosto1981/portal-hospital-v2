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

/** Paso 1 wizard LAO — bolsas y versión publicada (`obtenerContextoBolsaLaoAgente`). */
export function callObtenerContextoBolsaLaoAgente(data) {
  return httpsCallable(getFunctionsV2(), "obtenerContextoBolsaLaoAgente")(data);
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

/** Preview Patrón C (elegibilidad + saldo global, horas) sin crear solicitud. */
export function callPrevisualizarSolicitudPatronC(data) {
  return httpsCallable(getFunctionsV2(), "previsualizarSolicitudPatronC")(data);
}

/** Paso 2 wizard Patrón B: entorno operativo (HLg, turno, grilla RDA) sin motor de saldos. */
export function callValidarEntornoOperativoSolicitud(data) {
  return httpsCallable(getFunctionsV2(), "validarEntornoOperativoSolicitud")(data);
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

/** Registrar toma de conocimiento RRHH (solicitud ya cfg_esa_aprobada). */
export function callRegistrarTomaConocimientoRrhhSolicitud(data) {
  return httpsCallable(getFunctionsV2(), "registrarTomaConocimientoRrhhSolicitud")(data);
}

/** Oleada C — vista mensual `vistas_grilla_mes_agente` (bounded context gdt). */
export function callObtenerVistaGrillaMesAgente(data) {
  const payload = data && typeof data === "object" ? data : {};
  const gdt = String(payload.grupo_trabajo_id || payload.grupo_id || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return Promise.reject(new Error("grupo_trabajo_id (gdt_*) es obligatorio para la vista mensual."));
  }
  const persona_id = String(payload.persona_id || "").trim();
  if (!/^per_/i.test(persona_id)) {
    return Promise.reject(new Error("persona_id inválido para la vista mensual."));
  }
  const dia_key = String(payload.dia_key || "").trim();
  return httpsCallable(getFunctionsV2(), "obtenerVistaGrillaMesAgente")({
    persona_id,
    anio: Number(payload.anio),
    mes: Number(payload.mes),
    grupo_trabajo_id: gdt,
    ...(dia_key ? { dia_key } : {}),
  });
}

/** Resumen lectura solicitud desde grilla GSO (Oleada C3). */
export function callObtenerResumenSolicitudArticuloGrilla(data) {
  return httpsCallable(getFunctionsV2(), "obtenerResumenSolicitudArticuloGrilla")(data);
}

/** Oleada C2 — matriz mes × personas de un grupo (HLg vigente a fin de mes). */
export function callListarVistaGrillaMesPorGrupo(data) {
  return httpsCallable(getFunctionsV2(), "listarVistaGrillaMesPorGrupo")(data);
}

/** RRHH: cierra liquidación del mes en todas las vis_* del grupo (freeze). */
export function callCerrarPeriodoLiquidacion(data) {
  return httpsCallable(getFunctionsV2(), "cerrarPeriodoLiquidacion")(data);
}

/** RRHH: reabre período cerrado (motivo obligatorio). */
export function callReabrirPeriodoLiquidacion(data) {
  return httpsCallable(getFunctionsV2(), "reabrirPeriodoLiquidacion")(data);
}

/** RRHH: consulta si el período está cerrado por grupo/mes (tarjetas GSO). */
export function callConsultarEstadosPeriodoLiquidacionGrupo(data) {
  return httpsCallable(getFunctionsV2(), "consultarEstadosPeriodoLiquidacionGrupo")(data);
}

/** RRHH: crear o actualizar un régimen horario (cfg_regimen_horario). */
export function callGuardarRegimenHorario(data) {
  return httpsCallable(getFunctionsV2(), "guardarRegimenHorario")(data);
}

/** RRHH: listar todos los regímenes horarios. */
export function callListarRegimenesHorarios(data) {
  return httpsCallable(getFunctionsV2(), "listarRegimenesHorarios")(data || {});
}

/** Catálogos cfg asistencia/turnos (A0): tcc, epl, cdc, tov. */
export function callListarCatalogosAsistenciaTurnos(data) {
  return httpsCallable(getFunctionsV2(), "listarCatalogosAsistenciaTurnos")(data || {});
}

/** Jefe/RRHH: crear o actualizar plan de turno (BORRADOR). */
export function callGuardarPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "guardarPlanTurnoServicio")(data);
}

/** Jefe: crea plt_inc en BORRADOR vinculado a plan principal HABILITADO. */
export function callIniciarIncorporacionPlanMensual(data) {
  return httpsCallable(getFunctionsV2(), "iniciarIncorporacionPlanMensual")(data);
}

/** Jefe: enviar plan para aprobación (BORRADOR → ENVIADO). */
export function callEnviarPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "enviarPlanTurnoServicio")(data);
}

/** Superior o RRHH: aprobar plan (ENVIADO → HABILITADO + materialización). */
export function callAprobarPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "aprobarPlanTurnoServicio")(data);
}

/** Superior/RRHH: rechazar plan (ENVIADO|EN_REVISION → BORRADOR). */
export function callRechazarPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "rechazarPlanTurnoServicio")(data);
}

/** RRHH: revertir plan habilitado a revisión (HABILITADO → EN_REVISION). */
export function callRevertirPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "revertirPlanTurnoServicio")(data);
}

/** RRHH: eliminar plan de turno (borrado lógico). */
export function callEliminarPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "eliminarPlanTurnoServicio")(data);
}

/** RRHH: bandeja cross-grupo de planes pendientes (ENVIADO + EN_REVISION). */
export function callListarPlanesPendientesRrhh(data) {
  return httpsCallable(getFunctionsV2(), "listarPlanesPendientesRrhh")(data);
}

/** RRHH: cerrar plan perpetuo (HABILITADO → CERRADO). */
export function callCerrarPlanPerpetuo(data) {
  return httpsCallable(getFunctionsV2(), "cerrarPlanPerpetuo")(data);
}

/** Listar planes de un grupo (filtro opcional por estado/periodo). */
export function callListarPlanesTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "listarPlanesTurnoServicio")(data);
}

/** Contexto enriquecido para grilla del jefe: personas + regímenes del grupo. */
export function callListarContextoPlanGrupo(data) {
  return httpsCallable(getFunctionsV2(), "listarContextoPlanGrupo")(data);
}

/** Vista unificada de plan (grilla_aprobada SoT para VER plan). */
export function callObtenerVistaPlanTurnoServicio(data) {
  return httpsCallable(getFunctionsV2(), "obtenerVistaPlanTurnoServicio")(data);
}

/** Registrar override puntual en asistencia_diaria (requiere grupo_trabajo_id en coberturas). */
export function callRegistrarCambioTurno(data) {
  const payload = data && typeof data === "object" ? data : {};
  const gdt = String(payload.grupo_trabajo_id || payload.grupo_id || payload.context?.grupo_id || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return Promise.reject(new Error("grupo_trabajo_id (gdt_*) es obligatorio para registrar cambios de turno."));
  }
  return httpsCallable(getFunctionsV2(), "registrarCambioTurno")({
    ...payload,
    grupo_trabajo_id: gdt,
  });
}

/** Aplicar lote atómico de operaciones de asistencia (outbox E2). */
export function callAplicarBatchAsistencia(data) {
  return httpsCallable(getFunctionsV2(), "aplicarBatchAsistencia", { timeout: 120000 })(data);
}

/** Eliminar (soft-delete) un override por índice. */
export function callEliminarCambioTurno(data) {
  return httpsCallable(getFunctionsV2(), "eliminarCambioTurno")(data);
}

/** Listar overrides activos de un agente para una fecha. */
export function callListarOverridesTurno(data) {
  return httpsCallable(getFunctionsV2(), "listarOverridesTurno")(data);
}

/** Registra consulta ligera al abrir detalle de día con gestión turno aplicada. */
export function callRegistrarConsultaGestionTurnoGrilla(data) {
  const payload = data && typeof data === "object" ? data : {};
  const gdt = String(payload.grupo_trabajo_id || payload.grupo_id || "").trim();
  return httpsCallable(getFunctionsV2(), "registrarConsultaGestionTurnoGrilla")({
    persona_id: String(payload.persona_id || "").trim(),
    fecha: String(payload.fecha || "").trim(),
    grupo_trabajo_id: gdt,
    override_refs: Array.isArray(payload.override_refs) ? payload.override_refs : [],
    op_batch_ids: Array.isArray(payload.op_batch_ids) ? payload.op_batch_ids : [],
  });
}

/** Materializa capa teórica de un solo día (F-UX.3 — gate celda). */
export function callMaterializarTurnoTeoricoDia(data) {
  const payload = data && typeof data === "object" ? data : {};
  const gdt = String(payload.grupo_trabajo_id || payload.grupo_id || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return Promise.reject(new Error("grupo_trabajo_id (gdt_*) es obligatorio para materializar el día."));
  }
  return httpsCallable(getFunctionsV2(), "materializarTurnoTeoricoDia", { timeout: 120000 })({
    persona_id: String(payload.persona_id || "").trim(),
    fecha: String(payload.fecha || "").trim(),
    grupo_trabajo_id: gdt,
  });
}

/** Capa teórica materializada de un día (segmentos + token concurrencia) por gdt. */
export function callObtenerCapaTeoricaDia(data) {
  const payload = data && typeof data === "object" ? data : {};
  const gdt = String(payload.grupo_trabajo_id || payload.grupo_id || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return Promise.reject(new Error("grupo_trabajo_id (gdt_*) es obligatorio para la capa teórica del día."));
  }
  const persona_id = String(payload.persona_id || "").trim();
  const fecha = String(payload.fecha || "").trim();
  return httpsCallable(getFunctionsV2(), "obtenerCapaTeoricaDia")({
    persona_id,
    fecha,
    grupo_trabajo_id: gdt,
  });
}

/** Re-materializar tras cambio de calendario institucional (solo RRHH). */
export function callRematerializarPostCalendario(data) {
  return httpsCallable(getFunctionsV2(), "rematerializarPostCalendario", { timeout: 540000 })(data);
}

/** Re-materializar agentes de un régimen tras edición (solo RRHH). */
export function callRematerializarPostRegimen(data) {
  return httpsCallable(getFunctionsV2(), "rematerializarPostRegimen", { timeout: 540000 })(data);
}

/** Preview import TXT fichadas — solo memoria (Fase D). */
export function callPrevisualizarImportFichadasReloj(data) {
  return httpsCallable(getFunctionsV2(), "previsualizarImportFichadasReloj", { timeout: 120000 })(data);
}

/** Apply import TXT fichadas (map-reduce vis_*). */
export function callAplicarImportFichadasReloj(data) {
  return httpsCallable(getFunctionsV2(), "aplicarImportFichadasReloj", { timeout: 300000 })(data);
}

/** Roster agentes para carga manual (sector o GLOBAL con enrolamiento). */
export function callListarRosterParaFichadas(data) {
  return httpsCallable(getFunctionsV2(), "listarRosterParaFichadas", { timeout: 120000 })(data);
}

/** Bandeja marcas huérfanas — índice (reloj_id, estado, fecha_ymd). */
export function callListarMarcasHuerfanasReloj(data) {
  return httpsCallable(getFunctionsV2(), "listarMarcasHuerfanasReloj")(data);
}

export function callDescartarMarcaHuerfanaReloj(data) {
  return httpsCallable(getFunctionsV2(), "descartarMarcaHuerfanaReloj")(data);
}

export function callGuardarEnrolamientoRelojPersona(data) {
  return httpsCallable(getFunctionsV2(), "guardarEnrolamientoRelojPersona", { timeout: 300000 })(data);
}

/** Consulta enrolamientos tarjeta ↔ persona por persona_id (sin listar colección completa). */
export function callListarEnrolamientoRelojPorPersona(data) {
  return httpsCallable(getFunctionsV2(), "listarEnrolamientoRelojPorPersona")(data);
}

export function callReconciliarMarcasHuerfanasReloj(data) {
  return httpsCallable(getFunctionsV2(), "reconciliarMarcasHuerfanasReloj", { timeout: 300000 })(data);
}

/** Capa fichada día (ABM / carga manual / undo). */
export function callGuardarCapaFichadaDia(data) {
  return httpsCallable(getFunctionsV2(), "guardarCapaFichadaDia", { timeout: 120000 })(data);
}

/** Alta/edición cfg_reloj_biometrico (solo RRHH, Admin SDK). */
export function callGuardarCfgRelojBiometrico(data) {
  return httpsCallable(getFunctionsV2(), "guardarCfgRelojBiometrico", { timeout: 60000 })(data);
}

/** Listado cfg_reloj_biometrico para carga manual / import (RRHH). */
export function callListarCfgRelojBiometrico(data = {}) {
  return httpsCallable(getFunctionsV2(), "listarCfgRelojBiometrico")(data);
}
