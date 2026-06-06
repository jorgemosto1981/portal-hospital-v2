/**
 * Smoke F2 orquestación (Admin SDK + lógica pura; no sustituye UI).
 *
 * Uso: node scripts/smoke-f2-orquestacion-prod.mjs
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

const gac = loadGacPath();
if (!getApps().length) {
  const cred = JSON.parse(readFileSync(gac, "utf8"));
  initializeApp({ credential: cert(cred), projectId: cred.project_id || "portal-hospital-v2" });
}

const db = getFirestore();
const { evaluarPoliticaGsoMes } = require(
  join(repoRoot, "functions/modules/asistencia/grillaGsoSoloLectura.js"),
);
const { ejecutarJobMaterializacionVentanaDia5 } = require(
  join(repoRoot, "functions/modules/asistencia/jobMaterializacionVentanaDia5.js"),
);

const GDT_OFICINA = "gdt_01KR3H81ENQK84ZK21EQWEQQXG";
const PER_CHAPARRO = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";

const acta = {
  fecha: new Date().toISOString().slice(0, 10),
  pruebas: [],
};

function ok(id, detalle, extra = {}) {
  acta.pruebas.push({ id, resultado: "OK", ...detalle, ...extra });
}

function fail(id, detalle, extra = {}) {
  acta.pruebas.push({ id, resultado: "FAIL", ...detalle, ...extra });
}

// O-P1-3 lógica mes anterior (junio 2026 → mayo solo lectura)
const pMayo = evaluarPoliticaGsoMes({ periodoYm: "2026-05", hoyYmd: "2026-06-15", esRrhhLabor: false });
const pJun = evaluarPoliticaGsoMes({ periodoYm: "2026-06", hoyYmd: "2026-06-15", esRrhhLabor: false });
const pJul = evaluarPoliticaGsoMes({ periodoYm: "2026-07", hoyYmd: "2026-06-15", esRrhhLabor: false });
if (pMayo.solo_lectura && !pJun.solo_lectura && !pJul.solo_lectura) {
  ok("O-P1-3-ventana", { mayo: pMayo, junio: pJun, julio: pJul });
} else {
  fail("O-P1-3-ventana", { mayo: pMayo, junio: pJun, julio: pJul });
}

// Job día 5 idempotencia julio (post materialización real)
const dryJul = await ejecutarJobMaterializacionVentanaDia5(db, {
  fechaReferenciaYmd: "2026-06-05",
  force: true,
  dryRun: true,
  soloGrupoId: GDT_OFICINA,
});
const omitJul = (dryJul.muestra || []).filter(
  (m) => m.mes === 7 && m.accion === "omitir" && m.motivo === "m_plus_1_ya_materializado",
).length;
if (dryJul.ok && dryJul.materializados === 0 && omitJul >= 1) {
  ok("O-P1-1-idempotencia-julio", { dryJul: { materializados: dryJul.materializados, omitidos: dryJul.omitidos, muestra: dryJul.muestra } });
} else {
  fail("O-P1-1-idempotencia-julio", { dryJul });
}

// Metadata julio CHAPARRO
const visId = `vis_2026_07_${PER_CHAPARRO}_${GDT_OFICINA}`.replace(
  /vis_(\d{4})_(\d{2})_per_/,
  "vis_$1_$2_per_",
);
const visSnap = await db.collection("vistas_grilla_mes_agente").doc(
  `vis_2026_07_per_01KR3HD24AMJ6YX3N7B3GPAZJ4_gdt_01KR3H81ENQK84ZK21EQWEQQXG`,
).get();
if (visSnap.exists) {
  const meta = visSnap.data()?.metadata || {};
  const motivo = meta.ultimo_motivo || "";
  const motivosOk = ["job_dia5", "hlg", "materializar_grupo_mes", "materializar_rango"];
  if (motivosOk.some((m) => motivo.includes(m))) {
    ok("O-P1-2-metadata", { ultimo_motivo: motivo, rango: meta.ultimo_rango_materializado });
  } else {
    fail("O-P1-2-metadata", { ultimo_motivo: motivo });
  }
} else {
  fail("O-P1-2-metadata", { mensaje: "vis julio no existe" });
}

const fails = acta.pruebas.filter((p) => p.resultado === "FAIL").length;
acta.resumen = { total: acta.pruebas.length, ok: acta.pruebas.length - fails, fail: fails };
console.log(JSON.stringify(acta, null, 2));
process.exit(fails > 0 ? 1 : 0);
