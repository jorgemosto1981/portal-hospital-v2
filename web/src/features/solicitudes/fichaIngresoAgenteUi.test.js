import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  fichaIngresoAgenteTieneDatos,
  filasClinicaFichaIngreso,
  filasContactoFichaIngreso,
  textoRangoEstimadoAgente,
  textoTelefonosFicha,
} from "./fichaIngresoAgenteUi.js";

describe("fichaIngresoAgenteUi", () => {
  it("detecta ficha con datos de contacto", () => {
    assert.equal(fichaIngresoAgenteTieneDatos({ telefono_celular: "1122" }), true);
    assert.equal(fichaIngresoAgenteTieneDatos({}), false);
  });

  it("formatea rango estimado y teléfonos", () => {
    assert.equal(
      textoRangoEstimadoAgente({
        fecha_estimada_desde: "2026-08-02",
        fecha_estimada_hasta: "2026-08-18",
      }),
      "02/08/2026 → 18/08/2026",
    );
    assert.equal(
      textoTelefonosFicha({ telefono_celular: "11", telefono_fijo: "22" }),
      "11 / 22",
    );
  });

  it("arma filas clínicas con CIE y enfermedad", () => {
    const filas = filasClinicaFichaIngreso({
      sintomas: "Fiebre",
      codigo_cie_clinica: "A09",
      enfermedad: "Gastroenteritis",
    });
    assert.equal(filas.length, 2);
    assert.match(filas[1].value, /A09/);
  });

  it("arma filas de contacto", () => {
    const filas = filasContactoFichaIngreso({
      telefono_celular: "112233",
      email: "a@b.com",
      domicilio_declarado: "Calle 1",
      permanece_en_domicilio: true,
    });
    assert.equal(filas.length, 4);
  });
});
