export const POST_LOGIN_LOADER_FLAG = "portal_post_login_loading_v1";

export function markPostLoginLoaderStart() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      POST_LOGIN_LOADER_FLAG,
      JSON.stringify({ enabled: true, startedAt: Date.now() }),
    );
  } catch {
    // opcional
  }
}

export function clearPostLoginLoaderFlag() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(POST_LOGIN_LOADER_FLAG);
  } catch {
    // opcional
  }
}

export function readPostLoginLoaderStartedAt() {
  if (typeof window === "undefined") return 0;
  let raw = "";
  try {
    raw = window.sessionStorage.getItem(POST_LOGIN_LOADER_FLAG) || "";
  } catch {
    return 0;
  }
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.enabled === true && Number.isFinite(Number(parsed.startedAt))) {
      return Number(parsed.startedAt);
    }
  } catch {
    if (raw === "1") return Date.now();
  }
  return 0;
}
