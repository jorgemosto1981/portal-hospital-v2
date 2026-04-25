import { useState } from "react";
import MobileLayout from "./components/layout/MobileLayout.jsx";
import LoginScreen from "./features/auth/LoginScreen.jsx";
import { useAuthSession } from "./features/auth/useAuthSession.js";
import TabContentHost from "./features/shell/TabContentHost.jsx";

export default function App() {
  const { user, authPending } = useAuthSession();
  const [activeTab, setActiveTab] = useState("inicio");

  if (authPending) {
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

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <TabContentHost activeTab={activeTab} />
    </MobileLayout>
  );
}
