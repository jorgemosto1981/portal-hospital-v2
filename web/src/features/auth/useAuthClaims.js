import { onIdTokenChanged } from "firebase/auth";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { hasAnyPortalRole, normalizePortalRole } from "../routing/portalRole.js";
import { authV2 } from "../../services/firebase.js";

/**
 * Estado global de claims (una sola suscripción `onIdTokenChanged` para toda la app).
 * Evita carreras entre varias instancias del hook y el bucle portal ↔ vinculación cuando
 * un `getIdTokenResult` falla y otra instancia tenía claims válidos.
 */
/** @type {string | null} */
let sharedUid = null;
/** @type {Record<string, unknown> | null} */
let sharedClaims = null;
/** Primer resultado listo para el `sharedUid` actual (sin bloquear refrescos posteriores). */
let sharedHydrated = false;
/** Solo “carga inicial” por usuario; los refrescos de token no activan el spinner global. */
let sharedLoading = false;
let storeVersion = 0;

const listeners = new Set();

/**
 * Snapshot estable para `useSyncExternalStore`: misma referencia hasta `emit()`;
 * si `getSnapshot()` creara un objeto nuevo en cada llamada, React entra en bucle infinito.
 * @type {{ v: number, uid: string | null, claims: Record<string, unknown> | null, hydrated: boolean, loading: boolean }}
 */
let cachedSnapshot;

function rebuildCachedSnapshot() {
  cachedSnapshot = {
    v: storeVersion,
    uid: sharedUid,
    claims: sharedClaims,
    hydrated: sharedHydrated,
    loading: sharedLoading,
  };
}

function emit() {
  storeVersion += 1;
  rebuildCachedSnapshot();
  listeners.forEach((l) => l());
}

rebuildCachedSnapshot();

/** @type {null | (() => void)} */
let firebaseUnsub = null;

function subscribeGlobal(callback) {
  listeners.add(callback);
  ensureFirebaseSubscription();
  return () => {
    listeners.delete(callback);
  };
}

function ensureFirebaseSubscription() {
  if (firebaseUnsub) return;
  firebaseUnsub = onIdTokenChanged(authV2, async (firebaseUser) => {
    if (!firebaseUser) {
      sharedUid = null;
      sharedClaims = null;
      sharedHydrated = false;
      sharedLoading = false;
      emit();
      return;
    }

    const uid = firebaseUser.uid;
    const uidChanged = sharedUid !== uid;
    sharedUid = uid;

    if (uidChanged) {
      sharedClaims = null;
      sharedHydrated = false;
    }

    const needsBlockingSpinner = !sharedHydrated;
    if (needsBlockingSpinner) {
      sharedLoading = true;
      emit();
    }

    try {
      const r = await firebaseUser.getIdTokenResult();
      if (authV2.currentUser?.uid !== uid) return;
      sharedClaims = (r && r.claims) || {};
      sharedHydrated = true;
    } catch {
      if (authV2.currentUser?.uid !== uid) return;
      if (!sharedHydrated) {
        sharedClaims = {};
        sharedHydrated = true;
      }
    } finally {
      if (authV2.currentUser?.uid === uid && needsBlockingSpinner) {
        sharedLoading = false;
      }
      emit();
    }
  });
}

function getSnapshot() {
  return cachedSnapshot;
}

/**
 * @param {import("@firebase/auth").User | null} user
 */
export function useAuthClaims(user) {
  const snap = useSyncExternalStore(subscribeGlobal, getSnapshot, getSnapshot);

  const { claims, claimsLoading } = useMemo(() => {
    if (!user) {
      return { claims: /** @type {Record<string, unknown> | null} */ (null), claimsLoading: false };
    }
    if (snap.uid !== user.uid) {
      return { claims: null, claimsLoading: true };
    }
    if (!snap.hydrated || snap.loading) {
      return { claims: snap.claims, claimsLoading: true };
    }
    return { claims: snap.claims, claimsLoading: false };
  }, [user, snap.uid, snap.claims, snap.hydrated, snap.loading]);

  const portalRole = useMemo(() => normalizePortalRole(claims), [claims]);
  const hasPortalRoles = useCallback(
    (/** @type {readonly string[]} */ allowed) => hasAnyPortalRole(claims, allowed),
    [claims],
  );

  return {
    claims,
    claimsLoading: user ? claimsLoading : false,
    portalRole,
    hasPortalRoles,
  };
}
