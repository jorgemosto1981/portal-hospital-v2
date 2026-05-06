import { GRUPOS_MENU_RAIZ, MODULOS_PORTAL } from "../../constants/modulosEstado.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { MANAGEMENT_PORTAL_ROLES } from "../../features/routing/portalRole.js";

const ICONS_BY_ID = {
  inicio: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  configuracion: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  laboral: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 6.75h12M8.25 12h12m-12 4.5h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 4.5h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  antiguedad: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 12h16.5M12 3.75v16.5m7.5-12-3 3m3-3-3-3m-9 15 3-3m-3 3 3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  /** Vista tabular / read-model (distinta de carga en Laboral). */
  grilla: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.5h7.5v7.5h-7.5V4.5Zm12.75 0h7.5v7.5h-7.5V4.5Zm-12.75 12h7.5v7.5h-7.5v-7.5Zm12.75 0h7.5v7.5h-7.5v-7.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  rrhh: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 7.5h-3.75m0 0A1.125 1.125 0 1 0 12 7.5m2.25 0A1.125 1.125 0 1 1 12 7.5m0 0H6m12 9h-3.75m0 0A1.125 1.125 0 1 0 12 16.5m2.25 0A1.125 1.125 0 1 1 12 16.5m0 0H6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  perfil: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "perfil-rrhh": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  modulos: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.5h16.5m-16.5 7.5h16.5m-16.5 7.5h10.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  pantallas: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 5.25h15a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.25V6.75a1.5 1.5 0 0 1 1.5-1.5ZM7.5 21h9"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "sistemas-web": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 5.25h16.5A1.5 1.5 0 0 1 21.75 6.75v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75a1.5 1.5 0 0 1 1.5-1.5Zm0 10.5h18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
};

const tabs = MODULOS_PORTAL.map((m) => ({
  id: m.id,
  label: m.label,
  grupo: m.grupo,
  icon: ICONS_BY_ID[m.id],
}));

/**
 * Navegación agrupada por paquete de rol ({@link GRUPOS_MENU_RAIZ}) para ver el encadenamiento de cada ítem.
 * — Móvil: bloques apilados (scroll si hace falta); md+: sidebar con descripción por grupo.
 */
export default function BottomNavigationBar({ activeTab, onTabChange, className = "" }) {
  const { user } = useAuthSession();
  const { hasPortalRoles } = useAuthClaims(user);
  const canManagement = hasPortalRoles(MANAGEMENT_PORTAL_ROLES);
  const visibleTabs = tabs.filter((tab) => (tab.id === "rrhh" ? canManagement : true));

  return (
    <nav
      className={[
        "shrink-0 border-slate-100 bg-white shadow-sm",
        "w-full border-t",
        "max-h-[min(52vh,28rem)] overflow-y-auto md:max-h-none md:overflow-visible",
        "md:order-1 md:flex md:h-full md:min-h-0 md:w-72 md:max-w-[18rem] md:flex-col md:justify-start md:border-t-0 md:border-r md:py-4 md:shadow-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navegación principal por rol"
    >
      <div className="hidden border-b border-slate-100 px-4 pb-3 md:block">
        <p className="text-sm font-semibold text-slate-700">Menú raíz</p>
        <p className="mt-0.5 text-xs text-slate-500">Agrupado por paquete de rol (referencia de producto).</p>
      </div>

      <div
        className={[
          "flex flex-col gap-3 px-2 py-2",
          "md:min-h-0 md:flex-1 md:gap-4 md:overflow-y-auto md:px-3 md:py-2",
        ].join(" ")}
      >
        {GRUPOS_MENU_RAIZ.map((bloque) => {
          const items = visibleTabs.filter((t) => t.grupo === bloque.id);
          return (
            <section
              key={bloque.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0"
              aria-labelledby={`menu-grupo-${bloque.id}`}
            >
              <h2
                id={`menu-grupo-${bloque.id}`}
                className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs"
              >
                {bloque.titulo}
              </h2>
              <p className="mt-0.5 hidden px-1 text-[11px] leading-snug text-slate-500 md:block">{bloque.descripcion}</p>
              {items.length === 0 ? (
                <p className="mt-1 px-1 text-[11px] italic text-slate-400 md:text-xs">Sin entradas en menú por ahora.</p>
              ) : (
                <ul
                  className={[
                    "mt-1.5 flex flex-row flex-wrap justify-center gap-1",
                    "md:mt-2 md:flex-col md:items-stretch md:justify-start md:gap-0.5",
                  ].join(" ")}
                >
                  {items.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <li key={tab.id} className="min-w-[4.25rem] flex-1 md:min-w-0 md:w-full md:flex-none">
                        <button
                          type="button"
                          onClick={() => onTabChange?.(tab.id)}
                          className={[
                            "flex w-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5",
                            "transition-transform active:scale-95",
                            "md:min-h-12 md:w-full md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:py-2.5",
                            "md:transition-transform md:duration-150",
                            active
                              ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 md:bg-blue-50 md:shadow-none md:ring-0"
                              : "text-slate-400 md:text-slate-500 md:hover:bg-slate-100",
                          ].join(" ")}
                          aria-current={active ? "page" : undefined}
                        >
                          <svg
                            className="h-6 w-6 shrink-0"
                            viewBox="0 0 24 24"
                            width={24}
                            height={24}
                            fill="none"
                            aria-hidden
                          >
                            {tab.icon()}
                          </svg>
                          <span
                            className={[
                              "max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight",
                              "md:max-w-none md:text-left md:text-sm",
                              active ? "text-blue-600 md:font-semibold" : "text-slate-500",
                            ].join(" ")}
                          >
                            {tab.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </nav>
  );
}

export { tabs as BOTTOM_NAV_TABS };
