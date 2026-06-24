/**
 * Verifica listado Patron B para articulos oleada 63 (codigos 63-*).
 */
import "../load-env-v2.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getAdminDb } from "../lib/firestoreAdminBootstrap.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { listarArticulosIngresoPatronB } = require(
  join(repoRoot, "functions/modules/shared/listarArticulosIngresoCore.js"),
);

const PERSONA_ID = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const fechaDesde = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
});

const db = getAdminDb();
const result = await listarArticulosIngresoPatronB({
  db,
  personaId: PERSONA_ID,
  fechaDesde,
});

const articulos = (result.articulos || []).filter((a) =>
  /^63-/i.test(String(a.codigo_grilla || "")),
);

const summary = {
  fecha_desde: fechaDesde,
  persona_id: PERSONA_ID,
  listado_modo: result.meta?.listado_modo,
  candidatos_evaluados: result.meta?.candidatos_evaluados,
  total_63: articulos.length,
  codigos: articulos.map((a) => a.codigo_grilla).sort(),
};

console.log(
  JSON.stringify(
    {
      summary,
      articulos,
      ...(result.elegibilidad_vacia ? { elegibilidad_vacia: result.elegibilidad_vacia } : {}),
    },
    null,
    2,
  ),
);