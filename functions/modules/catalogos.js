"use strict";

const {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
} = require("./catalogosCore");
const {
  guardarRegistroLaboralTemporal,
  rrhhDeshabilitarHlc,
  listarReadModelLaboralOperativoTemporal,
} = require("./catalogosLaborales");
const {
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
  rrhhListarBandejaEventos,
} = require("./catalogosPersonales");

module.exports = {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
  guardarRegistroLaboralTemporal,
  rrhhDeshabilitarHlc,
  listarReadModelLaboralOperativoTemporal,
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
  rrhhListarBandejaEventos,
};

