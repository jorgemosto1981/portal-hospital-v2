import { useEffect, useState } from "react";

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

  return {
    claims: user ? tokenClaims : null,
    claimsLoading: user ? internalLoading : false,
  };
}
