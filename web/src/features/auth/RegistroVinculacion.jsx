import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signInWithEmailAndPassword } from "firebase/auth";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import { normalizeDni, vincularCuentaPorDni } from "../../services/authService.js";
import { callRegistroPrimerAcceso } from "../../services/callables.js";
import { authV2 } from "../../services/firebase.js";
import { useAuthSession } from "./useAuthSession.js";
import { useAuthClaims } from "./useAuthClaims.js";
import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";

/**
 * Registro en Auth + vinculación a legajo `PENDIENTE_ONBOARDING` por DNI (MVP fase 1).
 */
export default function RegistroVinculacion() {
  const nav = useNavigate();
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const personaIdClaim = typeof claims?.persona_id === "string" ? claims.persona_id : "";

  async function onCreateAccount(e) {
    e.preventDefault();
    const d = normalizeDni(dni);
    if (!/^\d{6,12}$/.test(d)) {
      toast.error("Ingresá un DNI con 6 a 12 dígitos.");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres (Firebase).");
      return;
    }
    setBusy(true);
    const t = toast.loading("Registrando y vinculando cuenta…");
    try {
      if (authV2.currentUser) {
        await vincularCuentaPorDni(d);
        toast.success("Cuenta ya autenticada: vínculo completado. Continuá con el onboarding.", { id: t });
        nav("/onboarding", { replace: true });
        return;
      }
      const emailNorm = String(email || "").trim().toLowerCase();
      await callRegistroPrimerAcceso({ dni: d, email: emailNorm, pin: password });
      await signInWithEmailAndPassword(authV2, emailNorm, password);
      if (authV2.currentUser) await authV2.currentUser.getIdToken(true);
      toast.success("Registro completado. Continuá con el onboarding.", { id: t });
      nav("/onboarding", { replace: true });
    } catch (err) {
      const mRaw = (err && /** @type {{ message?: string, code?: string }} */ (err).message) || "";
      const code = (err && /** @type {{ code?: string }} */ (err).code) || "";
      const m =
        code === "auth/email-already-in-use"
          ? "Ese correo ya tiene cuenta. Iniciá sesión y usá Vinculación por DNI (soporte)."
          : mRaw || "Error al registrarse";
      toast.error(m, { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-100">
      <PublicAuthMenu />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-8">
        {user && personaIdClaim ? (
          <Card className="mb-4 p-4 text-sm">
            <p className="font-semibold text-slate-800">Tu cuenta ya está vinculada.</p>
            <p className="mt-1 text-slate-600">
              Este registro es solo para alta inicial. Continuá con el flujo principal.
            </p>
            <div className="mt-3">
              <PrimaryButton type="button" onClick={() => nav("/inicio", { replace: true })} className="w-full">
                Ir al inicio
              </PrimaryButton>
            </div>
          </Card>
        ) : null}
        {user && !personaIdClaim ? (
          <Card className="mb-4 p-4 text-sm">
            <p className="font-semibold text-slate-800">Sesión iniciada sin ficha vinculada.</p>
            <p className="mt-1 text-slate-600">
              Usá la pantalla de Vinculación por DNI (soporte) para completar el enlace de cuenta.
            </p>
            <div className="mt-3">
              <PrimaryButton type="button" onClick={() => nav("/vinculacion", { replace: true })} className="w-full">
                Ir a vinculación por DNI
              </PrimaryButton>
            </div>
          </Card>
        ) : null}
        {!user ? (
        <>
        <div className="mb-5 flex flex-col items-center text-center">
          <img
            src={LOGO_SRC}
            alt={INSTITUTION_NAME}
            className="mb-2 h-14 w-auto object-contain"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-lg font-semibold text-slate-900">Registro — {APP_TITLE}</h1>
          <div className="mt-2 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600">
            <p><strong>Objetivo:</strong> crear y vincular cuenta inicial.</p>
            <p><strong>Resultado:</strong> cuenta asociada a tu persona_id.</p>
            <p><strong>Cuándo usar:</strong> primer ingreso de agente nuevo.</p>
            <p><strong>Ruta principal:</strong> este es el camino oficial de alta inicial.</p>
          </div>
        </div>

          <Card className="p-5 sm:p-6">
            <p className="mb-2 text-sm text-slate-700">
              <strong>Paso 1 · Crear cuenta de acceso</strong>
            </p>
            <p className="mb-3 text-sm text-slate-600">
              Registrá tus credenciales iniciales para ingresar al portal.
            </p>
            <form onSubmit={onCreateAccount} className="space-y-3 text-sm">
              <label className="block font-medium text-slate-700">Ingresá tu DNI</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                inputMode="numeric"
                maxLength={12}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
                required
              />
              <p className="-mt-2 text-xs text-slate-500">
                Debe coincidir con la ficha cargada por RRHH.
              </p>
              <label className="block font-medium text-slate-700">Correo</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                disabled={busy}
              />
              <p className="-mt-2 text-xs text-slate-500">
                Usá un correo de uso habitual y al que tengas acceso directo.
              </p>
              <label className="block font-medium text-slate-700">PIN / contraseña (mín. 6)</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
              <p className="-mt-2 text-xs text-slate-500">
                El usuario de ingreso es tu DNI; este PIN/contraseña es la clave de acceso.
              </p>
              <PrimaryButton type="submit" disabled={busy} className="!mt-4 w-full">
                {busy ? "Procesando…" : "Crear y vincular cuenta"}
              </PrimaryButton>
            </form>
          </Card>
        </>
        ) : null}
      </div>
    </div>
  );
}
