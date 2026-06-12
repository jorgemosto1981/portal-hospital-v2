/**
 * Desde el catálogo `/portal/pantallas`, el rol RRHH entra por la **rama inicial** de cada bloque
 * (sin saltar a subpantallas). Las rutas “reales” siguen en `path` para referencia.
 */
export const RRHH_RAMA_INICIAL_PORTAL = "/portal/rrhh/alta";

/**
 * @param {{ path: string, id?: string }} p — ítem de {@link PANTALLAS_CATALOGO}
 * @returns {string} destino del enlace “Abrir” (ruta real salvo demo legajo)
 */
export function pathCatalogoRrhh(p) {
  const raw = typeof p.path === "string" ? p.path : "";
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
    estado: "mvp",
    fuente: "web/src/pages/rrhh/GrillaOperativaRrhhPage.jsx",
  },
  {
    id: "ticketera",
    titulo: "Solicitudes (ticketera)",
    path: "/portal/solicitudes",
    estado: "mvp",
    fuente: "web/src/pages/TicketeraHub.jsx",
  },
  {
    id: "fichadas-relojes",
    titulo: "Fichadas — relojes biométricos",
    path: "/portal/rrhh/fichadas-relojes",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/FichadasRelojesRrhhPage.jsx",
  },
  {
    id: "fichadas-enrolamiento",
    titulo: "Fichadas — enrolamiento tarjeta ↔ persona",
    path: "/portal/rrhh/fichadas-enrolamiento",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/FichadasEnrolamientoRrhhPage.jsx",
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
    id: "fichadas-carga-manual",
    titulo: "Fichadas — carga manual",
    path: "/portal/rrhh/fichadas-carga-manual",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/FichadasCargaManualRrhhPage.jsx",
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
    id: "rrhh-alta-agente-guia",
    titulo: "RRHH alta agente (guía onboarding)",
    path: "/portal/rrhh/alta-agente",
    estado: "mvp",
    fuente: "web/src/pages/AltaAgenteOnboardingRRHH.jsx",
  },
  {
    id: "rrhh-antiguedad",
    titulo: "RRHH antigüedad",
    path: "/portal/rrhh/antiguedad",
    estado: "mvp",
    fuente: "web/src/pages/Antiguedad.jsx",
  },
  {
    id: "bandeja-solicitudes-rrhh",
    titulo: "RRHH bandeja solicitudes artículo",
    path: "/portal/rrhh/solicitudes-articulo",
    estado: "mvp",
    fuente: "web/src/pages/BandejaRrhhSolicitudes.jsx",
  },
  {
    id: "checkin-saldos",
    titulo: "RRHH check-in saldos agente",
    path: "/portal/rrhh/checkin-saldos",
    estado: "mvp",
    fuente: "web/src/pages/CheckinSaldosAgente.jsx",
  },
  {
    id: "lao-checkin-rrhh",
    titulo: "RRHH check-in LAO",
    path: "/portal/rrhh/lao-checkin",
    estado: "mvp",
    fuente: "web/src/pages/LaoCheckinRRHH.jsx",
  },
  {
    id: "calendario-institucional",
    titulo: "RRHH calendario institucional",
    path: "/portal/rrhh/calendario-institucional",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/CalendarioConfig.jsx",
  },
  {
    id: "regimenes-horarios",
    titulo: "RRHH regímenes horarios",
    path: "/portal/rrhh/regimenes-horarios",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/RegimenesHorariosPage.jsx",
  },
  {
    id: "bandeja-turnos-evaluador",
    titulo: "RRHH bandeja turnos (evaluador)",
    path: "/portal/rrhh/bandeja-turnos",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/BandejaTurnosRrhhPage.jsx",
  },
  {
    id: "explorador-turnos-rrhh",
    titulo: "RRHH explorador turnos",
    path: "/portal/rrhh/explorador-turnos",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/ExploradorTurnosRrhhPage.jsx",
  },
  {
    id: "planes-turno-rrhh",
    titulo: "RRHH planes turno mensual",
    path: "/portal/rrhh/planes-turno",
    estado: "mvp",
    fuente: "web/src/pages/rrhh/PlanTurnoServicioRrhhPage.jsx",
  },
  {
    id: "articulos-cfg",
    titulo: "RRHH configuración artículos",
    path: "/portal/rrhh/configuracion-articulos",
    estado: "mvp",
    fuente: "web/src/pages/ArticuloListadoGrilla.jsx",
  },
  {
    id: "planes-turno-jefe",
    titulo: "Jefe planes turno mensual",
    path: "/portal/jefe/planes-turno",
    estado: "mvp",
    fuente: "web/src/pages/jefe/PlanTurnoServicioJefePage.jsx",
  },
  {
    id: "bandeja-solicitudes-jefe",
    titulo: "Jefe bandeja solicitudes",
    path: "/portal/jefe/solicitudes",
    estado: "mvp",
    fuente: "web/src/pages/BandejaJefeSolicitudes.jsx",
  },
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
