import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import { callResolverEmailLoginDni } from "../../services/callables.js";
import { authV2 } from "../../services/firebase.js";
import Card from "../../components/ui/Card.jsx";
import DataOperationFeedback from "../../components/ui/DataOperationFeedback.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";

function normalizeDni(s) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * Inicio de sesión: DNI + PIN (6 dígitos) — MODULO_LOGIN_V2 §1.1.
 */
export default function LoginScreen() {
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(/** @type {null | { status: string, message: string }} */ (null));

  async function handleSubmit(e) {
    e.preventDefault();
    const d = normalizeDni(dni);
    const p = String(pin).trim();
    if (!/^\d{6,12}$/.test(d)) {
      setFeedback({ status: "error", message: "Ingresá un DNI válido (6 a 12 dígitos)." });
      return;
    }
    if (!/^\d{6}$/.test(p)) {
      setFeedback({ status: "error", message: "El PIN debe ser exactamente 6 dígitos." });
      return;
    }
    setBusy(true);
    setFeedback({ status: "loading", message: "Verificando credenciales…" });
    const t = toast.loading("Iniciando sesión…");
    try {
      const res = await callResolverEmailLoginDni({ dni: d });
      const email = res?.data?.email;
      if (typeof email !== "string" || !email) {
        throw new Error("Respuesta inválida del servidor");
      }
      await signInWithEmailAndPassword(authV2, email, p);
      setFeedback({ status: "success", message: "Sesión iniciada correctamente" });
      toast.success("Bienvenido", { id: t });
    } catch (err) {
      const code = err?.code;
      const isAuth = code && String(code).startsWith("auth/");
      const msg = isAuth
        ? "DNI o PIN incorrectos, o la cuenta no está habilitada."
        : (err?.message && String(err.message)) || "No se pudo iniciar sesión. Intentá de nuevo.";
      setFeedback({ status: "error", message: msg });
      toast.error("No se pudo iniciar sesión", { id: t });
      try {
        if (authV2.currentUser) {
          await signOut(authV2);
        }
      } catch {
        // ignore
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={LOGO_SRC}
            alt={INSTITUTION_NAME}
            className="mb-3 h-16 w-auto max-w-[12rem] object-contain"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-lg font-semibold text-slate-900">{APP_TITLE}</h1>
          <p className="mt-1 text-sm text-slate-500">Iniciá sesión con DNI y PIN</p>
        </div>
        <Card className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
              DNI
              <input
                name="dni"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                inputMode="numeric"
                autoComplete="username"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                maxLength={12}
                disabled={busy}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
              PIN (6 dígitos)
              <input
                name="pin"
                type="password"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                disabled={busy}
              />
            </label>
            {feedback && feedback.status !== "idle" ? (
              <DataOperationFeedback status={feedback.status} message={feedback.message} />
            ) : null}
            <PrimaryButton type="submit" disabled={busy} className="!mt-1">
              {busy ? "Ingresando…" : "Ingresar"}
            </PrimaryButton>
          </form>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-500">
          ¿Primer acceso? Completá el registro con DNI, correo y PIN que te indicó RRHH (flujo
          &quot;primer acceso&quot; en desarrollo), o contactá a RRHH.
        </p>
      </div>
    </div>
  );
}
