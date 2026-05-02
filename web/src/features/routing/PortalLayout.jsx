import { Outlet, useLocation, useNavigate } from "react-router-dom";

import MobileLayout from "../../components/layout/MobileLayout.jsx";
import { MODULOS_PORTAL, resolverTabPorPath } from "../../constants/modulosEstado.js";
import { useAuthSession } from "../auth/useAuthSession.js";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

/**
 * Shell del portal autenticado: navegación por tabs + área con <Outlet />.
 */
export default function PortalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const activeTab = resolverTabPorPath(location.pathname);

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={(nextTab) => {
        const m = MODULOS_PORTAL.find((x) => x.id === nextTab);
        if (m) navigate(m.path);
      }}
      devBypassAuth={BYPASS_AUTH && !user}
    >
      <Outlet />
    </MobileLayout>
  );
}
