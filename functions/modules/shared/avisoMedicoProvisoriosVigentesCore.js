"use strict";

const ESTADO_PENDIENTE_CLASIFICACION = "cfg_esa_pendiente_clasificacion_medica";
const SCHEMA_MED_AVISO = "SOL_MED_AVISO_V1";
const MAX_AVISOS_PROVISORIOS_VIGENTES = 2;

function vencDateToIso(venc) {
  if (venc && typeof venc.toDate === "function") {
    return venc.toDate().toISOString();
  }
  return null;
}

/**
 * @param {import("firebase-admin/firestore").DocumentSnapshot} doc
 */
function resumenAvisoIncompletoDesdeDoc(doc) {
  const d = doc.data() || {};
  const ing = d.ingreso_medico;
  if (!ing || ing.es_licencia_incompleta !== true) return null;
  const venc = d.vencimiento_plazo_certificado;
  const vencMs = venc && typeof venc.toDate === "function" ? venc.toDate().getTime() : NaN;
  if (!Number.isFinite(vencMs) || vencMs <= Date.now()) return null;

  const ingreso = ing && typeof ing === "object" ? ing : {};
  const fechaInicio = String(d.fecha_inicio_reposo_estimada || "").slice(0, 10);
  const familiar = ingreso.familiar_atendido;
  const familiarPlain =
    familiar && typeof familiar === "object"
      ? {
          declaracion_grupo_familiar_id: String(familiar.declaracion_grupo_familiar_id || "").trim(),
          familiar_id: String(familiar.familiar_id || "").trim(),
          nombre: String(familiar.nombre || "").trim(),
          apellido: String(familiar.apellido || "").trim(),
          dni: String(familiar.dni || "").trim(),
          ...(familiar.parentesco_id ? { parentesco_id: String(familiar.parentesco_id).trim() } : {}),
        }
      : null;
  const contacto = ingreso.declaracion_contacto;
  const contactoPlain =
    contacto && typeof contacto === "object"
      ? {
          usar_datos_perfil: contacto.usar_datos_perfil === true,
          telefono_celular: String(contacto.telefono_celular || "").trim(),
          ...(contacto.telefono_fijo ? { telefono_fijo: String(contacto.telefono_fijo).trim() } : {}),
          domicilio_declarado: String(contacto.domicilio_declarado || "").trim(),
          permanece_en_domicilio: contacto.permanece_en_domicilio === true,
          usar_email_perfil: contacto.usar_email_perfil === true,
          email: String(contacto.email || "").trim(),
        }
      : null;

  return {
    solicitud_id: doc.id,
    resumen: {
      fecha_inicio_reposo_estimada: /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) ? fechaInicio : "",
      vencimiento_plazo_certificado_iso: vencDateToIso(venc),
      tipo_ingreso_id: String(ingreso.tipo_ingreso_id || "").trim(),
      familiar_atendido: familiarPlain,
      declaracion_contacto: contactoPlain,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} titularPersonaId
 */
async function listarAvisosIncompletosVigentes(db, titularPersonaId) {
  const titular = String(titularPersonaId || "").trim();
  if (!/^per_/i.test(titular)) {
    return [];
  }
  const qs = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", titular)
    .where("estado_solicitud_id", "==", ESTADO_PENDIENTE_CLASIFICACION)
    .limit(20)
    .get();

  /** @type {Array<{ solicitud_id: string, resumen: Record<string, unknown> }>} */
  const avisos = [];
  for (const doc of qs.docs) {
    const d = doc.data() || {};
    if (d.schema_version !== SCHEMA_MED_AVISO) continue;
    const item = resumenAvisoIncompletoDesdeDoc(doc);
    if (item) avisos.push(item);
  }
  avisos.sort((a, b) => {
    const ai = String(a.resumen?.fecha_inicio_reposo_estimada || "");
    const bi = String(b.resumen?.fecha_inicio_reposo_estimada || "");
    return ai.localeCompare(bi);
  });
  return avisos;
}

module.exports = {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
  MAX_AVISOS_PROVISORIOS_VIGENTES,
  listarAvisosIncompletosVigentes,
};
