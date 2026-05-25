"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
/** Más memoria / tiempo de arranque para Cloud Run (evita fallos de healthcheck en cold start con Admin SDK). */
setGlobalOptions({
  region: "southamerica-east1",
  memory: "512MiB",
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
const planesTurnoServicio = require("./modules/asistencia/planesTurnoServicio");

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
  ...planesTurnoServicio,
};
