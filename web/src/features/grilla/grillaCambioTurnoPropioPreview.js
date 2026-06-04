import { labelTurnoToken } from "./enrichCapaTeoricaLabels.js";
import { horasDesdeIsoTramo } from "./grillaHorarioInstitucional.js";

export const TOPE_HORAS_DIA = 24;

/**
 * @param {unknown} capa
 * @returns {string[]}
 */
export function segmentoIdsDesdeCapa(capa) {
  if (!capa || typeof capa !== "object") return [];
  const seg = capa.segmentos;
  if (Array.isArray(seg) && seg.length) {
    return [...new Set(seg.map((s) => String(s.segmento_id || "").trim()).filter(Boolean))];
  }
  const comp = capa.turno_compuesto_id;
  if (comp) {
    return [...new Set(String(comp).split("+").map((x) => x.trim()).filter(Boolean))];
  }
  if (capa.turno_id) return [String(capa.turno_id).trim()];
  return [];
}

/**
 * @param {string[]} ids
 * @param {Record<string, { codigo_interno?: string; etiqueta?: string }>} [turnosPorId]
 */
export function etiquetaSegmentosCompuesto(ids, turnosPorId = {}) {
  const parts = (ids || [])
    .map((id) => {
      const meta = turnosPorId[id] || {};
      return meta.codigo_interno || labelTurnoToken(id) || meta.etiqueta || id;
    })
    .filter(Boolean);
  return parts.length ? parts.join("+") : "—";
}

/**
 * @param {string} segmentoId
 * @param {Record<string, { horas_efectivas?: number; horas?: number; ingreso?: string; egreso?: string }>} turnosPorId
 * @param {Array<{ segmento_id?: string; horas_efectivas?: number; ingreso_iso?: string; egreso_iso?: string }>} [segmentosCapa]
 */
export function horasDeSegmento(segmentoId, turnosPorId = {}, segmentosCapa = []) {
  const seg = segmentosCapa.find((s) => s.segmento_id === segmentoId);
  if (seg) {
    if (typeof seg.horas_efectivas === "number" && seg.horas_efectivas >= 0) {
      return seg.horas_efectivas;
    }
    const desdeIso = horasDesdeIsoTramo(seg.ingreso_iso, seg.egreso_iso);
    if (desdeIso > 0) return desdeIso;
  }

  const meta = turnosPorId[segmentoId] || {};
  if (typeof meta.horas_efectivas === "number" && meta.horas_efectivas >= 0) return meta.horas_efectivas;
  if (typeof meta.horas === "number" && meta.horas >= 0) return meta.horas;

  if (seg?.ingreso_iso && seg?.egreso_iso) {
    return horasDesdeIsoTramo(seg.ingreso_iso, seg.egreso_iso);
  }
  return 0;
}

/**
 * @param {unknown} capa
 * @param {Record<string, object>} [turnosPorId]
 */
export function horasTotalesCapa(capa, turnosPorId = {}) {
  if (!capa || typeof capa !== "object") return 0;
  if (typeof capa.horas_teoricas_totales === "number" && capa.horas_teoricas_totales >= 0) {
    return capa.horas_teoricas_totales;
  }
  const ids = segmentoIdsDesdeCapa(capa);
  const segs = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  return ids.reduce((sum, id) => sum + horasDeSegmento(id, turnosPorId, segs), 0);
}

/**
 * Proyección día = capa materializada ± ops outbox pendientes (B-N1 / A-N1).
 * @param {unknown} capa
 * @param {Array<Record<string, unknown>>} ops
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {Record<string, object>} [turnosPorId]
 */
export function proyectarDiaConOpsPendientes(capa, ops, personaId, fechaYmd, turnosPorId = {}) {
  const pid = String(personaId || "").trim();
  const f = String(fechaYmd || "").trim();
  let ids = [...segmentoIdsDesdeCapa(capa)];
  const baseSegs = Array.isArray(capa?.segmentos) ? capa.segmentos : [];
  const segById = new Map(baseSegs.map((s) => [String(s.segmento_id || ""), s]));

  const quitar = (lista) => {
    const rm = new Set((lista || []).map((x) => String(x).trim()).filter(Boolean));
    ids = ids.filter((id) => !rm.has(String(id)));
  };
  const agregar = (lista) => {
    for (const raw of lista || []) {
      const id = String(raw || "").trim();
      if (!id || ids.includes(id)) continue;
      ids.push(id);
      if (!segById.has(id)) segById.set(id, { segmento_id: id });
    }
  };

  for (const op of ops || []) {
    const tipo = String(op.tipo || "").trim();

    if (tipo === "cobertura_parcial") {
      const perO = String(op.personaOrigenId || op.persona_origen_id || "").trim();
      const perD = String(op.personaDestinoId || op.personaCoberturaId || op.persona_destino_id || "").trim();
      const fO = String(op.fechaOrigenYmd || op.fecha_origen || op.fechaYmd || "").trim();
      const fD = String(op.fechaDestinoYmd || op.fecha_destino || op.fechaYmd || "").trim();
      const segsO = Array.isArray(op.segmentosCedidosOrigen)
        ? op.segmentosCedidosOrigen
        : Array.isArray(op.segmentos_cedidos_origen)
          ? op.segmentos_cedidos_origen
          : Array.isArray(op.segmentosCubiertos)
            ? op.segmentosCubiertos
            : [];
      const segsD = Array.isArray(op.segmentosCedidosDestino)
        ? op.segmentosCedidosDestino
        : Array.isArray(op.segmentos_cedidos_destino)
          ? op.segmentos_cedidos_destino
          : [];

      if (pid === perO && f === fO) {
        quitar(segsO);
        agregar(segsD);
      }
      if (pid === perD && f === fD) {
        quitar(segsD);
        agregar(segsO);
      }
      continue;
    }

    if (tipo === "reemplazo") {
      const per = String(op.personaId || op.persona_id || "").trim();
      if (per !== pid) continue;
      const fOrig = String(op.fechaOrigenYmd || op.fecha_origen || "").trim();
      const fDest = String(op.fechaDestinoYmd || op.fecha_destino || op.fechaYmd || "").trim();
      if (f === fOrig) {
        quitar(op.segmentosTrasladar || op.segmentos_a_trasladar);
      }
      if (f === fDest) {
        const inc = Array.isArray(op.segmentosIncorporadosDestino)
          ? op.segmentosIncorporadosDestino
          : [op.turnoIdDestino || op.turno_id_destino || op.turnoId].filter(Boolean);
        agregar(inc);
      }
      continue;
    }

    if (tipo === "adicional") {
      const per = String(op.personaId || op.persona_id || "").trim();
      if (per !== pid) continue;
      const fDia = String(op.fechaYmd || op.fecha || "").trim();
      if (f === fDia) {
        agregar([op.turnoId || op.turno_id].filter(Boolean));
      }
    }
  }

  const segmentosCapa = ids.map((id) => segById.get(id) || { segmento_id: id });
  const horas = ids.reduce((sum, id) => sum + horasDeSegmento(id, turnosPorId, segmentosCapa), 0);
  return {
    segmentoIds: ids,
    segmentosCapa,
    horas,
    etiqueta: etiquetaSegmentosCompuesto(ids, turnosPorId),
    tienePreviewPendiente: (ops || []).some((op) => opAfectaDia(op, pid, f)),
  };
}

/**
 * @param {Record<string, unknown>} op
 * @param {string} personaId
 * @param {string} fechaYmd
 */
export function opAfectaDia(op, personaId, fechaYmd) {
  const pid = String(personaId || "").trim();
  const f = String(fechaYmd || "").trim();
  const tipo = String(op?.tipo || "").trim();
  if (tipo === "cobertura_parcial") {
    const perO = String(op.personaOrigenId || op.persona_origen_id || "").trim();
    const perD = String(op.personaDestinoId || op.personaCoberturaId || "").trim();
    const fO = String(op.fechaOrigenYmd || op.fecha_origen || op.fechaYmd || "").trim();
    const fD = String(op.fechaDestinoYmd || op.fecha_destino || op.fechaYmd || "").trim();
    return (pid === perO && f === fO) || (pid === perD && f === fD);
  }
  if (tipo === "reemplazo") {
    const per = String(op.personaId || "").trim();
    if (per !== pid) return false;
    const fOrig = String(op.fechaOrigenYmd || "").trim();
    const fDest = String(op.fechaDestinoYmd || op.fechaYmd || "").trim();
    return f === fOrig || f === fDest;
  }
  if (tipo === "adicional") {
    const per = String(op.personaId || "").trim();
    return per === pid && f === String(op.fechaYmd || op.fecha || "").trim();
  }
  return false;
}

/**
 * Simula segmentos extra en un día por ops pendientes (B-N1).
 * @deprecated Preferir {@link proyectarDiaConOpsPendientes}
 * @param {Array<Record<string, unknown>>} ops
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {Record<string, object>} [turnosPorId]
 */
export function segmentosYHorasDesdeOpsPendientes(ops, personaId, fechaYmd, turnosPorId = {}) {
  const extraIds = [];
  let horasExtra = 0;
  for (const op of ops || []) {
    if (String(op.personaId || "") !== personaId) continue;
    const dest = String(op.fechaDestinoYmd || op.fechaYmd || "");
    if (dest !== fechaYmd) continue;

    if (op.tipo === "reemplazo") {
      const lista = Array.isArray(op.segmentosIncorporadosDestino)
        ? op.segmentosIncorporadosDestino.map(String).filter(Boolean)
        : [];
      const ids = lista.length
        ? lista
        : [String(op.turnoIdDestino || op.turnoId || "").trim()].filter(Boolean);
      for (const tid of ids) {
        extraIds.push(tid);
        horasExtra += horasDeSegmento(tid, turnosPorId);
      }
      continue;
    }
    if (op.tipo === "adicional") {
      const tid = String(op.turnoId || "").trim();
      if (tid) {
        extraIds.push(tid);
        horasExtra += horasDeSegmento(tid, turnosPorId);
      }
    }
  }
  return { segmentoIds: extraIds, horasExtra };
}

/**
 * @param {unknown} capaDestino
 * @param {Array<Record<string, unknown>>} opsPendientes
 * @param {string} personaId
 * @param {string} fechaDestinoYmd
 * @param {Record<string, object>} [turnosPorId]
 */
export function estadoDestinoConPreview(capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId = {}) {
  const st = proyectarDiaConOpsPendientes(
    capaDestino,
    opsPendientes,
    personaId,
    fechaDestinoYmd,
    turnosPorId,
  );
  return {
    segmentoIds: st.segmentoIds,
    horas: st.horas,
    etiqueta: st.etiqueta,
  };
}

/**
 * @param {string} periodo YYYY-MM
 */
export function rangoFechasMes(periodo) {
  const m = String(periodo || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return { min: "", max: "", fechas: [] };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ultimo = new Date(y, mo, 0).getDate();
  const pref = `${m[1]}-${m[2]}-`;
  const fechas = [];
  for (let d = 1; d <= ultimo; d += 1) {
    fechas.push(`${pref}${String(d).padStart(2, "0")}`);
  }
  return { min: fechas[0], max: fechas[fechas.length - 1], fechas };
}

/**
 * Turno simple del régimen (M/T/N), no compuesto tipo "Mañana + Tarde".
 * @param {string} turnoId
 * @param {Record<string, object>} [turnosPorId]
 */
export function esTurnoSimpleRegimen(turnoId, turnosPorId = {}) {
  const id = String(turnoId || "").trim();
  if (!id || id.includes("+")) return false;
  const meta = turnosPorId[id] || {};
  const codigo = String(meta.codigo_interno || "").trim();
  const etiqueta = String(meta.etiqueta || "").trim();
  if (codigo.includes("+") || etiqueta.includes("+")) return false;
  if (/manana.*tarde|tarde.*noche|noche.*manana/i.test(etiqueta)) return false;
  return true;
}

/**
 * Turnos del régimen que se pueden sumar en destino (sin colisión, dentro de 24 h).
 * @param {{
 *   capaDestino: unknown;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaDestinoYmd: string;
 *   turnosPorId?: Record<string, { codigo_interno?: string; etiqueta?: string; turno_id?: string }>;
 *   soloSimples?: boolean;
 * }} params
 */
export function turnosIncorporablesEnDestino(params) {
  const {
    capaDestino,
    opsPendientes = [],
    personaId,
    fechaDestinoYmd,
    turnosPorId = {},
    soloSimples = true,
  } = params;
  const idsRegimen = Object.keys(turnosPorId);
  const out = [];
  for (const id of idsRegimen) {
    if (soloSimples && !esTurnoSimpleRegimen(id, turnosPorId)) continue;
    const val = validarIncorporacionDestinoCore({
      capaDestino,
      turnoIdDestino: id,
      opsPendientes,
      personaId,
      fechaDestinoYmd,
      turnosPorId,
    });
    if (val.ok) {
      const meta = turnosPorId[id] || {};
      out.push({
        turno_id: id,
        label: meta.codigo_interno || labelTurnoToken(id) || meta.etiqueta || id,
      });
    }
  }
  return out;
}

/**
 * Opciones paso 3 según tramos marcados en origen (validación intermedia B).
 * @param {{
 *   capaDestino: unknown;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaDestinoYmd: string;
 *   turnosPorId?: Record<string, object>;
 *   segmentosTrasladar?: string[];
 * }} params
 */

/**
 * Busca turno compuesto del régimen que coincida con el conjunto de segmentos simples.
 * @param {string[]} segmentoIds
 * @param {Record<string, object>} turnosPorId
 */
export function resolverCompuestoRegimenParaIncorporacion(segmentoIds, turnosPorId = {}) {
  const simples = [...new Set(segmentoIds.map(String).filter(Boolean))].sort();
  if (!simples.length) return null;

  const labelSimples = etiquetaSegmentosCompuesto(simples, turnosPorId);

  for (const [id, meta] of Object.entries(turnosPorId)) {
    if (!String(id).includes("+")) continue;
    const partes = String(id)
      .split("+")
      .map((x) => x.trim())
      .filter(Boolean)
      .sort();
    if (partes.join("+") === simples.join("+")) {
      return {
        turno_id: id,
        label: meta.codigo_interno || meta.etiqueta || labelSimples,
        segmentos_simples: partes,
      };
    }
    const codigo = String(meta.codigo_interno || meta.etiqueta || "").replace(/\s+/g, "");
    if (codigo && codigo.replace(/\s/g, "") === labelSimples.replace(/\s/g, "")) {
      return {
        turno_id: id,
        label: meta.codigo_interno || meta.etiqueta || labelSimples,
        segmentos_simples: partes,
      };
    }
  }
  return null;
}

/**
 * @param {{
 *   capaDestino: unknown;
 *   turnosIdDestino: string[];
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaDestinoYmd: string;
 *   turnosPorId?: Record<string, object>;
 * }} params
 */
export function validarIncorporacionDestinoMultiple(params) {
  const {
    capaDestino,
    turnosIdDestino,
    opsPendientes = [],
    personaId,
    fechaDestinoYmd,
    turnosPorId = {},
  } = params;
  const ids = [...new Set((turnosIdDestino || []).map((s) => String(s).trim()).filter(Boolean))];
  if (!ids.length) {
    return { ok: false, error: "Elegí los turnos a incorporar en el día destino." };
  }

  const antes = estadoDestinoConPreview(capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId);
  const chocan = ids.filter((id) => antes.segmentoIds.includes(id));
  if (chocan.length) {
    const lbl = etiquetaSegmentosCompuesto(chocan, turnosPorId);
    return {
      ok: false,
      error: `El destino ya tiene ${lbl} (grilla + borradores).`,
      preview: { antes: antes.etiqueta, despues: antes.etiqueta, horas: antes.horas },
    };
  }

  const horasNuevas = ids.reduce((sum, id) => sum + horasDeSegmento(id, turnosPorId), 0);
  const horasDespues = antes.horas + horasNuevas;
  if (horasDespues > TOPE_HORAS_DIA) {
    return {
      ok: false,
      error: `Supera ${TOPE_HORAS_DIA} h en el destino (${horasDespues} h con preview).`,
      preview: {
        antes: antes.etiqueta || "Sin turno / franco",
        despues: etiquetaSegmentosCompuesto([...antes.segmentoIds, ...ids], turnosPorId),
        horas: horasDespues,
      },
    };
  }

  const compuesto = resolverCompuestoRegimenParaIncorporacion(ids, turnosPorId);
  const despuesIds = [...antes.segmentoIds, ...ids];
  const despuesLabel = compuesto?.label || etiquetaSegmentosCompuesto(despuesIds, turnosPorId);

  return {
    ok: true,
    preview: {
      antes: antes.etiqueta || "Sin turno / franco",
      despues: despuesLabel,
      horas: horasDespues,
      horasNuevo: horasNuevas,
      esCompuesto: Boolean(compuesto),
    },
    turnoIdDestinoWire: compuesto?.turno_id || ids[0],
    segmentosIncorporadosDestino: ids,
    etiquetaIncorporacion: compuesto?.label || etiquetaSegmentosCompuesto(ids, turnosPorId),
  };
}

export function resolverOpcionesDestinoTraslado(params) {
  const { segmentosTrasladar = [], turnosPorId = {}, ...base } = params;
  const todos = turnosIncorporablesEnDestino({ ...base, turnosPorId, soloSimples: true });
  const segs = [...new Set(segmentosTrasladar.map((s) => String(s).trim()).filter(Boolean))];

  if (!segs.length) {
    return {
      opciones: [],
      modoMulti: false,
      cantidadRequerida: 0,
      avisoIntermedio: "",
      errorSinOpciones: "",
    };
  }

  if (segs.length === 1) {
    return {
      opciones: todos,
      modoMulti: false,
      cantidadRequerida: 1,
      avisoIntermedio:
        "Todos los tramos marcados se quitan del origen. Elegí un turno de tu régimen para sumar en destino.",
      errorSinOpciones: "",
    };
  }

  const labelsOrigen = etiquetaSegmentosCompuesto(segs, turnosPorId);
  const compuestoOrigen = resolverCompuestoRegimenParaIncorporacion(segs, turnosPorId);

  if (!todos.length) {
    return {
      opciones: [],
      modoMulti: true,
      cantidadRequerida: segs.length,
      avisoIntermedio: "",
      errorSinOpciones:
        `No hay turnos de tu régimen para sumar en este destino (colisión o tope ${TOPE_HORAS_DIA} h). `
        + "Elegí otra fecha o revisá borradores.",
    };
  }

  return {
    opciones: todos,
    modoMulti: true,
    cantidadRequerida: segs.length,
    avisoIntermedio:
      `Marcaste ${labelsOrigen} en origen (${segs.length} tramos). Marcá ${segs.length} turnos en destino `
      + `(p. ej. M+T, T+N, M+N). Si son contiguos en el régimen, se guardan como turno compuesto`
      + (compuestoOrigen ? ` (${compuestoOrigen.label}).` : "."),
    errorSinOpciones: "",
    sugerenciaCompuesto: compuestoOrigen,
  };
}

/**
 * @param {string} turnoChocadoId
 * @param {Array<{ label: string }>} alternativas
 * @param {Record<string, object>} [turnosPorId]
 */
export function mensajeErrorColisionDestino(turnoChocadoId, alternativas, turnosPorId = {}) {
  const meta = turnosPorId[turnoChocadoId] || {};
  const lbl = meta.codigo_interno || labelTurnoToken(turnoChocadoId) || turnoChocadoId;
  const altTexto = (alternativas || []).map((a) => a.label).filter(Boolean);
  if (altTexto.length) {
    return (
      `El destino ya tiene ${lbl} (grilla + borradores). Podés elegir otro día o incorporar en ese día: ${altTexto.join(", ")}. `
      + "En el origen se quitará el tramo seleccionado y el día quedará franco."
    );
  }
  return (
    `El destino ya tiene ${lbl} (grilla + borradores). Elegí otro día o quitá borradores que sumen ese turno.`
  );
}

/**
 * Validación núcleo (sin armar mensaje de alternativas — evita recursión).
 * @param {Parameters<typeof validarIncorporacionDestino>[0]} params
 */
function validarIncorporacionDestinoCore(params) {
  const {
    capaDestino,
    turnoIdDestino,
    opsPendientes = [],
    personaId,
    fechaDestinoYmd,
    turnosPorId = {},
  } = params;
  const tid = String(turnoIdDestino || "").trim();
  if (!tid) {
    return { ok: false, error: "Elegí el turno a incorporar en el día destino." };
  }

  const antes = estadoDestinoConPreview(capaDestino, opsPendientes, personaId, fechaDestinoYmd, turnosPorId);
  if (antes.segmentoIds.includes(tid)) {
    return {
      ok: false,
      codigo: "colision",
      turnoChocadoId: tid,
      error: "",
      preview: { antes: antes.etiqueta, despues: antes.etiqueta, horas: antes.horas },
    };
  }

  const horasNuevo = horasDeSegmento(tid, turnosPorId);
  const horasDespues = antes.horas + horasNuevo;
  if (horasDespues > TOPE_HORAS_DIA) {
    return {
      ok: false,
      error: `Supera ${TOPE_HORAS_DIA} h en el destino (${horasDespues} h con preview).`,
      preview: {
        antes: antes.etiqueta,
        despues: etiquetaSegmentosCompuesto([...antes.segmentoIds, tid], turnosPorId),
        horas: horasDespues,
      },
    };
  }

  const despuesIds = [...antes.segmentoIds, tid];
  return {
    ok: true,
    preview: {
      antes: antes.etiqueta || "Sin turno / franco",
      despues: etiquetaSegmentosCompuesto(despuesIds, turnosPorId),
      horas: horasDespues,
      horasNuevo,
    },
  };
}

export function validarIncorporacionDestino(params) {
  const core = validarIncorporacionDestinoCore(params);
  if (!core.ok && core.codigo === "colision") {
    const alternativas = turnosIncorporablesEnDestino({
      capaDestino: params.capaDestino,
      opsPendientes: params.opsPendientes,
      personaId: params.personaId,
      fechaDestinoYmd: params.fechaDestinoYmd,
      turnosPorId: params.turnosPorId,
    });
    return {
      ...core,
      alternativas,
      error: mensajeErrorColisionDestino(core.turnoChocadoId, alternativas, params.turnosPorId),
    };
  }
  return core;
}

/**
 * Valida traslado completo: tramos en origen + turno a incorporar en destino (RFC §3.2).
 * @param {{
 *   capaDestino: unknown;
 *   segmentosTrasladar: string[];
 *   turnoIdDestino: string;
 *   opsPendientes?: Array<Record<string, unknown>>;
 *   personaId: string;
 *   fechaDestinoYmd: string;
 *   turnosPorId?: Record<string, object>;
 * }} params
 */
export function validarTrasladoPropioDestino(params) {
  const segs = [...new Set((params.segmentosTrasladar || []).map((s) => String(s).trim()).filter(Boolean))];
  if (!segs.length) {
    return { ok: false, error: "Seleccioná al menos un tramo en el día origen." };
  }

  const fOrig = String(params.fechaOrigenYmd || params.fechaDestinoYmd || "").trim();
  const fDest = String(params.fechaDestinoYmd || "").trim();

  const idsDest = Array.isArray(params.turnosIdDestino)
    ? params.turnosIdDestino.map(String).filter(Boolean)
    : params.turnoIdDestino
      ? [String(params.turnoIdDestino).trim()]
      : [];

  if (fOrig && fOrig === fDest && idsDest.length === segs.length) {
    const a = [...segs].sort();
    const b = [...idsDest].sort();
    if (a.every((id, i) => id === b[i])) {
      return {
        ok: false,
        error: "Traslado sin efecto: los mismos tramos en origen y destino (mismo día).",
      };
    }
  }

  const previewOrigen = proyectarDiaConOpsPendientes(
    params.capaOrigen,
    params.opsPendientes,
    params.personaId,
    fOrig,
    params.turnosPorId,
  );
  if (params.capaOrigen) {
    const subOrigen = segs.filter((id) => !previewOrigen.segmentoIds.includes(id));
    if (subOrigen.length) {
      const lbl = etiquetaSegmentosCompuesto(subOrigen, params.turnosPorId);
      return {
        ok: false,
        error: `Algún tramo marcado no está disponible en origen (${lbl}). Revisá borradores pendientes.`,
      };
    }
  }

  const opcs = resolverOpcionesDestinoTraslado({
    capaDestino: params.capaDestino,
    opsPendientes: params.opsPendientes,
    personaId: params.personaId,
    fechaDestinoYmd: params.fechaDestinoYmd,
    turnosPorId: params.turnosPorId,
    segmentosTrasladar: segs,
  });
  if (!opcs.opciones.length) {
    return { ok: false, error: opcs.errorSinOpciones || "No hay turnos disponibles para incorporar." };
  }

  if (opcs.modoMulti) {
    if (idsDest.length !== opcs.cantidadRequerida) {
      return {
        ok: false,
        error: `Marcá exactamente ${opcs.cantidadRequerida} turno(s) en destino (misma cantidad que en origen).`,
      };
    }
    const habilitados = new Set(opcs.opciones.map((o) => o.turno_id));
    const invalidos = idsDest.filter((id) => !habilitados.has(id));
    if (invalidos.length) {
      return {
        ok: false,
        error: "Algún turno elegido en destino no está disponible (colisión o tope de horas).",
      };
    }
    return validarIncorporacionDestinoMultiple({
      capaDestino: params.capaDestino,
      turnosIdDestino: idsDest,
      opsPendientes: params.opsPendientes,
      personaId: params.personaId,
      fechaDestinoYmd: params.fechaDestinoYmd,
      turnosPorId: params.turnosPorId,
    });
  }

  const tid = idsDest[0] || "";
  if (!tid) {
    return { ok: false, error: "Elegí el turno a incorporar en el día destino." };
  }
  if (!opcs.opciones.some((o) => o.turno_id === tid)) {
    return { ok: false, error: "El turno elegido en destino no está habilitado." };
  }
  return validarIncorporacionDestino({
    capaDestino: params.capaDestino,
    turnoIdDestino: tid,
    opsPendientes: params.opsPendientes,
    personaId: params.personaId,
    fechaDestinoYmd: params.fechaDestinoYmd,
    turnosPorId: params.turnosPorId,
  });
}

/**
 * @param {Record<string, unknown>} op
 */
/**
 * Franco en origen solo si no queda ningún tramo teórico tras quitar los marcados.
 * @param {string[]} segmentosIdsOrigen — todos los tramos activos del día origen
 * @param {string[]} segmentosTrasladar — subset a quitar
 */
export function origenQuedaFrancoCompleto(segmentosIdsOrigen, segmentosTrasladar) {
  const origen = [...new Set((segmentosIdsOrigen || []).map(String).filter(Boolean))];
  const quitar = new Set((segmentosTrasladar || []).map(String).filter(Boolean));
  if (!origen.length) return false;
  return origen.every((id) => quitar.has(id));
}

/**
 * @param {string[]} segmentosIdsOrigen
 * @param {string[]} segmentosTrasladar
 * @param {Record<string, object>} [turnosPorId]
 */
export function etiquetaSaldoOrigenTrasTraslado(segmentosIdsOrigen, segmentosTrasladar, turnosPorId = {}) {
  const origen = [...new Set((segmentosIdsOrigen || []).map(String).filter(Boolean))];
  const quitar = new Set((segmentosTrasladar || []).map(String).filter(Boolean));
  const restantes = origen.filter((id) => !quitar.has(id));
  if (!restantes.length) return "franco";
  return etiquetaSegmentosCompuesto(restantes, turnosPorId);
}

export function esReemplazoPropioV2(op) {
  return (
    op?.tipo === "reemplazo"
    && Boolean(op.fechaOrigenYmd)
    && Boolean(op.fechaDestinoYmd)
    && Array.isArray(op.segmentosTrasladar)
    && op.segmentosTrasladar.length > 0
    && Boolean(String(op.turnoIdDestino || "").trim())
  );
}

/**
 * Operación outbox F-UX flujo B (RFC §3.2).
 * @param {{
 *   id?: string;
 *   personaId: string;
 *   fechaOrigenYmd: string;
 *   fechaDestinoYmd: string;
 *   segmentosTrasladar: string[];
 *   turnoIdDestino: string;
 *   segmentosIncorporadosDestino?: string[];
 *   francoEnOrigen?: boolean;
 *   motivo: string;
 *   expectedVersionToken: string;
 *   expectedVersionTokenOrigen?: string;
 *   grupoId: string;
 *   periodo: string;
 *   personaLabel?: string;
 *   grupoLabel?: string;
 *   creado_en?: string;
 * }} params
 */
export function buildReemplazoPropioOutboxOp(params) {
  const segs = [...new Set((params.segmentosTrasladar || []).map(String).filter(Boolean))];
  const incorporados = Array.isArray(params.segmentosIncorporadosDestino)
    ? [...new Set(params.segmentosIncorporadosDestino.map(String).filter(Boolean))]
    : [];
  const turnoDest = String(params.turnoIdDestino || incorporados[0] || "").trim();
  const fechaDestino = String(params.fechaDestinoYmd || "").trim();
  const fechaOrigen = String(params.fechaOrigenYmd || "").trim();
  return {
    id: params.id,
    creado_en: params.creado_en,
    tipo: "reemplazo",
    personaId: params.personaId,
    personaLabel: String(params.personaLabel || "").trim(),
    fechaYmd: fechaDestino,
    fechaOrigenYmd: fechaOrigen,
    fechaDestinoYmd: fechaDestino,
    segmentosTrasladar: segs,
    turnoIdDestino: turnoDest,
    segmentosIncorporadosDestino: incorporados.length ? incorporados : [turnoDest].filter(Boolean),
    francoEnOrigen: params.francoEnOrigen === true,
    motivo: String(params.motivo || "").trim(),
    expectedVersionToken: String(params.expectedVersionToken || "").trim(),
    expectedVersionTokenOrigen: String(params.expectedVersionTokenOrigen || "").trim(),
    grupoId: params.grupoId,
    periodo: params.periodo,
    grupoLabel: String(params.grupoLabel || "").trim(),
  };
}
