/**
 * Smoke C3 — señales §5.8 bandeja auditor (urgencia provisorias + motor señales).
 *
 *   node scripts/smoke/med-c3-senales-58.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));

const TAG = "[smoke-med-c3-senales-58]";

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t
          .slice("GOOGLE_APPLICATION_CREDENTIALS=".length)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function initDb() {
  const { cert, getApps, initializeApp } = requireFns("firebase-admin/app");
  const { getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return getFirestore();
}

function assertOrFail(cond, msg) {
  if (!cond) {
    console.error(TAG, "FAIL:", msg);
    process.exit(1);
  }
}

async function main() {
  const db = initDb();
  const {
    calcularPlazoProvisorioSenal,
    compararBandejaAuditorProvisoriasPorUrgencia,
    resolverBadgesBandejaAuditor,
    resolverSenalPlazoBandejaAuditor,
  } = requireFns("./modules/shared/bandejaAuditorSenalesCore.js");
  const { listarSolicitudesBandejaAuditorMedica } = requireFns(
    "./modules/shared/solicitudBandejaAuditorMedicaCore.js",
  );

  const ahora = Date.now();
  const mockVencida = {
    es_licencia_incompleta: true,
    vencimiento_plazo_certificado_iso: new Date(ahora - 3600 * 1000).toISOString(),
  };
  const mockHolgada = {
    es_licencia_incompleta: true,
    vencimiento_plazo_certificado_iso: new Date(ahora + 30 * 24 * 3600 * 1000).toISOString(),
  };

  const plazoV = calcularPlazoProvisorioSenal(mockVencida, ahora);
  assertOrFail(plazoV.vencida === true, "motor: provisoria vencida");
  assertOrFail(
    compararBandejaAuditorProvisoriasPorUrgencia(mockVencida, mockHolgada, ahora) < 0,
    "sort: vencida antes que holgada",
  );
  assertOrFail(
    resolverBadgesBandejaAuditor(mockVencida, ahora).some((b) => b.id === "vencida"),
    "badges: chip vencida",
  );
  assertOrFail(
    resolverSenalPlazoBandejaAuditor(mockHolgada, ahora).senal_plazo_nivel === "ok",
    "DTO señal: nivel ok en holgada",
  );

  console.log(TAG, "motor señales OK");

  const prov = await listarSolicitudesBandejaAuditorMedica(db, {
    filtro_vista: "provisorias",
    page_size: 20,
  });

  const items = prov?.solicitudes || [];
  console.log(TAG, "bandeja provisorias", {
    total: items.length,
    total_filtrado: prov?.page_info?.total_filtrado,
    order: prov?.page_info?.order_field,
  });

  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    const cur = items[i];
    assertOrFail(
      compararBandejaAuditorProvisoriasPorUrgencia(prev, cur, ahora) <= 0,
      `orden urgencia roto entre ${prev.solicitud_id} y ${cur.solicitud_id}`,
    );
  }

  if (items.length > 0) {
    const first = items[0];
    assertOrFail(typeof first.senal_plazo_nivel === "string", "item expone senal_plazo_nivel");
    console.log(TAG, "top provisoria", {
      sol: first.solicitud_id,
      nivel: first.senal_plazo_nivel,
      texto: first.senal_plazo_texto,
    });
  } else {
    console.log(TAG, "sin provisorias en piloto — motor validado offline");
  }

  const comp = await listarSolicitudesBandejaAuditorMedica(db, {
    filtro_vista: "completas",
    page_size: 5,
  });
  const completa = (comp?.solicitudes || []).find((s) => s.puede_clasificar === true);
  if (completa) {
    assertOrFail(
      resolverBadgesBandejaAuditor(completa, ahora).some((b) => b.id === "lista"),
      "completa: badge lista",
    );
    console.log(TAG, "completa probe", completa.solicitud_id);
  }

  console.log(TAG, "VEREDICTO: PASS");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
