/**
 * Diagnóstico puntual capa teórica vs vis (cumplimiento).
 * Uso: node scripts/diag_celda_cumplimiento.mjs --persona=per_... --fecha=YYYY-MM-DD [--gdt=gdt_...]
 */
import "./load-env-v2.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { resolverCapaTeoricaGrupo } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"),
);
const { leerCeldaVisDiaFusionada } = require(
  join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
);
const { enriquecerLimitesCumplimientoEnCapa } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaLimitesCumplimiento.js"),
);
const { calcularDeltasCumplimiento } = require(
  join(repoRoot, "functions/modules/shared/calcularDeltasCumplimiento.js"),
);
const { ejecutarAnaliticaYValidacionFichadaDia } = require(
  join(repoRoot, "functions/modules/shared/validacionFichadaDiaPersistencia.js"),
);

function loadGac() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") || "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function parseArgs() {
  const out = { persona: "", fecha: "", gdt: "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V" };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--persona=")) out.persona = a.slice(10).trim();
    if (a.startsWith("--fecha=")) out.fecha = a.slice(8).trim();
    if (a.startsWith("--gdt=")) out.gdt = a.slice(6).trim();
  }
  return out;
}

const { persona, fecha, gdt } = parseArgs();
if (!/^per_/i.test(persona) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
  console.error("Uso: node scripts/diag_celda_cumplimiento.mjs --persona=per_... --fecha=YYYY-MM-DD");
  process.exit(1);
}

const gac = loadGac();
if (!gac || !existsSync(gac)) process.exit(1);
if (!getApps().length) {
  const cred = JSON.parse(readFileSync(gac, "utf8"));
  initializeApp({ credential: cert(cred) });
}
const db = getFirestore();

if (process.argv.includes("--write")) {
  const { recalcularAnaliticaValidacionFichadaTrasTeoria } = require(
    join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
  );
  const wr = await recalcularAnaliticaValidacionFichadaTrasTeoria({
    personaId: persona,
    grupoId: gdt,
    fechaYmd: fecha,
  });
  console.error("[write]", wr);
}

const asiId = buildAsiDocumentId(persona, fecha);
const asiSnap = await db.collection("asistencia_diaria").doc(asiId).get();
const asi = asiSnap.data();
const capa = asiSnap.exists ? resolverCapaTeoricaGrupo(asi, gdt) : null;

const visId = buildVisDocumentId(persona, fecha, gdt);
const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
const celda = visSnap.exists ? leerCeldaVisDiaFusionada(visSnap.data(), diaMesKeyDesdeYmd(fecha)) : null;

const hlgSnap = await db
  .collection("historial_laboral_grupos")
  .where("persona_id", "==", persona)
  .where("grupo_de_trabajo_id", "==", gdt)
  .where("activo", "==", true)
  .limit(1)
  .get();
const rid = hlgSnap.docs[0]?.data()?.regimen_horario_id;
const regSnap = rid ? await db.collection("cfg_regimen_horario").doc(rid).get() : null;
const reg = regSnap?.exists ? regSnap.data() : null;

const enr = enriquecerLimitesCumplimientoEnCapa(capa || {}, reg);
const celdaCtx = {
  ...celda,
  tipo_dia: celda?.tipo_dia ?? enr.tipo_dia,
  fichadas_esperadas: celda?.fichadas_esperadas ?? enr.fichadas_esperadas,
};
const analitica = calcularDeltasCumplimiento(celdaCtx, enr, { fecha_ymd: fecha });
const ejecutado = ejecutarAnaliticaYValidacionFichadaDia({
  celdaCtx,
  celdaRaw: celda,
  capaEnriquecida: enr,
  fecha_ymd: fecha,
  forzar_recalculo: true,
});

console.log(
  JSON.stringify(
    {
      asi_id: asiId,
      vis_id: visId,
      capa_resumen: capa
        ? {
            turno_compuesto_id: capa.turno_compuesto_id,
            ingreso_teorico_final: capa.ingreso_teorico_final,
            egreso_teorico_final: capa.egreso_teorico_final,
            tiene_huecos: capa.tiene_huecos,
            segmentos: capa.segmentos,
          }
        : null,
      vis_rda: {
        rda_turno_id: celda?.rda_turno_id,
        rda_ingreso: celda?.rda_ingreso,
        rda_egreso: celda?.rda_egreso,
      },
      enriquecido: {
        ingreso_nominal_iso: enr.ingreso_nominal_iso,
        egreso_nominal_iso: enr.egreso_nominal_iso,
        carga_min: enr.carga_horaria_diaria_minutos,
      },
      fichadas_reales: celda?.fichadas_reales,
      motor: {
        fichada_fuera_turno: analitica.fichada_fuera_turno_teorico,
        alertas: analitica.alertas_activas,
        debito: analitica.debito_tiempo,
      },
      ejecutar_pipeline: {
        fichada_fuera_turno: ejecutado.analitica?.fichada_fuera_turno_teorico,
        alertas: ejecutado.analitica?.alertas_activas,
        resolver_accion: ejecutado.resolverOut?.accion,
      },
      persistido_vis: {
        fichada_fuera_turno: celda?.analitica_cumplimiento?.fichada_fuera_turno_teorico,
        semaforo: celda?.validacion_fichada_dia?.estado_semaforo,
        alertas: celda?.validacion_fichada_dia?.alertas_semanticas,
      },
      overrides_activos: Array.isArray(asi?.overrides_turno)
        ? asi.overrides_turno
            .filter((o) => !o.eliminado && !o.invalidado_por_replanificacion)
            .map((o) => ({
              tipo: o.tipo,
              turno_id: o.turno_id,
              ingreso: o.ingreso,
              egreso: o.egreso,
              reemplazo_traslado_v2: o.reemplazo_traslado_v2,
              grupo: o.grupo_de_trabajo_id,
            }))
        : [],
    },
    null,
    2,
  ),
);
