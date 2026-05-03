import { onIdTokenChanged } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hasAnyPortalRole, normalizePortalRole } from "../routing/portalRole.js";
import { authV2 } from "../../services/firebase.js";

/**
 * @param {import("@firebase/auth").User | null} user
 */
export function useAuthClaims(user) {
  const [tokenClaims, setTokenClaims] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [internalLoading, setInternalLoading] = useState(!!user);

  useEffect(() => {
    if (!user) {
      setTokenClaims(null);
      setInternalLoading(false);
      return;
    }
    let cancelled = false;
    setInternalLoading(true);

    const unsub = onIdTokenChanged(authV2, async (firebaseUser) => {
      if (cancelled) return;
      if (!firebaseUser) {
        setTokenClaims(null);
        setInternalLoading(false);
        return;
      }
      try {
        const r = await firebaseUser.getIdTokenResult();
        if (cancelled) return;
        setTokenClaims((r && r.claims) || {});
      } catch {
        if (!cancelled) {
          setTokenClaims(null);
        }
      } finally {
        if (!cancelled) {
          setInternalLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const claims = user ? tokenClaims : null;
  const portalRole = useMemo(() => normalizePortalRole(claims), [claims]);
  const hasPortalRoles = useCallback(
    (/** @type {readonly string[]} */ allowed) => hasAnyPortalRole(claims, allowed),
    [claims],
  );

  return {
    claims,
    claimsLoading: user ? internalLoading : false,
    /** Rol del token normalizado (`rrhh`, `admin`, …) o `null`. */
    portalRole,
    hasPortalRoles,
  };
}
