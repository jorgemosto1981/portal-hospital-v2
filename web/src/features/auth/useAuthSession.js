import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { authV2 } from "../../services/firebase.js";

/**
 * Sesión Firebase Auth V2: usuario actual y bandera de carga inicial.
 */
export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(authV2, (u) => {
        setUser(u);
        setPending(false);
      }),
    [],
  );

  return { user, authPending: pending, auth: authV2 };
}
