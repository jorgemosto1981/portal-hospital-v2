"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ region: "southamerica-east1" });

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
