import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import { normalizeDni, signUpEmailPassword, vincularCuentaPorDni } from "../../services/authService.js";
import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";

/**
 * Registro en Auth + vinculación a legajo `PENDIENTE_ONBOARDING` por DNI (MVP fase 1).
 */
export default function RegistroVinculacion() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreateAccount(e) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres (Firebase).");
      return;
    }
    setBusy(true);
    const t = toast.loading("Creando cuenta…");
    try {
      await signUpEmailPassword(email, password);
      setStep(2);
      toast.success("Ahora vinculá con el DNI que te cargó RRHH", { id: t });
    } catch (err) {
      const code = err && /** @type {{ code?: string }} */ (err).code;
      const m =
        code === "auth/email-already-in-use"
          ? 'Ese email ya fue usado. Iniciá sesión o usá "Olvidé la contraseña".'
          : (err && /** @type {{ message?: string }} */ (err).message) || "Error al registrarse";
      toast.error(m, { id: t });
    } finally {
      setBusy(false);
    }
  }

  async function onVincular(e) {
    e.preventDefault();
    const d = normalizeDni(dni);
    if (!/^\d{6,12}$/.test(d)) {
      toast.error("Ingresá un DNI con 6 a 12 dígitos.");
      return;
    }
    setBusy(true);
    const t = toast.loading("Vinculando con el hospital…");
    try {
      await vincularCuentaPorDni(d);
      toast.success("Listo — completá el onboarding", { id: t });
      nav("/onboarding", { replace: true });
    } catch (err) {
      const m = (err && /** @type {{ message?: string }} */ (err).message) || "No se pudo vincular. Consultá a RRHH.";
      toast.error(m, { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-100">
      <PublicAuthMenu />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <img
            src={LOGO_SRC}
            alt={INSTITUTION_NAME}
            className="mb-2 h-14 w-auto object-contain"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-lg font-semibold text-slate-900">Registro — {APP_TITLE}</h1>
        </div>

        {step === 1 ? (
          <Card className="p-5 sm:p-6">
            <form onSubmit={onCreateAccount} className="space-y-3 text-sm">
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
              <label className="block font-medium text-slate-700">PIN / contraseña (mín. 6)</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <PrimaryButton type="submit" disabled={busy} className="!mt-4 w-full">
                {busy ? "Creando…" : "Siguiente"}
              </PrimaryButton>
            </form>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="p-5 sm:p-6">
            <p className="mb-3 text-sm text-slate-600">Ingresá el DNI que te dio de alta RRHH para este hospital.</p>
            <form onSubmit={onVincular} className="space-y-3 text-sm">
              <label className="block font-medium text-slate-700">DNI (solo números)</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                inputMode="numeric"
                maxLength={12}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
                required
              />
              <PrimaryButton type="submit" disabled={busy} className="!mt-2 w-full">
                {busy ? "Vinculando…" : "Vincular mi ficha"}
              </PrimaryButton>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
