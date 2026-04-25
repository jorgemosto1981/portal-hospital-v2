import { NavLink, Outlet } from "react-router-dom";

const navBase =
  "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-500 transition-colors md:flex-row md:gap-3 md:px-3 md:py-2.5 md:text-sm";

function navClass({ isActive }) {
  return `${navBase} ${isActive ? "text-blue-600" : "hover:text-slate-700"}`;
}

function IconHome({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGrid({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUser({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconSettings({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .26.1.51.28.7.18.18.44.3.7.3H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Fase A — esqueleto responsivo: BottomNav fijo (viewport menor a 768px) y Sidebar (~250px) en desktop.
 * Estilo tipo Mercado Pago: neutros + acento blue-600.
 */
export default function MainLayout() {
  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-900">
      {/* Sidebar escritorio */}
      <aside
        className="hidden w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm md:flex"
        aria-label="Navegación principal"
      >
        <div className="border-b border-slate-100 px-4 py-5">
          <p className="text-xs font-semibold tracking-tight text-slate-900">SIGAL V2</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Portal hospitalario</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <NavLink to="/" end className={navClass}>
            <IconHome className="shrink-0 md:size-5" />
            <span>Inicio</span>
          </NavLink>
          <NavLink to="/grilla" className={navClass}>
            <IconGrid className="shrink-0 md:size-5" />
            <span>Grilla</span>
          </NavLink>
          <NavLink to="/configuracion" className={navClass}>
            <IconSettings className="shrink-0 md:size-5" />
            <span>Configuración</span>
          </NavLink>
          <NavLink to="/perfil" className={navClass}>
            <IconUser className="shrink-0 md:size-5" />
            <span>Mi perfil</span>
          </NavLink>
        </nav>
      </aside>

      {/* Área principal + bottom nav móvil */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          id="app-main-scroll"
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[4.75rem] md:pb-0"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm md:hidden"
          aria-label="Navegación inferior"
        >
          <div
            className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 pt-2"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            <NavLink to="/" end className={navClass}>
              <IconHome className="shrink-0" />
              <span>Inicio</span>
            </NavLink>
            <NavLink to="/grilla" className={navClass}>
              <IconGrid className="shrink-0" />
              <span>Grilla</span>
            </NavLink>
            <NavLink to="/configuracion" className={navClass}>
              <IconSettings className="shrink-0" />
              <span className="max-w-[3.25rem] leading-tight">Ajustes</span>
            </NavLink>
            <NavLink to="/perfil" className={navClass}>
              <IconUser className="shrink-0" />
              <span>Perfil</span>
            </NavLink>
          </div>
        </nav>
      </div>
    </div>
  );
}
