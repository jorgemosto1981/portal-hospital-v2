export const ESTADOS_MODULO = {
  ACTIVO: "activo",
  MVP: "mvp",
  BORRADOR: "borrador",
  LEGACY: "legacy",
};

export const MODULOS_PORTAL = [
  { id: "inicio", label: "Inicio", path: "/portal/home", estado: ESTADOS_MODULO.ACTIVO },
  { id: "laboral", label: "Laboral", path: "/portal/laboral", estado: ESTADOS_MODULO.MVP },
  { id: "rrhh", label: "RRHH", path: "/portal/rrhh/alta", estado: ESTADOS_MODULO.ACTIVO },
  { id: "configuracion", label: "Config", path: "/portal/configuracion", estado: ESTADOS_MODULO.ACTIVO },
  { id: "perfil", label: "Perfil", path: "/portal/perfil", estado: ESTADOS_MODULO.MVP },
  { id: "pantallas", label: "Pantallas", path: "/portal/pantallas", estado: ESTADOS_MODULO.ACTIVO },
  { id: "modulos", label: "Módulos", path: "/portal/modulos", estado: ESTADOS_MODULO.ACTIVO },
];

export const MODULOS_V2_ESTADO = [
  { modulo: "Inicio / Home", estado: ESTADOS_MODULO.ACTIVO, detalle: "Portal principal y paneles dev." },
  { modulo: "Datos laborales", estado: ESTADOS_MODULO.MVP, detalle: "Vista conectada a colecciones V2." },
  { modulo: "Configuración", estado: ESTADOS_MODULO.ACTIVO, detalle: "Catálogos RRHH vía callables." },
  { modulo: "Perfil", estado: ESTADOS_MODULO.MVP, detalle: "Legajo por persona_id y cargos activos." },
  { modulo: "Grilla operativa", estado: ESTADOS_MODULO.BORRADOR, detalle: "Pendiente de integración con datos en vivo." },
  { modulo: "Rutas portal", estado: ESTADOS_MODULO.ACTIVO, detalle: "Prefijo /portal/* con guards de rol en RRHH." },
];

/**
 * @param {string} pathname
 */
export function resolverTabPorPath(pathname) {
  if (pathname.startsWith("/portal/rrhh") || pathname.startsWith("/rrhh")) return "rrhh";
  if (pathname.startsWith("/portal/configuracion") || pathname.startsWith("/configuracion")) return "configuracion";
  if (pathname.startsWith("/portal/laboral") || pathname.startsWith("/laboral")) return "laboral";
  if (pathname.startsWith("/portal/perfil") || pathname.startsWith("/perfil")) return "perfil";
  if (pathname.startsWith("/portal/pantallas") || pathname.startsWith("/pantallas")) return "pantallas";
  if (pathname.startsWith("/portal/modulos") || pathname.startsWith("/modulos")) return "modulos";
  if (
    pathname.startsWith("/portal/home") ||
    pathname === "/portal" ||
    pathname.startsWith("/inicio") ||
    pathname === "/"
  ) {
    return "inicio";
  }
  return "inicio";
}
