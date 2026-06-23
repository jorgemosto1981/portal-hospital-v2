"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
/** Más memoria / tiempo de arranque para Cloud Run (evita fallos de healthcheck en cold start con Admin SDK). */
setGlobalOptions({
  region: "southamerica-east1",
  memory: "1GiB",
  cpu: 1,
  timeoutSeconds: 120,
  /** Necesario para callables desde el navegador (OPTIONS sin auth); si falta, CORS muestra 403. */
  invoker: "public",
});

const login = require("./modules/login");
const rrhh = require("./modules/rrhh");
const catalogos = require("./modules/catalogos");
const onboarding = require("./modules/onboarding");
const articulosCfg = require("./modules/articulosCfg");
const solicitudesLao = require("./onCall/solicitudes/simularLaoPreview");
const obtenerContextoBolsaLaoAgente = require("./onCall/solicitudes/obtenerContextoBolsaLaoAgente");
const persistirCheckinLaoBolsas = require("./onCall/solicitudes/persistirCheckinLaoBolsas");
const persistirCheckinSaldoEstandar = require("./onCall/solicitudes/persistirCheckinSaldoEstandar");
const cerrarCheckinSaldosPortal = require("./onCall/solicitudes/cerrarCheckinSaldosPortal");
const cerrarCheckinGlobal = require("./onCall/solicitudes/cerrarCheckinGlobal");
const obtenerSaldosCheckinPersona = require("./onCall/solicitudes/obtenerSaldosCheckinPersona");
const obtenerResumenAltaOnboardingPersona = require("./onCall/rrhh/obtenerResumenAltaOnboardingPersona");
const buscarPersonasCheckinRrhh = require("./onCall/rrhh/buscarPersonasCheckinRrhh");
const persistirCheckinSaldoEstandarLote = require("./onCall/solicitudes/persistirCheckinSaldoEstandarLote");
const acreditarLaoBolsaAgente = require("./onCall/solicitudes/acreditarLaoBolsaAgente");
const solicitudArticuloTriggers = require("./triggers/solicitudArticuloLaoOnCreate");
const solicitudPatronBTriggers = require("./triggers/solicitudArticuloPatronBOnCreate");
const solicitudPatronCTriggers = require("./triggers/solicitudArticuloPatronCOnCreate");
const resolverContextoLaboralSolicitud = require("./onCall/solicitudes/resolverContextoLaboralSolicitud");
const listarArticulosIngresoAgente = require("./onCall/solicitudes/listarArticulosIngresoAgente");
const previsualizarSolicitudPatronB = require("./onCall/solicitudes/previsualizarSolicitudPatronB");
const previsualizarSolicitudPatronC = require("./onCall/solicitudes/previsualizarSolicitudPatronC");
const validarEntornoOperativoSolicitud = require("./onCall/solicitudes/validarEntornoOperativoSolicitud");
const listarSolicitudesBandejaJefe = require("./onCall/solicitudes/listarSolicitudesBandejaJefe");
const resolverDecisionJefeSolicitud = require("./onCall/solicitudes/resolverDecisionJefeSolicitud");
const listarSolicitudesBandejaRrhh = require("./onCall/solicitudes/listarSolicitudesBandejaRrhh");
const resolverDecisionRrhhSolicitud = require("./onCall/solicitudes/resolverDecisionRrhhSolicitud");
const registrarTomaConocimientoRrhhSolicitud = require("./onCall/solicitudes/registrarTomaConocimientoRrhhSolicitud");
const reprocesarMdcSolicitudPatronB = require("./onCall/solicitudes/reprocesarMdcSolicitudPatronB");
const obtenerVistaGrillaMesAgente = require("./onCall/grilla/obtenerVistaGrillaMesAgente");
const obtenerResumenSolicitudArticuloGrilla = require("./onCall/grilla/obtenerResumenSolicitudArticuloGrilla");
const listarVistaGrillaMesPorGrupo = require("./onCall/grilla/listarVistaGrillaMesPorGrupo");
const cerrarPeriodoLiquidacion = require("./onCall/grilla/cerrarPeriodoLiquidacion");
const reabrirPeriodoLiquidacion = require("./onCall/grilla/reabrirPeriodoLiquidacion");
const consultarEstadosPeriodoLiquidacionGrupo = require("./onCall/grilla/consultarEstadosPeriodoLiquidacionGrupo");
const planesTurnoServicio = require("./modules/asistencia/planesTurnoServicio");
const cambiosTurno = require("./modules/asistencia/cambiosTurno");
const rematerializacion = require("./modules/asistencia/rematerializacion");
const { materializacionVentanaDia5Scheduled } = require("./onSchedule/materializacionVentanaDia5");
const { ejecutarMaterializacionVentanaDia5 } = require("./onCall/grilla/ejecutarMaterializacionVentanaDia5");
const reconciliarMarcasHuerfanasReloj = require("./onCall/fichadas/reconciliarMarcasHuerfanasReloj");
const guardarCapaFichadaDia = require("./onCall/fichadas/guardarCapaFichadaDia");
const aplicarImportFichadasReloj = require("./onCall/fichadas/aplicarImportFichadasReloj");
const previsualizarImportFichadasReloj = require("./onCall/fichadas/previsualizarImportFichadasReloj");
const listarMarcasHuerfanasReloj = require("./onCall/fichadas/listarMarcasHuerfanasReloj");
const descartarMarcaHuerfanaReloj = require("./onCall/fichadas/descartarMarcaHuerfanaReloj");
const guardarEnrolamientoRelojPersona = require("./onCall/fichadas/guardarEnrolamientoRelojPersona");
const listarEnrolamientoRelojPorPersona = require("./onCall/fichadas/listarEnrolamientoRelojPorPersona");
const guardarCfgRelojBiometrico = require("./onCall/fichadas/guardarCfgRelojBiometrico");
const listarCfgRelojBiometrico = require("./onCall/fichadas/listarCfgRelojBiometrico");
const listarRosterParaFichadas = require("./onCall/fichadas/listarRosterParaFichadas");
const colaRematerializacionTriggers = require("./triggers/onColaRematerializacionAsistencia");
const grillaSyncGrupoMesTriggers = require("./triggers/onGrillaSyncGrupoMes");
const solicitarReconciliacionGrillaGrupoMes = require("./onCall/grilla/solicitarReconciliacionGrillaGrupoMes");

module.exports = {
  ...login,
  ...rrhh,
  ...catalogos,
  ...onboarding,
  ...articulosCfg,
  ...solicitudesLao,
  ...obtenerContextoBolsaLaoAgente,
  ...persistirCheckinLaoBolsas,
  ...persistirCheckinSaldoEstandar,
  ...cerrarCheckinSaldosPortal,
  ...cerrarCheckinGlobal,
  ...obtenerSaldosCheckinPersona,
  ...obtenerResumenAltaOnboardingPersona,
  ...buscarPersonasCheckinRrhh,
  ...persistirCheckinSaldoEstandarLote,
  ...acreditarLaoBolsaAgente,
  ...solicitudArticuloTriggers,
  ...solicitudPatronBTriggers,
  ...solicitudPatronCTriggers,
  ...resolverContextoLaboralSolicitud,
  ...listarArticulosIngresoAgente,
  ...previsualizarSolicitudPatronB,
  ...previsualizarSolicitudPatronC,
  ...validarEntornoOperativoSolicitud,
  ...listarSolicitudesBandejaJefe,
  ...resolverDecisionJefeSolicitud,
  ...listarSolicitudesBandejaRrhh,
  ...resolverDecisionRrhhSolicitud,
  ...registrarTomaConocimientoRrhhSolicitud,
  ...reprocesarMdcSolicitudPatronB,
  ...obtenerVistaGrillaMesAgente,
  ...obtenerResumenSolicitudArticuloGrilla,
  ...listarVistaGrillaMesPorGrupo,
  ...solicitarReconciliacionGrillaGrupoMes,
  ...cerrarPeriodoLiquidacion,
  ...reabrirPeriodoLiquidacion,
  ...consultarEstadosPeriodoLiquidacionGrupo,
  ...planesTurnoServicio,
  ...cambiosTurno,
  ...rematerializacion,
  materializacionVentanaDia5Scheduled,
  ejecutarMaterializacionVentanaDia5,
  ...reconciliarMarcasHuerfanasReloj,
  ...guardarCapaFichadaDia,
  ...aplicarImportFichadasReloj,
  ...previsualizarImportFichadasReloj,
  ...listarMarcasHuerfanasReloj,
  ...descartarMarcaHuerfanaReloj,
  ...guardarEnrolamientoRelojPersona,
  ...listarEnrolamientoRelojPorPersona,
  ...guardarCfgRelojBiometrico,
  ...listarCfgRelojBiometrico,
  ...listarRosterParaFichadas,
  ...colaRematerializacionTriggers,
  ...grillaSyncGrupoMesTriggers,
};
