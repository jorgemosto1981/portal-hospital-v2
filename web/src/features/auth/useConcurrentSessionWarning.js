import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { callRegistrarSesionActiva, callVerificarSesionConcurrente } from "../../services/callables.js";

const SESSION_ID_KEY = "portal_v2_session_id";
const CHECK_THROTTLE_MS = 2 * 60 * 1000;
const TOUCH_THROTTLE_MS = 10 * 60 * 1000;

function ensureSessionId() {
  if (typeof window === "undefined") return "";
  const current = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (current) return current;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(SESSION_ID_KEY, generated);
  return generated;
}

function deviceHint() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const ua = String(navigator.userAgent || "").toLowerCase();
  let browser = "browser";
  if (ua.includes("edg/")) browser = "edge";
  else if (ua.includes("chrome/")) browser = "chrome";
  else if (ua.includes("firefox/")) browser = "firefox";
  else if (ua.includes("safari/")) browser = "safari";
  const platform = String(navigator.platform || "").trim() || "unknown";
  return `${browser}-${platform}`.slice(0, 120);
}

function formatEsArDateTime(ms) {
  if (!ms || !Number.isFinite(ms)) return "";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function useConcurrentSessionWarning({ user, personaId }) {
  const [showWarning, setShowWarning] = useState(false);
  const [lastLoginMs, setLastLoginMs] = useState(null);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const dismissWarning = useCallback(() => setShowWarning(false), []);

  const verify = useCallback(
    async ({ force = false, touch = false } = {}) => {
      if (!user || checkingRef.current) return;
      const now = Date.now();
      if (!force && now - lastCheckRef.current < CHECK_THROTTLE_MS) return;
      checkingRef.current = true;
      lastCheckRef.current = now;
      try {
        const sid = ensureSessionId();
        if (!sid) return;
        const res = await callVerificarSesionConcurrente({
          session_id: sid,
          touch,
          touch_throttle_ms: TOUCH_THROTTLE_MS,
        });
        const data = res?.data || {};
        setShowWarning(data.warning_concurrente === true);
        if (Number.isFinite(data.last_login_at_ms) && Number(data.last_login_at_ms) > 0) {
          setLastLoginMs(Number(data.last_login_at_ms));
        }
      } catch {
        // En warning-only degradamos silenciosamente.
      } finally {
        checkingRef.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      setLastLoginMs(null);
      return;
    }
    let cancelled = false;
    async function register() {
      try {
        const sid = ensureSessionId();
        if (!sid) return;
        const res = await callRegistrarSesionActiva({
          session_id: sid,
          persona_id: personaId || null,
          device_hint: deviceHint(),
        });
        if (cancelled) return;
        const data = res?.data || {};
        setShowWarning(data.warning_concurrente === true);
        if (Number.isFinite(data.last_login_at_previo_ms) && Number(data.last_login_at_previo_ms) > 0) {
          setLastLoginMs(Number(data.last_login_at_previo_ms));
        }
      } catch {
        // degradar silenciosamente
      }
    }
    void register();
    return () => {
      cancelled = true;
    };
  }, [user, personaId]);

  useEffect(() => {
    if (!user) return undefined;
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      void verify({ force: true, touch: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, verify]);

  const lastLoginLabel = useMemo(() => formatEsArDateTime(lastLoginMs), [lastLoginMs]);

  return {
    showWarning,
    dismissWarning,
    lastLoginLabel,
  };
}

