import { useCallback, useEffect, useMemo, useState } from "react";

import { GRUPOS_MENU_RAIZ, MODULOS_PORTAL } from "../../constants/modulosEstado.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { MANAGEMENT_PORTAL_ROLES } from "../../features/routing/portalRole.js";
import {
  filtrarModulosPorArticulosIngreso,
  useArticulosIngresoMenu,
} from "../../features/solicitudes/ArticulosIngresoProvider.jsx";
import { grupoAccesiblePorClaims } from "./menuGrupoAcceso.js";

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
  "solicitud-lao": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25m-18 0v7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "solicitud-64a": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "bandeja-solicitudes-jefe": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "bandeja-solicitudes-rrhh": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "bandeja-turnos-raiz-rrhh": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h10.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "bandeja-turnos-evaluador-rrhh": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25m-18 0v7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "bandeja-turnos-explorador-rrhh": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h9m6.75 0h.008v.008H19.5V13.5Zm0 4.5h.008v.008H19.5V18Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  ticketera: () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "articulos-cfg": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  ),
  "checkin-saldos": () => (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
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
  parentMenuId: m.parentMenuId || null,
  articuloIngresoId: m.articuloIngresoId,
  icon: ICONS_BY_ID[m.id],
}));

function ChevronIcon({ open }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Navegación compacta móvil (acordeón por rol) + sidebar en md+. */
export default function BottomNavigationBar({ activeTab, onTabChange, className = "" }) {
  const { user } = useAuthSession();
  const { hasPortalRoles, claims } = useAuthClaims(user);
  const { puedeSolicitarArticulo } = useArticulosIngresoMenu();
  const canManagement = hasPortalRoles(MANAGEMENT_PORTAL_ROLES);
  const requiresManagementTab = (id) => id === "rrhh" || id === "articulos-cfg" || id === "checkin-saldos";

  const visibleTabs = useMemo(() => {
    const modulosVisibles = filtrarModulosPorArticulosIngreso(MODULOS_PORTAL, puedeSolicitarArticulo);
    const visibleIds = new Set(modulosVisibles.map((m) => m.id));
    return tabs.filter((tab) => {
      if (!visibleIds.has(tab.id)) return false;
      return requiresManagementTab(tab.id) ? canManagement : true;
    });
  }, [puedeSolicitarArticulo, canManagement]);

  const bloquesConItems = useMemo(
    () =>
      GRUPOS_MENU_RAIZ.map((bloque) => ({
        bloque,
        items: visibleTabs.filter((t) => t.grupo === bloque.id),
      })).filter(
        ({ bloque, items }) =>
          items.length > 0 && grupoAccesiblePorClaims(bloque.id, claims, hasPortalRoles),
      ),
    [visibleTabs, claims, hasPortalRoles],
  );

  const grupoActivo = visibleTabs.find((t) => t.id === activeTab)?.grupo ?? bloquesConItems[0]?.bloque.id ?? null;

  const isTabActive = useCallback((tab, allTabs, currentActiveTab) => {
    if (currentActiveTab === tab.id) return true;
    const children = allTabs.filter((t) => t.parentMenuId === tab.id);
    return children.some((child) => child.id === currentActiveTab);
  }, []);

  const [expandedMobile, setExpandedMobile] = useState(() => grupoActivo);

  useEffect(() => {
    if (grupoActivo) setExpandedMobile(grupoActivo);
  }, [grupoActivo]);

  const toggleGrupo = useCallback((id) => {
    setExpandedMobile((prev) => (prev === id ? null : id));
  }, []);

  return (
    <nav
      className={[
        "print:hidden",
        "shrink-0 border-slate-100 bg-white shadow-sm",
        "w-full min-w-0 max-w-full border-t",
        "max-h-[min(40vh,15rem)] overflow-x-hidden overflow-y-auto md:max-h-none md:overflow-visible",
        "md:order-1 md:flex md:h-full md:min-h-0 md:w-72 md:max-w-[18rem] md:flex-col md:justify-start md:border-t-0 md:border-r md:py-3 md:shadow-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navegación principal por rol"
    >
      <div className="hidden border-b border-slate-100 px-3 pb-2 md:block">
        <p className="text-sm font-semibold text-slate-700">Menú raíz</p>
        <p className="mt-0.5 text-xs text-slate-500">Agrupado por paquete de rol.</p>
      </div>

      <div className="flex flex-col gap-1 px-1 py-1 md:min-h-0 md:flex-1 md:gap-2 md:overflow-y-auto md:px-3">
        <div className="flex flex-row gap-1 md:hidden" role="presentation">
          {bloquesConItems.map(({ bloque, items }) => {
            const openMobile = expandedMobile === bloque.id;
            return (
              <div
                key={`${bloque.id}-cabecera`}
                className="min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70"
              >
                <button
                  type="button"
                  id={`menu-grupo-${bloque.id}`}
                  className="flex min-h-11 w-full items-center justify-between gap-1 px-2 py-2 text-left text-sm font-medium text-slate-700 touch-manipulation"
                  aria-expanded={openMobile}
                  aria-controls={`menu-panel-${bloque.id}`}
                  onClick={() => toggleGrupo(bloque.id)}
                >
                  <span className="truncate">{bloque.titulo}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <span className="text-[10px] font-normal text-slate-400">{items.length}</span>
                    <ChevronIcon open={openMobile} />
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {bloquesConItems.map(({ bloque, items }) => {
          const openMobile = expandedMobile === bloque.id;
          return (
            <section
              key={bloque.id}
              className={[
                "overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 md:border-0 md:bg-transparent",
                openMobile ? "" : "hidden md:block",
              ].join(" ")}
            >
              <button
                type="button"
                id={`menu-grupo-${bloque.id}-md`}
                className="hidden w-full items-center justify-between gap-2 px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 touch-manipulation md:flex md:cursor-default"
                aria-expanded={openMobile}
                aria-controls={`menu-panel-${bloque.id}`}
                onClick={() => toggleGrupo(bloque.id)}
              >
                <span className="truncate">{bloque.titulo}</span>
              </button>
              <p className="hidden px-1 text-[11px] leading-snug text-slate-500 md:mb-1 md:block">{bloque.descripcion}</p>
              <ul
                id={`menu-panel-${bloque.id}`}
                className={[
                  "grid grid-cols-4 gap-1 px-1.5 pb-1.5 md:grid md:grid-cols-1 md:gap-0.5 md:px-0 md:pb-0",
                  openMobile ? "grid" : "hidden md:grid",
                ].join(" ")}
                aria-labelledby={`menu-grupo-${bloque.id}`}
              >
                {items.map((tab) => {
                  const active = isTabActive(tab, items, activeTab);
                  const esHijo = Boolean(tab.parentMenuId);
                  return (
                    <li key={tab.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onTabChange?.(tab.id)}
                        className={[
                          "flex w-full min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md py-1 touch-manipulation",
                          "transition-transform active:scale-95",
                          "md:min-h-10 md:flex-row md:justify-start md:gap-2.5 md:rounded-lg md:px-2.5 md:py-2",
                          esHijo ? "md:ml-5 md:w-[calc(100%-1.25rem)]" : "",
                          active
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 md:bg-blue-50 md:shadow-none md:ring-0"
                            : "text-slate-500 md:hover:bg-slate-100",
                        ].join(" ")}
                        aria-current={active ? "page" : undefined}
                      >
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                          {typeof tab.icon === "function" ? tab.icon() : null}
                        </svg>
                        <span
                          className={[
                            "max-w-full truncate text-center text-[10px] font-medium leading-none",
                            "md:text-left md:text-sm",
                            active ? "text-blue-600 md:font-semibold" : "",
                          ].join(" ")}
                        >
                          {esHijo ? `↳ ${tab.label}` : tab.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </nav>
  );
}

export { tabs as BOTTOM_NAV_TABS };
