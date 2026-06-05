/**
 * HLg vigentes por fecha + estado período en vis_* por gdt.
 * Uso: node scripts/audit-persona-grupos-fecha.mjs --dni=28914247 --fecha=2026-06-01
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));
const { consultarEstadoPeriodoLiquidacion } = require(join(
  repoRoot,
  "functions/modules/asistencia/asistenciaPeriodoLiquidacion.js",
));
const { listarGruposTrabajoVigentesEnFecha } = require(join(
  repoRoot,
  "functions/modules/shared/solicitudGrupoTrabajoAncla.js",
));

function loadGac() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

const dni = process.argv.find((a) => a.startsWith("--dni="))?.slice(6) || "";
const fecha = process.argv.find((a) => a.startsWith("--fecha="))?.slice(8) || "2026-06-01";
const gdtFiltro = process.argv.find((a) => a.startsWith("--gdt="))?.slice(6) || "";

if (!dni) {
  console.error("Uso: --dni=... [--fecha=YYYY-MM-DD] [--gdt=gdt_...]");
  process.exit(1);
}

const gac = loadGac();
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
const db = getFirestore();

const psn = await db.collection("personas").where("dni", "==", dni).limit(2).get();
if (psn.empty) {
  console.error("Persona no encontrada");
  process.exit(1);
}
const pid = psn.docs[0].id;

const hlgSnap = await db.collection("historial_laboral_grupos").where("persona_id", "==", pid).get();
const hlgs = hlgSnap.docs.map((d) => {
  const x = d.data();
  return {
    id: d.id,
    activo: x.activo,
    grupo_de_trabajo_id: x.grupo_de_trabajo_id,
    fecha_inicio: x.fecha_inicio,
    fecha_fin: x.fecha_fin,
    motivo_baja: x.motivo_baja || null,
  };
});

const vigentesApi = await listarGruposTrabajoVigentesEnFecha(db, pid, fecha);

const periodoPorGdt = {};
for (const h of hlgs) {
  const g = String(h.grupo_de_trabajo_id || "").trim();
  if (!/^gdt_/i.test(g)) continue;
  if (gdtFiltro && g !== gdtFiltro) continue;
  try {
    periodoPorGdt[g] = await consultarEstadoPeriodoLiquidacion(db, pid, fecha, g);
  } catch (e) {
    periodoPorGdt[g] = { error: String(e.message) };
  }
}

const porteriaId = "gdt_01KQA9FVEW53JSNTPGX32NWQ5B";
const gdtSnap = gdtFiltro
  ? await db.collection("grupos_de_trabajo").doc(gdtFiltro).get()
  : await db.collection("grupos_de_trabajo").doc(porteriaId).get();

console.log(
  JSON.stringify(
    {
      persona_id: pid,
      dni,
      fecha_referencia: fecha,
      grupo_catalogo_porteria: gdtSnap.exists
        ? { id: gdtSnap.id, nombre: gdtSnap.data()?.nombre || gdtSnap.data()?.codigo }
        : null,
      hlgs_todas: hlgs.sort((a, b) => String(a.grupo_de_trabajo_id).localeCompare(String(b.grupo_de_trabajo_id))),
      grupos_vigentes_para_solicitud_en_fecha: vigentesApi,
      periodo_liquidacion_por_gdt: periodoPorGdt,
      vis_porteria_junio: buildVisDocumentId(pid, "2026-06-01", porteriaId),
      nota:
        "Si Portería no aparece en grupos_vigentes: HLg inactiva o fuera de vigencia en esa fecha (esperado tras deshabilitar).",
    },
    null,
    2,
  ),
);
