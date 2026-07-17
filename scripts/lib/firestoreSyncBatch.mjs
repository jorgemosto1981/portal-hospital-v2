/**
 * Escritor por lotes Firestore con tope conservador (400 ops / batch).
 */

export const BATCH_OPS_LIMIT = 400;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ dryRun: boolean; stats: Record<string, number> }} opts
 */
export function createBatchWriter(db, { dryRun, stats }) {
  let batch = db.batch();
  let ops = 0;

  async function flush() {
    if (ops === 0) return;
    if (!dryRun) {
      await batch.commit();
    }
    stats.batches += 1;
    stats.writes += ops;
    batch = db.batch();
    ops = 0;
  }

  return {
    /**
     * @param {FirebaseFirestore.DocumentReference} ref
     * @param {Record<string, unknown>} data
     * @param {{ merge?: boolean }} [options]
     */
    async set(ref, data, options = {}) {
      stats.docs += 1;
      if (dryRun) return;
      const merge = options.merge === true;
      if (merge) {
        batch.set(ref, data, { merge: true });
      } else {
        batch.set(ref, data);
      }
      ops += 1;
      if (ops >= BATCH_OPS_LIMIT) {
        await flush();
      }
    },

    async commit() {
      await flush();
    },

    get pendingOps() {
      return ops;
    },
  };
}
