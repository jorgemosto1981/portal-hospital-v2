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

module.exports = {
  ...login,
  ...rrhh,
  ...catalogos,
  ...onboarding,
  ...articulosCfg,
};
