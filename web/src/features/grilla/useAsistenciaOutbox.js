import { useCallback, useEffect, useMemo, useState } from "react";

const OUTBOX_PREFIX = "outbox_ops";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function buildStorageKey(editorPersonaId, periodo) {
  return `${OUTBOX_PREFIX}_${String(editorPersonaId || "").trim()}_${String(periodo || "").trim()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseEnvelope(raw) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (!parsed || typeof parsed !== "object") return null;
    const ops = Array.isArray(parsed.ops) ? parsed.ops : [];
    return {
      ...parsed,
      ops,
    };
  } catch {
    return null;
  }
}

/**
 * Outbox local de asistencia (RAM + localStorage + TTL).
 * El borrador recuperado se ofrece en "pendingRecovery" hasta que el usuario decide recuperar/descartar.
 */
export function useAsistenciaOutbox({ editorPersonaId, periodo, ttlMs = DEFAULT_TTL_MS }) {
  const storageKey = useMemo(
    () => buildStorageKey(editorPersonaId, periodo),
    [editorPersonaId, periodo],
  );

  const [ops, setOps] = useState([]);
  const [pendingRecovery, setPendingRecovery] = useState(null);

  useEffect(() => {
    setOps([]);
    setPendingRecovery(null);
    if (!storageKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const env = parseEnvelope(raw);
    if (!env) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const updatedAtMs = Date.parse(env.updatedAt || env.createdAt || "");
    const expired = Number.isNaN(updatedAtMs) || Date.now() - updatedAtMs > ttlMs;
    if (expired) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    if (!env.ops.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    setPendingRecovery({
      ...env,
      count: env.ops.length,
    });
  }, [storageKey, ttlMs]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (!ops.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const ts = nowIso();
    const envelope = {
      editorPersonaId: String(editorPersonaId || "").trim(),
      periodo: String(periodo || "").trim(),
      createdAt: ts,
      updatedAt: ts,
      ops,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(envelope));
  }, [ops, storageKey, editorPersonaId, periodo]);

  const addOp = useCallback((op) => {
    setOps((prev) => [
      ...prev,
      {
        id: globalThis.crypto?.randomUUID?.() || `op_${Date.now()}_${prev.length + 1}`,
        creado_en: nowIso(),
        ...op,
      },
    ]);
  }, []);

  const removeOp = useCallback((opId) => {
    setOps((prev) => prev.filter((o) => o.id !== opId));
  }, []);

  const clear = useCallback(() => {
    setOps([]);
    setPendingRecovery(null);
    if (storageKey && typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const recoverPending = useCallback(() => {
    if (!pendingRecovery) return;
    setOps(Array.isArray(pendingRecovery.ops) ? pendingRecovery.ops : []);
    setPendingRecovery(null);
  }, [pendingRecovery]);

  const discardPending = useCallback(() => {
    setPendingRecovery(null);
    if (storageKey && typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    key: storageKey,
    ops,
    count: ops.length,
    hasPending: ops.length > 0,
    pendingRecovery,
    addOp,
    removeOp,
    clear,
    recoverPending,
    discardPending,
  };
}
