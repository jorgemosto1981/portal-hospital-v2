import { useAuthSession } from "./useAuthSession.js";
import AccesoPortal from "./AccesoPortal.jsx";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

/**
 * Ruta `/login`: acceso unificado (sesión + primer registro).
 * No redirigir automáticamente por tener sesión: evita carrera con `syncSessionClaims` en el login;
 * la navegación post-ingreso la dispara `AccesoPortal` tras sync OK (o el usuario usa “Ir al inicio”).
 */
export default function LoginRoute() {
  const { authPending } = useAuthSession();

  if (!BYPASS_AUTH && authPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <span
            className="inline-block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm">Cargando…</p>
        </div>
      </div>
    );
  }

  return <AccesoPortal />;
}
