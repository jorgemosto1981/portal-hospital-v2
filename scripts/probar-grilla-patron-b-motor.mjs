/**
 * Prueba integrada: motor Patrón B debe devolver GRILLA_NO_AUTORIZADA
 * en día sin asistencia_diaria / capa_teorica (con depende_rda true en versión).
 *
 * Uso:
 *   node scripts/probar-grilla-patron-b-motor.mjs [YYYY-MM-DD] [per_<ULID>]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);

function loadLocalEnvIfPresent() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env.v2.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnvIfPresent();
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

const fechaDesde = (process.argv[2] || "2026-12-25").trim().slice(0, 10);
const personaId = (process.argv[3] || "per_01KR3HD24AMJ6YX3N7B3GPAZJ4").trim();
const articuloId = "art_01KRNK10V10CH7W5M2W6V558GS";
const versionId = "ver_01KRNKNBXNBFC9HZN7CZJGPRDH";
const grupoAncla = "gdt_01KR3H81ENQK84ZK21EQWEQQXG";

const j = JSON.parse(readFileSync(credPath, "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: j.project_id,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(getApp());
const motorPath = join(dirname(fileURLToPath(import.meta.url)), "..", "functions", "modules", "shared", "solicitudPatronBAltaMotor.js");
const { runPatronBAltaMotor } = require(motorPath);

const anio = Number(fechaDesde.slice(0, 4));
const motor = await runPatronBAltaMotor({
  db,
  solicitud: {
    titular_persona_id: personaId,
    articulo_id: articuloId,
    version_id_aplicada: versionId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaDesde,
    dias_solicitados: 1,
    anio_ciclo_consumo: anio,
    grupo_trabajo_id_ancla: grupoAncla,
  },
  authToken: null,
});

const okGrilla =
  motor.ok === false &&
  Array.isArray(motor.codigos) &&
  motor.codigos.includes("GRILLA_NO_AUTORIZADA");

console.log(
  JSON.stringify(
    {
      okGrilla,
      fechaDesde,
      personaId,
      motor_ok: motor.ok,
      codigos: motor.codigos,
      mensajes: motor.mensajes,
    },
    null,
    2,
  ),
);
process.exit(okGrilla ? 0 : 1);
