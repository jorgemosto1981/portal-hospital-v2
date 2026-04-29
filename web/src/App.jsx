import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import MobileLayout from "./components/layout/MobileLayout.jsx";
import LoginScreen from "./features/auth/LoginScreen.jsx";
import LoginRoute from "./features/auth/LoginRoute.jsx";
import RegistroVinculacion from "./features/auth/RegistroVinculacion.jsx";
import VinculacionDni from "./features/auth/VinculacionDni.jsx";
import { useAuthSession } from "./features/auth/useAuthSession.js";
import OnboardingWizard from "./features/onboarding/OnboardingWizard.jsx";
import MvpAccessGate from "./features/shell/MvpAccessGate.jsx";
import TabContentHost from "./features/shell/TabContentHost.jsx";
import DatosLaborales from "./pages/DatosLaborales.jsx";
import DatosPersonales from "./pages/DatosPersonales.jsx";
import EstadoModulos from "./pages/EstadoModulos.jsx";
import GrillaOperativa from "./pages/GrillaOperativa.jsx";
import PantallasCatalogo from "./pages/PantallasCatalogo.jsx";
import Perfil from "./pages/Perfil.jsx";
import { MODULOS_PORTAL, resolverTabPorPath } from "./constants/modulosEstado.js";
import runtimeFlags from "../../shared/runtimeFlags.json";

/** Solo desarrollo: en `.env.v2.local` → `VITE_BYPASS_AUTH=true` (nunca en producción). */
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
/** Temporal: acceso libre global (web + functions) desde un único flag. */
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

/**
 * Contenido principal: login o shell.
 */
function MainWithAuth() {
  const { user, authPending } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = resolverTabPorPath(location.pathname);

  if (!OPEN_ACCESS_TEMP && !BYPASS_AUTH && authPending) {
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

  if (!OPEN_ACCESS_TEMP && !BYPASS_AUTH && !user) {
    return <LoginScreen />;
  }

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={(nextTab) => {
        const m = MODULOS_PORTAL.find((x) => x.id === nextTab);
        if (m) navigate(m.path);
      }}
      devBypassAuth={BYPASS_AUTH && !user}
    >
      <TabContentHost activeTab={activeTab} />
    </MobileLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <MvpAccessGate>
              <LoginRoute />
            </MvpAccessGate>
          }
        />
        <Route path="/registro" element={<RegistroVinculacion />} />
        <Route path="/vinculacion" element={<VinculacionDni />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route
          path="/grilla"
          element={
            <MvpAccessGate>
              <GrillaOperativa />
            </MvpAccessGate>
          }
        />
        <Route
          path="/perfil"
          element={
            <MvpAccessGate>
              <DatosPersonales />
            </MvpAccessGate>
          }
        />
        <Route
          path="/perfil/:personaId"
          element={
            <MvpAccessGate>
              <Perfil />
            </MvpAccessGate>
          }
        />
        <Route
          path="/laboral"
          element={
            <MvpAccessGate>
              <DatosLaborales />
            </MvpAccessGate>
          }
        />
        <Route
          path="/modulos"
          element={
            <MvpAccessGate>
              <EstadoModulos />
            </MvpAccessGate>
          }
        />
        <Route
          path="/pantallas"
          element={
            <MvpAccessGate>
              <PantallasCatalogo />
            </MvpAccessGate>
          }
        />
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route
          path="/*"
          element={
            <MvpAccessGate>
              <MainWithAuth />
            </MvpAccessGate>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
