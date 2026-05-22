"use strict";

const { getIndiceCalendario } = require("./calendarService");
const { buildIndiceEventosCalendario } = require("./calendarInstitucionalCore");
const {
  mensajeValidacionFechas,
  readModoCalculo,
  readUsaCalendarioInstitucional,
  validarFechasArticulo,
} = require("./validarFechasArticulo");

/**
 * Validación C1/C2/C4 con índice de calendario cargado desde Firestore si aplica.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   versionData: Record<string, unknown>,
 *   fechaDesde: string,
 *   fechaHasta?: string,
 *   diasSolicitados: number,
 *   refYmd?: string,
 *   omitirHorizonte?: boolean,
 * }} params
 */
async function validarFechasArticuloEnMotor(db, params) {
  const versionData = params.versionData || {};
  const modoCalc = readModoCalculo(versionData);
  const usa = modoCalc.usaCalendario;
  /** @type {import("./calendarInstitucionalCore").buildIndiceEventosCalendario extends Function ? ReturnType<typeof buildIndiceEventosCalendario> : never} */
  let indice = null;
  if (usa && modoCalc.incluyeFeriadosInstitucionales) {
    indice = await getIndiceCalendario();
  } else if (usa) {
    indice = buildIndiceEventosCalendario([]);
  }

  const out = validarFechasArticulo({
    versionData,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    diasSolicitados: params.diasSolicitados,
    refYmd: params.refYmd,
    omitirHorizonte: params.omitirHorizonte === true,
    indice,
  });

  if (!out.ok) {
    return {
      ok: false,
      codigos: out.codigos,
      mensajes: out.mensajes.length ? out.mensajes : out.codigos.map((c) => mensajeValidacionFechas(c)),
      fecha_hasta: out.fecha_hasta,
      calendario_resumen: out.resumen,
      modo_computo: out.modo_computo,
      usa_calendario_institucional: out.usa_calendario_institucional,
    };
  }

  return {
    ok: true,
    codigos: [],
    mensajes: [],
    fecha_hasta: out.fecha_hasta,
    calendario_resumen: out.resumen,
    modo_computo: out.modo_computo,
    usa_calendario_institucional: out.usa_calendario_institucional,
  };
}

module.exports = {
  validarFechasArticuloEnMotor,
  readModoCalculo,
  readUsaCalendarioInstitucional,
  mensajeValidacionFechas,
};
