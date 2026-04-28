export const ESTADOS_MODULO = {
  ACTIVO: "activo",
  MVP: "mvp",
  BORRADOR: "borrador",
  LEGACY: "legacy",
};

export const MODULOS_PORTAL = [
  { id: "inicio", label: "Inicio", path: "/inicio", estado: ESTADOS_MODULO.ACTIVO },
  { id: "laboral", label: "Laboral", path: "/laboral", estado: ESTADOS_MODULO.MVP },
  { id: "configuracion", label: "Config", path: "/configuracion", estado: ESTADOS_MODULO.ACTIVO },
  { id: "perfil", label: "Perfil", path: "/perfil", estado: ESTADOS_MODULO.MVP },
  { id: "pantallas", label: "Pantallas", path: "/pantallas", estado: ESTADOS_MODULO.ACTIVO },
  { id: "modulos", label: "Módulos", path: "/modulos", estado: ESTADOS_MODULO.ACTIVO },
];

export const MODULOS_V2_ESTADO = [
  { modulo: "Inicio / Home", estado: ESTADOS_MODULO.ACTIVO, detalle: "Portal principal y paneles dev." },
  { modulo: "Datos laborales", estado: ESTADOS_MODULO.MVP, detalle: "Vista conectada a colecciones V2." },
  { modulo: "Configuración", estado: ESTADOS_MODULO.ACTIVO, detalle: "Catálogos RRHH vía callables." },
  { modulo: "Perfil", estado: ESTADOS_MODULO.MVP, detalle: "Legajo por persona_id y cargos activos." },
  { modulo: "Grilla operativa", estado: ESTADOS_MODULO.BORRADOR, detalle: "Pantalla dummy, pendiente integración." },
  { modulo: "Perfil entrada legacy", estado: ESTADOS_MODULO.LEGACY, detalle: "Ruta utilitaria para demo/manual." },
];

export function resolverTabPorPath(pathname) {
  if (pathname.startsWith("/configuracion")) return "configuracion";
  if (pathname.startsWith("/laboral")) return "laboral";
  if (pathname.startsWith("/perfil")) return "perfil";
  if (pathname.startsWith("/pantallas")) return "pantallas";
  if (pathname.startsWith("/modulos")) return "modulos";
  if (pathname.startsWith("/inicio") || pathname === "/") return "inicio";
  return "inicio";
}

