import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MobileLayout from "./components/layout/MobileLayout.jsx";
import LoginScreen from "./features/auth/LoginScreen.jsx";
import LoginRoute from "./features/auth/LoginRoute.jsx";
import RegistroVinculacion from "./features/auth/RegistroVinculacion.jsx";
import VinculacionDni from "./features/auth/VinculacionDni.jsx";
import { useAuthSession } from "./features/auth/useAuthSession.js";
import OnboardingWizard from "./features/onboarding/OnboardingWizard.jsx";
import AltaAgenteRRHH from "./features/rrhh/AltaAgenteRRHH.jsx";
import MvpAccessGate from "./features/shell/MvpAccessGate.jsx";
import TabContentHost from "./features/shell/TabContentHost.jsx";

/** Solo desarrollo: en `.env.v2.local` → `VITE_BYPASS_AUTH=true` (nunca en producción). */
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

/**
 * Contenido principal: login o shell.
 */
function MainWithAuth() {
  const { user, authPending } = useAuthSession();
  const [activeTab, setActiveTab] = useState("inicio");

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

  if (!BYPASS_AUTH && !user) {
    return <LoginScreen />;
  }

  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab} devBypassAuth={BYPASS_AUTH && !user}>
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
        <Route path="/rrhh/alta" element={<AltaAgenteRRHH />} />
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
