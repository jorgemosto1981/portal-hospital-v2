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
  rrhhEliminarHlgAnulada,
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
const { listarCatalogosAsistenciaTurnos } = require("./catalogosAsistenciaTurnos");

module.exports = {
  listarColeccion,
  listarVersionesCfgArticulo,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
  guardarRegistroLaboralTemporal,
  rrhhDeshabilitarHlc,
  rrhhDeshabilitarHlg,
  rrhhEliminarHlgAnulada,
  listarReadModelLaboralOperativoTemporal,
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
  rrhhListarBandejaEventos,
  guardarRegimenHorario,
  listarRegimenesHorarios,
  listarCatalogosAsistenciaTurnos,
};

