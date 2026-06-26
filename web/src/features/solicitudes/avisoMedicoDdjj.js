/**
 * DDJJ grupo familiar — gate y opciones para aviso médico (atención familiar).
 */

/**
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function ddjjTieneFamiliaresUtilizables(doc) {
  if (!doc || typeof doc !== "object") return false;
  const fams = Array.isArray(doc.familiares) ? doc.familiares : [];
  return fams.some((f) => {
    if (!f || typeof f !== "object") return false;
    return (
      String(f.nombre || "").trim() &&
      String(f.apellido || "").trim() &&
      String(f.dni || "").trim()
    );
  });
}

/**
 * DDJJ “realizada” — presentada o con familiares cargados (cualquier estado de auditoría).
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function ddjjRealizadaEnCualquierEstado(doc) {
  if (!ddjjTieneFamiliaresUtilizables(doc)) return false;
  if (doc.declaracion_jurada_aceptada === true) return true;
  const est = String(doc.estado_declaracion_id || "").trim().toUpperCase();
  if (est === "CFG_DDJJ_03_PRESENTADA") return true;
  if (est === "CFG_DDJJ_04_SUPERADA_POR_ACTUALIZACION") return true;
  return Number(doc.declaracion_version) >= 1;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} personaId
 */
export function seleccionarDdjjReferenciaParaAviso(rows, personaId) {
  const pid = String(personaId || "").trim();
  if (!pid) return null;
  const delTitular = (rows || []).filter((r) => String(r.titular_persona_id || "") === pid);
  const ordenadas = delTitular.slice().sort((a, b) => {
    const va = Number(a?.declaracion_version) || 0;
    const vb = Number(b?.declaracion_version) || 0;
    if (vb !== va) return vb - va;
    const ta = Date.parse(String(a?.actualizado_en || a?.creado_en || ""));
    const tb = Date.parse(String(b?.actualizado_en || b?.creado_en || ""));
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  for (const doc of ordenadas) {
    if (ddjjRealizadaEnCualquierEstado(doc)) return doc;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} ddjjDoc
 * @param {Array<{ value: string, label: string }>} optsParentesco
 */
export function familiaresOpcionesDesdeDdjj(ddjjDoc, optsParentesco = []) {
  const gfId = String(ddjjDoc?.id || "").trim();
  const fams = Array.isArray(ddjjDoc?.familiares) ? ddjjDoc.familiares : [];
  const parentescoById = new Map((optsParentesco || []).map((o) => [o.value, o.label]));

  return fams
    .map((f, idx) => {
      if (!f || typeof f !== "object") return null;
      const nombre = String(f.nombre || "").trim();
      const apellido = String(f.apellido || "").trim();
      const dni = String(f.dni || "").trim();
      if (!nombre || !apellido || !dni) return null;
      const familiarId = String(f.familiar_id || "").trim() || `linea_${idx}`;
      const parentescoId = String(f.parentesco_id || "").trim();
      const parentescoLabel = parentescoById.get(parentescoId) || parentescoId || "Familiar";
      return {
        value: familiarId,
        label: `${apellido}, ${nombre} — DNI ${dni} (${parentescoLabel})`,
        payload: {
          declaracion_grupo_familiar_id: gfId,
          familiar_id: familiarId,
          nombre,
          apellido,
          dni,
          parentesco_id: parentescoId || undefined,
        },
      };
    })
    .filter(Boolean);
}
