"use strict";

const {
  listarColeccion,
  listarVersionesCfgArticulo,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
} = require("./catalogosCore");
const {
  guardarRegistroLaboralTemporal,
  rrhhDeshabilitarHlc,
  rrhhDeshabilitarHlg,
  listarReadModelLaboralOperativoTemporal,
} = require("./catalogosLaborales");
const {
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
  rrhhListarBandejaEventos,
} = require("./catalogosPersonales");
const {
  guardarRegimenHorario,
  listarRegimenesHorarios,
} = require("./catalogosRegimenHorario");

module.exports = {
  listarColeccion,
  listarVersionesCfgArticulo,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
  guardarRegistroLaboralTemporal,
  rrhhDeshabilitarHlc,
  rrhhDeshabilitarHlg,
  listarReadModelLaboralOperativoTemporal,
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
  rrhhListarBandejaEventos,
  guardarRegimenHorario,
  listarRegimenesHorarios,
};

