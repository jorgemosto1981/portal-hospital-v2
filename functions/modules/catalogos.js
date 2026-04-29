"use strict";

const {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
} = require("./catalogosCore");
const { guardarRegistroLaboralTemporal, listarReadModelLaboralOperativoTemporal } = require("./catalogosLaborales");
const { guardarRegistroPersonalTemporal } = require("./catalogosPersonales");

module.exports = {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
  guardarRegistroLaboralTemporal,
  listarReadModelLaboralOperativoTemporal,
  guardarRegistroPersonalTemporal,
};

