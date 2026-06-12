import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";

import LoginRoute from "./features/auth/LoginRoute.jsx";
import IdleSessionGuard from "./features/auth/IdleSessionGuard.jsx";
import { useAuthSession } from "./features/auth/useAuthSession.js";
import VinculacionDni from "./features/auth/VinculacionDni.jsx";
import OnboardingWizard from "./features/onboarding/OnboardingWizard.jsx";
import PortalLayout from "./features/routing/PortalLayout.jsx";
import { GateSpinner, ProtectedRoute, PublicRoute, RoleGuard } from "./features/routing/RouteGuards.jsx";
import MvpAccessGate from "./features/shell/MvpAccessGate.jsx";
import AltaAgenteRRHH from "./features/rrhh/AltaAgenteRRHH.jsx";
import DatosLaborales from "./pages/DatosLaborales.jsx";
import Antiguedad from "./pages/Antiguedad.jsx";
import DatosPersonales from "./pages/DatosPersonales.jsx";
import EstadoModulos from "./pages/EstadoModulos.jsx";
import NotificacionesEventosDatosPersonalesRRHH from "./pages/NotificacionesEventosDatosPersonalesRRHH.jsx";
import PantallasCatalogo from "./pages/PantallasCatalogo.jsx";
import Perfil from "./pages/Perfil.jsx";
import Configuracion from "./pages/Configuracion.jsx";
import ArticuloConfiguracion from "./pages/ArticuloConfiguracion.jsx";
import ArticuloListadoGrilla from "./pages/ArticuloListadoGrilla.jsx";
import ArticuloVersionesListado from "./pages/ArticuloVersionesListado.jsx";
import LaoWizardTicketera from "./pages/LaoWizardTicketera.jsx";
import SolicitudLaoAlta from "./pages/SolicitudLaoAlta.jsx";
import Solicitud64AAlta from "./pages/Solicitud64AAlta.jsx";
import TicketeraShell from "./features/solicitudes/TicketeraShell.jsx";
import TicketeraHub from "./pages/TicketeraHub.jsx";
import TicketeraPatronB from "./pages/TicketeraPatronB.jsx";
import TicketeraPatronC from "./pages/TicketeraPatronC.jsx";
import BandejaJefeSolicitudes from "./pages/BandejaJefeSolicitudes.jsx";
import BandejaRrhhSolicitudes from "./pages/BandejaRrhhSolicitudes.jsx";
import GuardArticuloIngreso from "./features/solicitudes/GuardArticuloIngreso.jsx";
import { ARTICULO_IDS_PATRON_B_MVP, ARTICULO_IDS_PATRON_C_MVP } from "./constants/solicitudesArticuloV2.js";
import CheckinSaldosAgente from "./pages/CheckinSaldosAgente.jsx";
import AltaAgenteOnboardingRRHH from "./pages/AltaAgenteOnboardingRRHH.jsx";
import LaoCheckinRRHH from "./pages/LaoCheckinRRHH.jsx";
import SeguimientoEnrolamientoUsuariosRRHH from "./pages/SeguimientoEnrolamientoUsuariosRRHH.jsx";
import CalendarioConfig from "./pages/rrhh/CalendarioConfig.jsx";
import RegimenesHorariosPage from "./pages/rrhh/RegimenesHorariosPage.jsx";
import PlanTurnoServicioJefePage from "./pages/jefe/PlanTurnoServicioJefePage.jsx";
import PlanTurnoServicioRrhhPage from "./pages/rrhh/PlanTurnoServicioRrhhPage.jsx";
import BandejaTurnosRrhhPage from "./pages/rrhh/BandejaTurnosRrhhPage.jsx";
import ExploradorTurnosRrhhPage from "./pages/rrhh/ExploradorTurnosRrhhPage.jsx";
import GrillaOperativaRrhhPage from "./pages/rrhh/GrillaOperativaRrhhPage.jsx";
import FichadasImportRrhhPage from "./pages/rrhh/FichadasImportRrhhPage.jsx";
import FichadasHuerfanasRrhhPage from "./pages/rrhh/FichadasHuerfanasRrhhPage.jsx";
import FichadasEnrolamientoRrhhPage from "./pages/rrhh/FichadasEnrolamientoRrhhPage.jsx";
import FichadasConsultaEnrolamientoRrhhPage from "./pages/rrhh/FichadasConsultaEnrolamientoRrhhPage.jsx";
import FichadasCargaManualRrhhPage from "./pages/rrhh/FichadasCargaManualRrhhPage.jsx";
import FichadasRelojesRrhhPage from "./pages/rrhh/FichadasRelojesRrhhPage.jsx";
import GrillaOperativaJefePage from "./pages/jefe/GrillaOperativaJefePage.jsx";
import GrillaPortalRedirect from "./features/routing/GrillaPortalRedirect.jsx";
import Inicio from "./pages/Inicio.jsx";
import SistemasWeb from "./pages/SistemasWeb.jsx";
import PerfilUsuario from "./pages/PerfilUsuario.jsx";
import runtimeFlags from "../../shared/runtimeFlags.json";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

function RootRedirect() {
  const { user, authPending } = useAuthSession();
  if (!OPEN_ACCESS_TEMP && !BYPASS_AUTH && authPending) {
    return <GateSpinner label="Cargando…" />;
  }
  if (!OPEN_ACCESS_TEMP && !BYPASS_AUTH && !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/portal/home" replace />;
}

function LegacyNavigate({ to }) {
  return <Navigate to={to} replace />;
}

/**
 * Rutas autenticadas + gate MVP (persona_id, onboarding).
 */
function AuthedGateLayout() {
  return (
    <MvpAccessGate>
      <ProtectedRoute>
        <Outlet />
      </ProtectedRoute>
    </MvpAccessGate>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <IdleSessionGuard />
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <MvpAccessGate>
              <PublicRoute>
                <LoginRoute />
              </PublicRoute>
            </MvpAccessGate>
          }
        />
        <Route path="/registro" element={<Navigate to="/login?alta=1" replace />} />
        <Route path="/vinculacion" element={<VinculacionDni />} />

        <Route element={<AuthedGateLayout />}>
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<Inicio />} />
            <Route path="mi-perfil" element={<PerfilUsuario />} />
            <Route path="laboral" element={<DatosLaborales />} />
            <Route path="solicitudes" element={<TicketeraShell />}>
              <Route index element={<TicketeraHub />} />
              <Route
                path="patron-b"
                element={
                  <GuardArticuloIngreso articuloIds={ARTICULO_IDS_PATRON_B_MVP}>
                    <TicketeraPatronB />
                  </GuardArticuloIngreso>
                }
              />
              <Route
                path="patron-c"
                element={
                  <GuardArticuloIngreso articuloIds={ARTICULO_IDS_PATRON_C_MVP}>
                    <TicketeraPatronC />
                  </GuardArticuloIngreso>
                }
              />
              <Route path="lao" element={<LaoWizardTicketera />} />
              <Route path="lao-formulario" element={<SolicitudLaoAlta />} />
            </Route>
            <Route path="solicitudes/asuntos-particulares" element={<Solicitud64AAlta />} />
            <Route path="perfil" element={<DatosPersonales />} />
            <Route path="perfil/:personaId" element={<Perfil />} />
            <Route path="grilla" element={<GrillaPortalRedirect />} />
            <Route path="jefe/solicitudes" element={<BandejaJefeSolicitudes />} />
            <Route path="jefe/planes-turno" element={<PlanTurnoServicioJefePage />} />
            <Route path="jefe/grilla-operativa" element={<GrillaOperativaJefePage />} />
            <Route path="modulos" element={<EstadoModulos />} />
            <Route path="pantallas" element={<PantallasCatalogo />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route element={<RoleGuard />}>
              <Route path="sistemas-web" element={<SistemasWeb />} />
              <Route path="rrhh/alta" element={<AltaAgenteRRHH />} />
              <Route path="rrhh/alta-agente" element={<AltaAgenteOnboardingRRHH />} />
              <Route path="rrhh/antiguedad" element={<Antiguedad />} />
              <Route path="rrhh/solicitudes-articulo" element={<BandejaRrhhSolicitudes />} />
              <Route path="rrhh/checkin-saldos" element={<CheckinSaldosAgente />} />
              <Route path="rrhh/calendario-institucional" element={<CalendarioConfig />} />
              <Route path="rrhh/regimenes-horarios" element={<RegimenesHorariosPage />} />
              <Route path="rrhh/bandeja-turnos" element={<BandejaTurnosRrhhPage />} />
              <Route path="rrhh/explorador-turnos" element={<ExploradorTurnosRrhhPage />} />
              <Route path="rrhh/grilla-operativa" element={<GrillaOperativaRrhhPage />} />
              <Route path="rrhh/planes-turno" element={<PlanTurnoServicioRrhhPage />} />
              <Route path="rrhh/lao-checkin" element={<LaoCheckinRRHH />} />
              <Route path="rrhh/configuracion-articulos" element={<ArticuloListadoGrilla />} />
              <Route
                path="rrhh/configuracion-articulos/:articuloId/versiones"
                element={<ArticuloVersionesListado />}
              />
              <Route path="rrhh/configuracion-articulos/:articuloId" element={<ArticuloConfiguracion />} />
              <Route path="rrhh/notificaciones-datos-personales" element={<NotificacionesEventosDatosPersonalesRRHH />} />
              <Route path="rrhh/seguimiento-enrolamiento" element={<SeguimientoEnrolamientoUsuariosRRHH />} />
              <Route path="rrhh/fichadas-relojes" element={<FichadasRelojesRrhhPage />} />
              <Route path="rrhh/fichadas-import" element={<FichadasImportRrhhPage />} />
              <Route path="rrhh/fichadas-huerfanas" element={<FichadasHuerfanasRrhhPage />} />
              <Route path="rrhh/fichadas-enrolamiento" element={<FichadasEnrolamientoRrhhPage />} />
              <Route path="rrhh/fichadas-consulta-enrolamiento" element={<FichadasConsultaEnrolamientoRrhhPage />} />
              <Route path="rrhh/fichadas-carga-manual" element={<FichadasCargaManualRrhhPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/inicio" element={<LegacyNavigate to="/portal/home" />} />
        <Route path="/laboral" element={<LegacyNavigate to="/portal/laboral" />} />
        <Route path="/perfil" element={<LegacyNavigate to="/portal/perfil" />} />
        <Route path="/perfil/:personaId" element={<LegacyPerfilRedirect />} />
        <Route path="/grilla" element={<LegacyNavigate to="/portal/rrhh/grilla-operativa" />} />
        <Route path="/modulos" element={<LegacyNavigate to="/portal/modulos" />} />
        <Route path="/pantallas" element={<LegacyNavigate to="/portal/pantallas" />} />
        <Route path="/configuracion" element={<LegacyNavigate to="/portal/configuracion" />} />
        <Route path="/rrhh/alta" element={<LegacyNavigate to="/portal/rrhh/alta" />} />
        <Route path="/rrhh/antiguedad" element={<LegacyNavigate to="/portal/rrhh/antiguedad" />} />
        <Route
          path="/rrhh/configuracion-articulos"
          element={<LegacyNavigate to="/portal/rrhh/configuracion-articulos" />}
        />
        <Route
          path="/rrhh/notificaciones-datos-personales"
          element={<LegacyNavigate to="/portal/rrhh/notificaciones-datos-personales" />}
        />
        <Route path="/rrhh/seguimiento-enrolamiento" element={<LegacyNavigate to="/portal/rrhh/seguimiento-enrolamiento" />} />

        <Route path="*" element={<Navigate to="/portal/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function LegacyPerfilRedirect() {
  const { personaId } = useParams();
  const id = typeof personaId === "string" ? personaId : "";
  return <Navigate to={id ? `/portal/perfil/${id}` : "/portal/perfil"} replace />;
}
