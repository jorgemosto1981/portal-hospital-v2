const DEFAULT_AFTER_LOGIN = "/portal/home";

/** @param {string | null} raw */
export function safeRedirectPath(raw) {
  if (!raw || typeof raw !== "string") return DEFAULT_AFTER_LOGIN;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  return t;
}

export { DEFAULT_AFTER_LOGIN };
