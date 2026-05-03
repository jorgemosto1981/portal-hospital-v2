import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import { safeRedirectPath } from "../routing/redirectPaths.js";
import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import {
  callRegistroPrimerAcceso,
  callResolverEmailLoginDni,
  callSyncSessionClaims,
} from "../../services/callables.js";
import { authV2 } from "../../services/firebase.js";
import { normalizeDni, vincularCuentaPorDni } from "../../services/authService.js";
import Card from "../../components/ui/Card.jsx";
import DataOperationFeedback from "../../components/ui/DataOperationFeedback.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { useAuthClaims } from "./useAuthClaims.js";
import { useAuthSession } from "./useAuthSession.js";

const INPUT =
  "min-h-12 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200/80";

const MSG_CUENTA_YA_CREADA =
  "Tu cuenta ya fue creada. Por favor, ve a la pantalla de Iniciar Sesión.";

/** @param {unknown} err */
function callablePideIrALogin(err) {
  const o = err && typeof err === "object" ? /** @type {Record<string, unknown>} */ (err) : {};
  const raw = o.customData ?? o.details;
  return !!(raw && typeof raw === "object" && /** @type {Record<string, unknown>} */ (raw).redirect_login === true);
}

/**
 * Pantalla única de acceso: iniciar sesión (DNI + PIN) y primer registro (DNI + correo + PIN).
 * URL: `/login` · primer acceso: `/login?alta=1` (compat: `/registro` redirige aquí).
 */
export default function AccesoPortal() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const personaIdClaim = typeof claims?.persona_id === "string" ? claims.persona_id : "";

  const tabFromUrl = searchParams.get("alta") === "1" ? "registro" : "login";
  const [tab, setTab] = useState(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const setTabLogin = useCallback(() => {
    setTab("login");
    const next = new URLSearchParams(searchParams);
    next.delete("alta");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setTabRegistro = useCallback(() => {
    setTab("registro");
    const next = new URLSearchParams(searchParams);
    next.set("alta", "1");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  /* ——— Login ——— */
  const [dniLogin, setDniLogin] = useState("");
  const [pinLogin, setPinLogin] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);
  const [feedbackLogin, setFeedbackLogin] = useState(/** @type {null | { status: string, message: string }} */ (null));

  async function handleLogin(e) {
    e.preventDefault();
    const d = String(dniLogin || "").replace(/\D/g, "");
    const p = String(pinLogin).trim();
    if (!/^\d{6,12}$/.test(d)) {
      setFeedbackLogin({ status: "error", message: "Ingresá un DNI válido (6 a 12 dígitos)." });
      return;
    }
    if (!/^\d{6}$/.test(p)) {
      setFeedbackLogin({ status: "error", message: "El PIN debe ser exactamente 6 dígitos." });
      return;
    }
    setBusyLogin(true);
    setFeedbackLogin({ status: "loading", message: "Verificando credenciales…" });
    const t = toast.loading("Iniciando sesión…");
    try {
      const res = await callResolverEmailLoginDni({ dni: d });
      const email = res?.data?.email;
      if (typeof email !== "string" || !email) {
        throw new Error("Respuesta inválida del servidor");
      }
      await signInWithEmailAndPassword(authV2, email, p);
      try {
        await callSyncSessionClaims();
        if (authV2.currentUser) {
          await authV2.currentUser.getIdToken(true);
        }
      } catch (syncErr) {
        try {
          await signOut(authV2);
        } catch {
          /* ignore */
        }
        const syncMsg =
          (syncErr && /** @type {{ message?: string }} */ (syncErr).message) ||
          "No se pudieron sincronizar los permisos de la cuenta.";
        setFeedbackLogin({ status: "error", message: syncMsg });
        toast.error("No se pudo completar el acceso. Volvé a intentar o contactá soporte.", { id: t });
        return;
      }
      setFeedbackLogin({ status: "success", message: "Sesión iniciada correctamente" });
      toast.success("Bienvenido", { id: t });
      nav(safeRedirectPath(searchParams.get("redirect")), { replace: true });
    } catch (err) {
      const code = err?.code;
      const isAuth = code && String(code).startsWith("auth/");
      const msg = isAuth
        ? "DNI o PIN incorrectos, o la cuenta no está habilitada."
        : (err?.message && String(err.message)) || "No se pudo iniciar sesión. Intentá de nuevo.";
      setFeedbackLogin({ status: "error", message: msg });
      toast.error("No se pudo iniciar sesión", { id: t });
      try {
        if (authV2.currentUser) {
          await signOut(authV2);
        }
      } catch {
        /* ignore */
      }
    } finally {
      setBusyLogin(false);
    }
  }

  /* ——— Primer registro ——— */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dniReg, setDniReg] = useState("");
  const [busyReg, setBusyReg] = useState(false);
  const [showPin, setShowPin] = useState(false);

  async function onCreateAccount(e) {
    e.preventDefault();
    const d = normalizeDni(dniReg);
    if (!/^\d{6,12}$/.test(d)) {
      toast.error("Ingresá un DNI con 6 a 12 dígitos.");
      return;
    }
    const pinDigits = String(password || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(pinDigits)) {
      toast.error("El PIN debe ser exactamente 6 dígitos numéricos (lo exige el servidor en primer acceso).");
      return;
    }
    setBusyReg(true);
    const t = toast.loading("Registrando y vinculando cuenta…");
    let registroCallableOk = false;
    try {
      if (authV2.currentUser) {
        await vincularCuentaPorDni(d);
        toast.success("Cuenta ya autenticada: vínculo completado. Continuá con el onboarding.", { id: t });
        nav("/onboarding", { replace: true });
        return;
      }
      const emailNorm = String(email || "").trim().toLowerCase();
      await callRegistroPrimerAcceso({ dni: d, email: emailNorm, pin: pinDigits });
      registroCallableOk = true;
      await signInWithEmailAndPassword(authV2, emailNorm, pinDigits);
      if (authV2.currentUser) await authV2.currentUser.getIdToken(true);
      toast.success("Registro completado. Continuá con el onboarding.", { id: t });
      nav("/onboarding", { replace: true });
    } catch (err) {
      const mRaw = (err && /** @type {{ message?: string, code?: string }} */ (err).message) || "";
      const code = (err && /** @type {{ code?: string }} */ (err).code) || "";
      const irLogin =
        registroCallableOk || code === "auth/email-already-in-use" || callablePideIrALogin(err);
      const m = irLogin ? MSG_CUENTA_YA_CREADA : mRaw || "Error al registrarse";
      toast.error(m, { id: t });
    } finally {
      setBusyReg(false);
    }
  }

  const busy = busyLogin || busyReg;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <PublicAuthMenu />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-5">
        {user && personaIdClaim ? (
          <Card className="mb-4 border-slate-200/80 p-4 text-sm shadow-md">
            <p className="font-semibold text-slate-800">Tu cuenta ya está vinculada.</p>
            <p className="mt-1 text-slate-600">Podés ir al inicio del portal.</p>
            <div className="mt-3">
              <PrimaryButton type="button" onClick={() => nav("/portal/home", { replace: true })} className="w-full">
                Ir al inicio
              </PrimaryButton>
            </div>
          </Card>
        ) : null}
        {user && !personaIdClaim ? (
          <Card className="mb-4 border-slate-200/80 p-4 text-sm shadow-md">
            <p className="font-semibold text-slate-800">Sesión sin ficha vinculada</p>
            <p className="mt-1 text-slate-600">Usá vinculación por DNI (soporte) para enlazar tu legajo.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <PrimaryButton type="button" onClick={() => nav("/vinculacion", { replace: true })} className="w-full sm:flex-1">
                Vinculación por DNI
              </PrimaryButton>
              <Link
                to="/portal/home"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-1"
              >
                Ir al inicio
              </Link>
            </div>
          </Card>
        ) : null}

        {!user ? (
          <>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80">
            <img src={LOGO_SRC} alt="" className="h-12 w-auto max-w-[4.5rem] object-contain" loading="eager" decoding="async" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{INSTITUTION_NAME}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{APP_TITLE}</h1>
          <p className="mt-2 text-sm text-slate-600">Acceso al portal hospitalario</p>
        </div>

        <Card className="overflow-hidden border-slate-200/80 shadow-xl shadow-slate-300/40">
          <div className="flex border-b border-slate-100 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={setTabLogin}
              className={[
                "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors",
                tab === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              aria-selected={tab === "login"}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={setTabRegistro}
              className={[
                "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors",
                tab === "registro" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
              aria-selected={tab === "registro"}
            >
              Primer acceso
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {tab === "login" && !user ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">
                  Ingresá con el <strong className="text-slate-800">DNI</strong> y el <strong className="text-slate-800">PIN de 6 dígitos</strong> asignados a tu cuenta.
                </p>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  DNI
                  <input
                    name="dni"
                    className={INPUT}
                    inputMode="numeric"
                    autoComplete="username"
                    value={dniLogin}
                    onChange={(e) => setDniLogin(e.target.value.replace(/\D/g, ""))}
                    maxLength={12}
                    disabled={busyLogin}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  PIN
                  <input
                    name="pin"
                    type="password"
                    className={INPUT}
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pinLogin}
                    onChange={(e) => setPinLogin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    disabled={busyLogin}
                  />
                </label>
                {feedbackLogin && feedbackLogin.status !== "idle" ? (
                  <DataOperationFeedback status={feedbackLogin.status} message={feedbackLogin.message} />
                ) : null}
                <PrimaryButton type="submit" disabled={busyLogin} className="!mt-1 w-full">
                  {busyLogin ? "Ingresando…" : "Ingresar al portal"}
                </PrimaryButton>
                <p className="text-center text-xs text-slate-500">
                  ¿Sos agente nuevo? Tocá la pestaña{" "}
                  <button type="button" onClick={setTabRegistro} className="font-semibold text-blue-600 hover:underline">
                    Primer acceso
                  </button>
                  .
                </p>
              </form>
            ) : null}

            {tab === "registro" && !user ? (
              <form onSubmit={onCreateAccount} className="space-y-4 text-sm">
                <p className="text-sm text-slate-600">
                  Si RRHH ya cargó tu ficha, creá tu cuenta con el mismo <strong className="text-slate-800">DNI</strong>, un{" "}
                  <strong className="text-slate-800">correo</strong> y un <strong className="text-slate-800">PIN de 6 dígitos</strong>.
                </p>
                <label className="block font-medium text-slate-700">DNI</label>
                <input
                  className={INPUT}
                  inputMode="numeric"
                  maxLength={12}
                  value={dniReg}
                  onChange={(e) => setDniReg(e.target.value.replace(/\D/g, ""))}
                  disabled={busy}
                  required
                />
                <label className="block font-medium text-slate-700">Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  className={INPUT}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                  disabled={busy}
                />
                <label className="block font-medium text-slate-700">PIN (6 dígitos)</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showPin ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    className={INPUT}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    {showPin ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <PrimaryButton type="submit" disabled={busyReg} className="!mt-2 w-full">
                  {busyReg ? "Procesando…" : "Crear cuenta y continuar"}
                </PrimaryButton>
                <p className="text-center text-xs text-slate-500">
                  ¿Ya tenés cuenta?{" "}
                  <button type="button" onClick={setTabLogin} className="font-semibold text-blue-600 hover:underline">
                    Iniciar sesión
                  </button>
                </p>
              </form>
            ) : null}
          </div>
        </Card>
          </>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/vinculacion" className="font-medium text-blue-600 hover:underline">
            Vinculación por DNI (soporte)
          </Link>
          <span className="mx-2 text-slate-300" aria-hidden>
            ·
          </span>
          <Link to="/portal/home" className="font-medium text-slate-700 hover:underline">
            Ir al inicio del portal
          </Link>
        </p>
      </div>
    </div>
  );
}
