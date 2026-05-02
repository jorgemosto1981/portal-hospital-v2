import { useCallback, useEffect, useMemo, useState } from "react";

import { hasAnyPortalRole, normalizePortalRole } from "../routing/portalRole.js";

/**
 * @param {import("@firebase/auth").User | null} user
 */
export function useAuthClaims(user) {
  const [tokenClaims, setTokenClaims] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [internalLoading, setInternalLoading] = useState(!!user);

  useEffect(() => {
    if (!user) {
      return;
    }
    let c = true;
    queueMicrotask(() => {
      if (c) setInternalLoading(true);
    });
    user
      .getIdTokenResult()
      .then((r) => {
        if (!c) return;
        setTokenClaims((r && r.claims) || {});
        setInternalLoading(false);
      })
      .catch(() => {
        if (!c) return;
        setTokenClaims(null);
        setInternalLoading(false);
      });
    return () => {
      c = false;
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
