"use strict";

const { FieldPath } = require("firebase-admin/firestore");

const COL_SOL = "solicitudes_articulo";
const ORDER_FIELD = "fecha_inicio_reposo_estimada";

/** Docs leídos por batch Firestore en un request de listado. */
const FIRESTORE_BATCH_SIZE = 30;
/** Tope de batches por request (evita timeout en cold start). */
const MAX_FIRESTORE_BATCHES = 20;

/**
 * @param {string} cursor
 * @returns {{ fecha_ymd: string, solicitud_id: string } | null}
 */
function parseAuditorBandejaCursor(cursor) {
  const raw = String(cursor || "").trim();
  if (!raw) return null;
  const pipe = raw.indexOf("|");
  if (pipe > 0) {
    const fechaYmd = raw.slice(0, pipe).slice(0, 10);
    const solicitudId = raw.slice(pipe + 1).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaYmd) && /^sol_/i.test(solicitudId)) {
      return { fecha_ymd: fechaYmd, solicitud_id: solicitudId };
    }
  }
  if (/^sol_/i.test(raw)) {
    return { fecha_ymd: "", solicitud_id: raw };
  }
  return null;
}

/**
 * @param {string} fechaYmd
 * @param {string} solicitudId
 */
function encodeAuditorBandejaCursor(fechaYmd, solicitudId) {
  const f = String(fechaYmd || "").slice(0, 10);
  const id = String(solicitudId || "").trim();
  if (!/^sol_/i.test(id)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return `${f}|${id}`;
  return id;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   estadoPendiente: string,
 *   titularIds?: Set<string> | null,
 * }} params
 */
function buildAuditorBandejaBaseQuery(db, params) {
  const estado = String(params.estadoPendiente || "").trim();
  let q = db.collection(COL_SOL).where("estado_solicitud_id", "==", estado);

  const titularIds = params.titularIds;
  if (titularIds && titularIds.size > 0) {
    const ids = [...titularIds].filter((id) => /^per_/i.test(id));
    if (ids.length === 1) {
      q = q.where("titular_persona_id", "==", ids[0]);
    } else if (ids.length > 1) {
      q = q.where("titular_persona_id", "in", ids.slice(0, 30));
    }
  }

  return q.orderBy(ORDER_FIELD, "asc").orderBy(FieldPath.documentId(), "asc");
}

/**
 * Escaneo paginado Firestore hasta llenar `pageSize` ítems ya mapeados o agotar batches.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   estadoPendiente: string,
 *   titularIds?: Set<string> | null,
 *   cursor: string,
 *   pageSize: number,
 *   mapDoc: (doc: import("firebase-admin/firestore").QueryDocumentSnapshot) => Promise<Record<string, unknown> | null>,
 * }} params
 */
async function escanearBandejaAuditorPaginada(db, params) {
  const pageSize = Math.max(1, Math.floor(Number(params.pageSize) || 10));
  const parsed = parseAuditorBandejaCursor(params.cursor);
  let q = buildAuditorBandejaBaseQuery(db, {
    estadoPendiente: params.estadoPendiente,
    titularIds: params.titularIds,
  });

  const items = [];
  let batches = 0;
  let lastBatchSize = 0;
  let firestoreExhausted = false;
  let hasMore = false;
  let startAfterFecha = parsed?.fecha_ymd || null;
  let startAfterId = parsed?.solicitud_id || null;

  while (items.length < pageSize && batches < MAX_FIRESTORE_BATCHES) {
    let pageQuery = q;
    if (startAfterFecha && startAfterId) {
      pageQuery = pageQuery.startAfter(startAfterFecha, startAfterId);
    }

    const snap = await pageQuery.limit(FIRESTORE_BATCH_SIZE).get();
    batches += 1;
    lastBatchSize = snap.docs.length;

    if (lastBatchSize === 0) {
      firestoreExhausted = true;
      break;
    }

    let docsConsumed = 0;
    for (const doc of snap.docs) {
      docsConsumed += 1;
      const mapped = await params.mapDoc(doc);
      if (!mapped) continue;
      items.push(mapped);
      if (items.length >= pageSize) {
        hasMore = docsConsumed < snap.docs.length || lastBatchSize === FIRESTORE_BATCH_SIZE;
        break;
      }
    }

    const lastDoc = snap.docs[snap.docs.length - 1];
    const lastData = lastDoc.data() || {};
    startAfterFecha = String(lastData[ORDER_FIELD] || "").slice(0, 10);
    startAfterId = lastDoc.id;

    if (items.length >= pageSize) {
      break;
    }

    if (lastBatchSize < FIRESTORE_BATCH_SIZE) {
      firestoreExhausted = true;
      break;
    }
  }

  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const pageFilled = items.length === pageSize;
  if (pageFilled && !hasMore && !firestoreExhausted && lastBatchSize === FIRESTORE_BATCH_SIZE) {
    hasMore = true;
  }

  const nextCursor =
    pageFilled && hasMore && lastItem
      ? encodeAuditorBandejaCursor(String(lastItem.fecha_desde || ""), String(lastItem.solicitud_id || ""))
      : null;

  return {
    items,
    has_more: pageFilled && hasMore,
    next_cursor: nextCursor,
    total_filtrado: null,
    firestore_batches: batches,
    order_field: ORDER_FIELD,
  };
}

module.exports = {
  COL_SOL,
  ORDER_FIELD,
  FIRESTORE_BATCH_SIZE,
  MAX_FIRESTORE_BATCHES,
  parseAuditorBandejaCursor,
  encodeAuditorBandejaCursor,
  buildAuditorBandejaBaseQuery,
  escanearBandejaAuditorPaginada,
};
