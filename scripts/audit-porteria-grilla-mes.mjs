/**
 * Lista agentes vigentes en Portería por mes (listarVistaGrillaMesPorGrupo).
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { listarVistaGrillaMesPorGrupo } = require("../functions/modules/shared/grillaMesAgenteCore.js");

for (const line of readFileSync(".env.v2.local", "utf8").split(/\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    projectId: process.env.FIREBASE_PROJECT_ID || "portal-hospital-v2",
  });
}

const db = getFirestore();
const gdt = "gdt_01KQA9FVEW53JSNTPGX32NWQ5B";

for (const mes of [5, 6, 7]) {
  const r = await listarVistaGrillaMesPorGrupo(db, { grupoTrabajoId: gdt, anio: 2026, mes });
  console.log(
    JSON.stringify({
      mes,
      ok: r.ok,
      total_personas: r.total_personas,
      filas: r.filas?.length,
      mat: r.materializacion_grupo,
    }),
  );
}
