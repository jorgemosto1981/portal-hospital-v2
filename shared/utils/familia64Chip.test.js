import test from "node:test";
import assert from "node:assert/strict";

import {
  codigoFamilia64SinModalidad,
  nombreFamilia64SinModalidad,
} from "./familia64Chip.js";

test("codigoFamilia64SinModalidad", async (t) => {
  await t.test("saca la letra de modalidad del par ADMIN", () => {
    assert.equal(codigoFamilia64SinModalidad("64-A"), "64");
    assert.equal(codigoFamilia64SinModalidad("64-B"), "64");
  });

  await t.test("conserva el calificador del par", () => {
    assert.equal(
      codigoFamilia64SinModalidad("64-A (Personal 1/2 carga)"),
      "64 (Personal 1/2 carga)",
    );
  });

  await t.test("no toca códigos que no llevan modalidad", () => {
    assert.equal(codigoFamilia64SinModalidad("63-C"), "63");
    assert.equal(codigoFamilia64SinModalidad("64"), "64");
  });

  await t.test("no confunde un sufijo alfanumérico con la modalidad", () => {
    assert.equal(codigoFamilia64SinModalidad("64-A1"), "64-A1");
  });

  await t.test("entrada vacía o nula", () => {
    assert.equal(codigoFamilia64SinModalidad(""), "");
    assert.equal(codigoFamilia64SinModalidad(null), "");
  });
});

test("nombreFamilia64SinModalidad", async (t) => {
  await t.test("saca el sufijo de modalidad", () => {
    assert.equal(
      nombreFamilia64SinModalidad("ASUNTOS PARTICULARES CON GOCE DE HABERES"),
      "ASUNTOS PARTICULARES",
    );
    assert.equal(
      nombreFamilia64SinModalidad("ASUNTOS PARTICULARES SIN GOCE DE HABERES"),
      "ASUNTOS PARTICULARES",
    );
  });

  await t.test("conserva el calificador del par", () => {
    assert.equal(
      nombreFamilia64SinModalidad("ASUNTOS PARTICULARES CON GOCE DE HABERES (Personal 1/2 carga)"),
      "ASUNTOS PARTICULARES (Personal 1/2 carga)",
    );
  });

  await t.test("es indiferente a mayúsculas", () => {
    assert.equal(
      nombreFamilia64SinModalidad("Asuntos particulares con goce de haberes"),
      "Asuntos particulares",
    );
  });

  await t.test("deja intacto un nombre sin modalidad", () => {
    assert.equal(
      nombreFamilia64SinModalidad("FUERZA MAYOR / FENOMENOS METEOROLOGICOS"),
      "FUERZA MAYOR / FENOMENOS METEOROLOGICOS",
    );
  });

  await t.test("entrada vacía o nula", () => {
    assert.equal(nombreFamilia64SinModalidad(""), "");
    assert.equal(nombreFamilia64SinModalidad(undefined), "");
  });
});
