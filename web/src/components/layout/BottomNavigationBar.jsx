import { MODULOS_PORTAL } from "../../constants/modulosEstado.js";

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
};

const tabs = MODULOS_PORTAL.map((m) => ({
  id: m.id,
  label: m.label,
  icon: ICONS_BY_ID[m.id],
}));

/**
 * Misma navegación en móvil (barra inferior) y en md+ (sidebar fijo, sin duplicar lógica).
 * — Móvil: `flex` horizontal, anclada al borde inferior del contenedor.
 * — md+ — lg+: columna, ancho fijo, reemplaza el “menú inferior” por navegación lateral.
 */
export default function BottomNavigationBar({ activeTab, onTabChange, className = "" }) {
  return (
    <nav
      className={[
        "shrink-0 border-slate-100 bg-white shadow-sm",
        "w-full border-t",
        "md:order-1 md:flex md:h-full md:min-h-0 md:w-64 md:max-w-[16rem] md:flex-col md:justify-start md:border-t-0 md:border-r md:py-4 md:shadow-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navegación principal"
    >
      <p className="hidden border-b border-slate-100 px-4 pb-3 text-sm font-semibold text-slate-400 md:mb-2 md:block">
        Menú
      </p>
      <ul
        className={[
          "mx-auto flex max-w-md w-full",
          "flex-row",
          "md:mx-0 md:max-w-none md:h-auto md:min-h-0 md:w-full md:flex-1 md:flex-col md:items-stretch md:gap-0.5 md:px-2",
        ].join(" ")}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <li key={tab.id} className="min-w-0 flex-1 md:w-full md:flex-none">
              <button
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={[
                  "flex w-full min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 py-2",
                  "transition-transform active:scale-95",
                  "md:min-h-12 md:w-full md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:py-2.5",
                  "md:transition-transform md:duration-150",
                  active
                    ? "text-blue-600 md:bg-blue-50 md:text-blue-600"
                    : "text-slate-400 md:text-slate-500 md:hover:bg-slate-50",
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
                    "text-xs font-medium leading-tight",
                    "md:text-sm",
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
    </nav>
  );
}

export { tabs as BOTTOM_NAV_TABS };
