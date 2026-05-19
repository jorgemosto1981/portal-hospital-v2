import { ARTICULO_IDS_PATRON_B_MVP } from "./solicitudesArticuloV2.js";

export const ESTADOS_MODULO = {
  ACTIVO: "activo",
  MVP: "mvp",
  BORRADOR: "borrador",
  LEGACY: "legacy",
};

/**
 * Bloques del menú raíz: encadenamiento lógico por paquete de rol (producto).
 * Los ítems de {@link MODULOS_PORTAL} referencian `grupo` por id.
 */
export const GRUPOS_MENU_RAIZ = [
  {
    id: "usuario",
    titulo: "Rol usuario",
    descripcion: "Agente: inicio del portal y datos personales propios.",
  },
  {
    id: "jefe",
    titulo: "Rol jefe",
    descripcion: "Jerarquía: supervisión — vista operativa / equipo (grilla).",
  },
  {
    id: "rrhh",
    titulo: "Rol RRHH",
    descripcion: "Gestión: datos laborales, módulo RRHH, catálogos y referencias técnicas.",
  },
  {
    id: "medico",
    titulo: "Rol médico",
    descripcion: "Área clínica (ítems de menú pendientes de asignar).",
  },
  {
    id: "visualizador",
    titulo: "Rol visualizador",
    descripcion: "Consulta / auditoría (ítems de menú pendientes de asignar).",
  },
];

export const MODULOS_PORTAL = [
  {
    id: "inicio",
    label: "Inicio",
    path: "/portal/home",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "usuario",
  },
  {
    id: "perfil",
    label: "Perfil",
    path: "/portal/mi-perfil",
    estado: ESTADOS_MODULO.MVP,
    grupo: "usuario",
  },
  {
    id: "laboral",
    label: "Laboral",
    path: "/portal/laboral",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "ticketera",
    label: "Solicitudes",
    path: "/portal/solicitudes",
    estado: ESTADOS_MODULO.MVP,
    grupo: "usuario",
    /** Hub visible si hay Patrón B hoy o siempre (incluye carril LAO en pantalla). */
    articulosIngresoIds: ARTICULO_IDS_PATRON_B_MVP,
    ticketeraSiempreVisible: true,
  },
  {
    id: "antiguedad",
    label: "Antigüedad",
    path: "/portal/rrhh/antiguedad",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "articulos-cfg",
    label: "Artículos",
    path: "/portal/rrhh/configuracion-articulos",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "checkin-saldos",
    label: "Check-in saldos",
    path: "/portal/rrhh/checkin-saldos",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "bandeja-solicitudes-rrhh",
    label: "Bandeja solic.",
    path: "/portal/rrhh/solicitudes-articulo",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
    bandejaRrhhMenu: true,
  },
  {
    id: "grilla",
    label: "Grilla",
    path: "/portal/grilla",
    estado: ESTADOS_MODULO.BORRADOR,
    grupo: "jefe",
  },
  {
    id: "bandeja-solicitudes-jefe",
    label: "Bandeja solic.",
    path: "/portal/jefe/solicitudes",
    estado: ESTADOS_MODULO.MVP,
    grupo: "jefe",
    bandejaJefeMenu: true,
  },
  {
    id: "rrhh",
    label: "RRHH",
    path: "/portal/rrhh/alta",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "rrhh",
  },
  {
    id: "alta-agente-guia",
    label: "Alta agente (guía)",
    path: "/portal/rrhh/alta-agente",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "configuracion",
    label: "Config",
    path: "/portal/configuracion",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "rrhh",
  },
  {
    id: "perfil-rrhh",
    label: "Datos personales",
    path: "/portal/perfil",
    estado: ESTADOS_MODULO.MVP,
    grupo: "rrhh",
  },
  {
    id: "pantallas",
    label: "Pantallas",
    path: "/portal/pantallas",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "rrhh",
  },
  {
    id: "modulos",
    label: "Módulos",
    path: "/portal/modulos",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "rrhh",
  },
  {
    id: "sistemas-web",
    label: "Sistemas web",
    path: "/portal/sistemas-web",
    estado: ESTADOS_MODULO.ACTIVO,
    grupo: "rrhh",
  },
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
  if (pathname.startsWith("/portal/rrhh/solicitudes-articulo")) return "bandeja-solicitudes-rrhh";
  if (pathname.startsWith("/portal/rrhh/checkin-saldos") || pathname.startsWith("/portal/rrhh/lao-checkin")) {
    return "checkin-saldos";
  }
  if (pathname.startsWith("/portal/rrhh/configuracion-articulos")) return "articulos-cfg";
  if (pathname.startsWith("/portal/rrhh") || pathname.startsWith("/rrhh")) return "rrhh";
  if (pathname.startsWith("/portal/configuracion") || pathname.startsWith("/configuracion")) return "configuracion";
  if (pathname.startsWith("/portal/grilla") || pathname.startsWith("/grilla")) return "grilla";
  if (pathname.startsWith("/portal/jefe/solicitudes")) return "bandeja-solicitudes-jefe";
  if (pathname.startsWith("/portal/solicitudes")) return "ticketera";
  if (pathname.startsWith("/portal/laboral") || pathname.startsWith("/laboral")) return "laboral";
  if (pathname.startsWith("/portal/mi-perfil")) return "perfil";
  if (pathname.startsWith("/portal/perfil") || pathname.startsWith("/perfil")) return "perfil-rrhh";
  if (pathname.startsWith("/portal/pantallas") || pathname.startsWith("/pantallas")) return "pantallas";
  if (pathname.startsWith("/portal/modulos") || pathname.startsWith("/modulos")) return "modulos";
  if (pathname.startsWith("/portal/sistemas-web")) return "sistemas-web";
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
