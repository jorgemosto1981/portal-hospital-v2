/**
 * Desde el catálogo `/portal/pantallas`, el rol RRHH entra por la **rama inicial** de cada bloque
 * (sin saltar a subpantallas). Las rutas “reales” siguen en `path` para referencia.
 */
export const RRHH_RAMA_INICIAL_PORTAL = "/portal/rrhh/alta";
const RRHH_RUTAS_DIRECTAS_HABILITADAS = new Set([
  "/portal/rrhh/notificaciones-datos-personales",
  "/portal/rrhh/seguimiento-enrolamiento",
  "/portal/rrhh/fichadas-import",
  "/portal/rrhh/fichadas-huerfanas",
  "/portal/rrhh/fichadas-enrolamiento",
]);

/**
 * @param {{ path: string, id?: string }} p — ítem de {@link PANTALLAS_CATALOGO}
 * @returns {string} destino del enlace “Abrir” para flujo RRHH
 */
export function pathCatalogoRrhh(p) {
  const raw = typeof p.path === "string" ? p.path : "";
  if (
    raw.startsWith("/portal/rrhh/") &&
    raw !== RRHH_RAMA_INICIAL_PORTAL &&
    !RRHH_RUTAS_DIRECTAS_HABILITADAS.has(raw)
  ) {
    return RRHH_RAMA_INICIAL_PORTAL;
  }
  if (p.id === "perfil-legajo") {
    return RRHH_RAMA_INICIAL_PORTAL;
  }
  return raw || "/portal/home";
}

export const PANTALLAS_CATALOGO = [
  { id: "inicio", titulo: "Inicio", path: "/portal/home", estado: "activo", fuente: "web/src/pages/Inicio.jsx" },
  { id: "perfil-usuario", titulo: "Perfil usuario", path: "/portal/mi-perfil", estado: "mvp", fuente: "web/src/pages/PerfilUsuario.jsx" },
  { id: "laboral", titulo: "Datos laborales", path: "/portal/laboral", estado: "mvp", fuente: "web/src/pages/DatosLaborales.jsx" },
  { id: "configuracion", titulo: "Configuración", path: "/portal/configuracion", estado: "activo", fuente: "web/src/pages/Configuracion.jsx" },
  { id: "datos-personales", titulo: "Datos personales", path: "/portal/perfil", estado: "mvp", fuente: "web/src/pages/DatosPersonales.jsx" },
  { id: "perfil-legajo", titulo: "Perfil (legajo por id)", path: "/portal/perfil/per_demo", estado: "mvp", fuente: "web/src/pages/Perfil.jsx" },
  {
    id: "grilla",
    titulo: "Grilla operativa",
    path: "/portal/rrhh/grilla-operativa",
    estado: "borrador",
    fuente: "web/src/pages/rrhh/GrillaOperativaRrhhPage.jsx",
  },
  {
    id: "fichadas-import",
    titulo: "Fichadas — import TXT",
    path: "/portal/rrhh/fichadas-import",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/FichadasImportRrhhPage.jsx",
  },
  {
    id: "fichadas-huerfanas",
    titulo: "Fichadas — huérfanas",
    path: "/portal/rrhh/fichadas-huerfanas",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/FichadasHuerfanasRrhhPage.jsx",
  },
  {
    id: "grilla-jefe",
    titulo: "Grilla operativa (jefe)",
    path: "/portal/jefe/grilla-operativa",
    estado: "mvp",
    fuente: "web/src/pages/jefe/GrillaOperativaJefePage.jsx",
  },
  { id: "onboarding", titulo: "Onboarding wizard", path: "/onboarding", estado: "activo", fuente: "web/src/features/onboarding/OnboardingWizard.jsx" },
  { id: "rrhh-alta", titulo: "RRHH alta agente", path: "/portal/rrhh/alta", estado: "activo", fuente: "web/src/features/rrhh/AltaAgenteRRHH.jsx" },
  {
    id: "rrhh-notif-datos",
    titulo: "RRHH notificaciones datos personales",
    path: "/portal/rrhh/notificaciones-datos-personales",
    estado: "activo",
    fuente: "web/src/pages/NotificacionesEventosDatosPersonalesRRHH.jsx",
  },
  {
    id: "rrhh-seg-enrol",
    titulo: "RRHH seguimiento enrolamiento",
    path: "/portal/rrhh/seguimiento-enrolamiento",
    estado: "activo",
    fuente: "web/src/pages/SeguimientoEnrolamientoUsuariosRRHH.jsx",
  },
  { id: "login", titulo: "Login", path: "/login", estado: "activo", fuente: "web/src/features/auth/LoginRoute.jsx" },
  { id: "registro", titulo: "Registro primer acceso", path: "/login?alta=1", estado: "activo", fuente: "web/src/features/auth/AccesoPortal.jsx" },
  { id: "vinculacion", titulo: "Vinculación por DNI (soporte)", path: "/vinculacion", estado: "activo-soporte", fuente: "web/src/features/auth/VinculacionDni.jsx" },
  { id: "modulos", titulo: "Estado de módulos", path: "/portal/modulos", estado: "activo", fuente: "web/src/pages/EstadoModulos.jsx" },
  { id: "sistemas-web", titulo: "Sistemas web", path: "/portal/sistemas-web", estado: "activo", fuente: "web/src/pages/SistemasWeb.jsx" },
  { id: "pantallas", titulo: "Catálogo de pantallas", path: "/portal/pantallas", estado: "activo", fuente: "web/src/pages/PantallasCatalogo.jsx" },
];
