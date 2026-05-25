import "./load-env-v2.mjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en entorno (.env.v2.local).");
  process.exit(1);
}

if (!admin.apps.length) {
  const projectId =
    process.env.FIREBASE_V2_PROJECT_ID?.trim() ||
    JSON.parse(readFileSync(credPath, "utf8")).project_id;
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

function toDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function evaluarVigencia(desde, hasta, fechaCorte) {
  return !!desde && desde <= fechaCorte && (!hasta || hasta >= fechaCorte);
}

function sample(rows, max = 5) {
  return rows.slice(0, max).map((x) => ({
    id: x.id,
    persona_id: x.persona_id || null,
    grupo_de_trabajo_id: x.grupo_de_trabajo_id || null,
    desde: x.desde,
    hasta: x.hasta,
    vigente_en_fecha: x.vigenteEnFecha,
  }));
}

function construirMatriz(rows) {
  const cerrados = rows.filter((x) => !!x.hasta);
  const abiertos = rows.filter((x) => !x.hasta);
  const activos = rows.filter((x) => x.vigenteEnFecha);
  const noActivos = rows.filter((x) => !x.vigenteEnFecha);
  const cerradosYActivos = rows.filter((x) => !!x.hasta && x.vigenteEnFecha);
  const cerradosYNoActivos = rows.filter((x) => !!x.hasta && !x.vigenteEnFecha);
  const abiertosYActivos = rows.filter((x) => !x.hasta && x.vigenteEnFecha);
  const abiertosYNoActivos = rows.filter((x) => !x.hasta && !x.vigenteEnFecha);
  const sinFechaDesde = rows.filter((x) => !x.desde);

  return {
    total: rows.length,
    cerrados: cerrados.length,
    abiertos: abiertos.length,
    activos_en_fecha: activos.length,
    no_activos_en_fecha: noActivos.length,
    intersecciones: {
      cerrados_y_activos_en_fecha: cerradosYActivos.length,
      cerrados_y_no_activos_en_fecha: cerradosYNoActivos.length,
      abiertos_y_activos_en_fecha: abiertosYActivos.length,
      abiertos_y_no_activos_en_fecha: abiertosYNoActivos.length,
    },
    sin_fecha_desde: sinFechaDesde.length,
    ejemplos: {
      cerrados: sample(cerrados),
      activos_en_fecha: sample(activos),
      no_activos_en_fecha: sample(noActivos),
      cerrados_y_activos_en_fecha: sample(cerradosYActivos),
    },
  };
}

async function main() {
  const fechaCorteArg = process.argv[2];
  const fechaCorte = toDateKey(fechaCorteArg) || new Date().toISOString().slice(0, 10);

  const [hlcSnap, hlgSnap] = await Promise.all([
    db.collection("historial_laboral_cargos").get(),
    db.collection("historial_laboral_grupos").get(),
  ]);

  const hlc = hlcSnap.docs.map((d) => {
    const row = d.data();
    const desde = toDateKey(row.fecha_desde);
    const hasta = toDateKey(row.fecha_hasta);
    return {
      id: d.id,
      persona_id: row.persona_id || null,
      grupo_de_trabajo_id: row.grupo_de_trabajo_id || null,
      desde,
      hasta,
      vigenteEnFecha: evaluarVigencia(desde, hasta, fechaCorte),
    };
  });

  const hlg = hlgSnap.docs.map((d) => {
    const row = d.data();
    const desde = toDateKey(row.fecha_inicio);
    const hasta = toDateKey(row.fecha_fin);
    return {
      id: d.id,
      persona_id: row.persona_id || null,
      grupo_de_trabajo_id: row.grupo_de_trabajo_id || null,
      desde,
      hasta,
      vigenteEnFecha: evaluarVigencia(desde, hasta, fechaCorte),
    };
  });

  const hlgPorGrupo = new Map();
  hlg.forEach((row) => {
    const key = String(row.grupo_de_trabajo_id || "SIN_GRUPO");
    const bucket = hlgPorGrupo.get(key) || [];
    bucket.push(row);
    hlgPorGrupo.set(key, bucket);
  });

  const vistaOperativaPorGrupo = [...hlgPorGrupo.entries()]
    .map(([grupo_id, rows]) => ({
      grupo_id,
      ...construirMatriz(rows),
    }))
    .sort((a, b) => b.total - a.total);

  const payload = {
    generado_en: new Date().toISOString(),
    fecha_corte: fechaCorte,
    hlc: construirMatriz(hlc),
    hlg: construirMatriz(hlg),
    vista_operativa_por_grupo: vistaOperativaPorGrupo,
  };

  const backupsDir = join(process.cwd(), "backups");
  mkdirSync(backupsDir, { recursive: true });
  const filename = `auditoria-filtros-laborales-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = join(backupsDir, filename);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(payload, null, 2));
  console.log(`[auditoria] Archivo generado: ${outPath}`);
}

main().catch((error) => {
  console.error("[auditoria] Error:", error?.message || error);
  if (error?.stack) console.error(error.stack);
  process.exit(1);
});
