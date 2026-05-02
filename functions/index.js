"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
/** Más memoria / tiempo de arranque para Cloud Run (evita fallos de healthcheck en cold start con Admin SDK). */
setGlobalOptions({
  region: "southamerica-east1",
  memory: "512MiB",
  timeoutSeconds: 120,
});

const login = require("./modules/login");
const rrhh = require("./modules/rrhh");
const catalogos = require("./modules/catalogos");
const onboarding = require("./modules/onboarding");

module.exports = {
  ...login,
  ...rrhh,
  ...catalogos,
  ...onboarding,
};
