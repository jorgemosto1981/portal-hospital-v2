import { signOut } from "firebase/auth";

import { authV2 } from "../../services/firebase.js";

function clearClientStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
  } catch {
    // noop
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // noop
  }
}

export async function secureSignOut({ navigate, reason = "" } = {}) {
  clearClientStorage();
  try {
    await signOut(authV2);
  } catch {
    // Ignorar para asegurar salida defensiva en entorno compartido.
  }
  if (typeof navigate === "function") {
    const motivo = String(reason || "").trim();
    const target = motivo ? `/login?motivo=${encodeURIComponent(motivo)}` : "/login";
    navigate(target, { replace: true });
  }
}

