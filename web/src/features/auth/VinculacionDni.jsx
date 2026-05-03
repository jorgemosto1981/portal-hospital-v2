import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import { useAuthClaims } from "./useAuthClaims.js";
import { useAuthSession } from "./useAuthSession.js";
import { normalizeDni, vincularCuentaPorDni } from "../../services/authService.js";
import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";

/**
 * DNI luego de crear cuenta en Auth (o si cerraste el registro a mitad de camino).
 */
export default function VinculacionDni() {
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);

  /** Si el token ya recibió `persona_id` (p. ej. tras sync en otro paso), salir de esta pantalla. */
  useEffect(() => {
    const pid = typeof claims?.persona_id === "string" ? claims.persona_id.trim() : "";
    if (user && pid.startsWith("per_")) {
      nav("/portal/home", { replace: true });
    }
  }, [user, claims, nav]);

  async function onVincular(e) {
    e.preventDefault();
    setBusy(true);
    const t = toast.loading("Vinculando…");
    try {
      await vincularCuentaPorDni(dni);
      toast.success("Bien, seguí con el onboarding", { id: t });
      nav("/onboarding", { replace: true });
    } catch (err) {
      const m = (err && /** @type {{ message?: string }} */ (err).message) || "No se pudo vincular";
      toast.error(m, { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-100">
      <PublicAuthMenu />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-8">
        <h1 className="mb-2 text-center text-lg font-semibold">Vincular con tu legajo</h1>
        <p className="mb-2 text-center text-sm text-slate-500">Ingresá el DNI que te dio de alta RRHH</p>
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600">
          <p><strong>Objetivo:</strong> vincular tu sesión actual a la ficha RRHH.</p>
          <p><strong>Resultado:</strong> se asigna persona_id a tu cuenta.</p>
          <p><strong>Cuándo usar:</strong> solo en recuperación excepcional.</p>
          <p><strong>Flujo principal:</strong> para altas nuevas usá <span className="font-semibold">Inicio → Primer acceso</span> en la pantalla de acceso (<span className="font-mono">/login?alta=1</span>).</p>
        </div>
        <Card className="p-5 sm:p-6">
          <form onSubmit={onVincular} className="space-y-3 text-sm">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              inputMode="numeric"
              maxLength={12}
              value={dni}
              onChange={(e) => setDni(normalizeDni(e.target.value))}
              placeholder="DNI"
              disabled={busy}
            />
            <PrimaryButton type="submit" disabled={busy} className="w-full">
              {busy ? "Vinculando…" : "Vincular"}
            </PrimaryButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
