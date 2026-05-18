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
const persistirCheckinLaoBolsas = require("./onCall/solicitudes/persistirCheckinLaoBolsas");
const persistirCheckinSaldoEstandar = require("./onCall/solicitudes/persistirCheckinSaldoEstandar");
const cerrarCheckinSaldosPortal = require("./onCall/solicitudes/cerrarCheckinSaldosPortal");
const cerrarCheckinGlobal = require("./onCall/solicitudes/cerrarCheckinGlobal");
const obtenerSaldosCheckinPersona = require("./onCall/solicitudes/obtenerSaldosCheckinPersona");
const acreditarLaoBolsaAgente = require("./onCall/solicitudes/acreditarLaoBolsaAgente");
const solicitudArticuloTriggers = require("./triggers/solicitudArticuloLaoOnCreate");

module.exports = {
  ...login,
  ...rrhh,
  ...catalogos,
  ...onboarding,
  ...articulosCfg,
  ...solicitudesLao,
  ...persistirCheckinLaoBolsas,
  ...persistirCheckinSaldoEstandar,
  ...cerrarCheckinSaldosPortal,
  ...cerrarCheckinGlobal,
  ...obtenerSaldosCheckinPersona,
  ...acreditarLaoBolsaAgente,
  ...solicitudArticuloTriggers,
};
