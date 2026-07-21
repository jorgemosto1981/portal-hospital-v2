import { Link } from "react-router-dom";

import {
  BajaLaboralForm,
  EstadoCuentaForm,
  ReinicioVinculacionForm,
} from "../../features/rrhh/sections/RrhhForms.jsx";
import { etiquetaCatalogo, etiquetaPersona } from "../../features/rrhh/utils.js";
import { useGestionUsuariosRrhh } from "../../features/rrhh/useGestionUsuariosRrhh.js";

/** Acciones administrativas: acceso, baja laboral y reinicio de vinculación. */
export default function GestionUsuariosRrhhPage() {
  const g = useGestionUsuariosRrhh();

  if (!g.user && !g.openAccessTemp) {
    return <p className="p-6 text-sm text-slate-500">Iniciá sesión con rol RRHH para gestionar usuarios.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-md px-3 py-6 text-slate-900 md:max-w-lg">
      <h1 className="text-xl font-semibold">Gestión de usuarios</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Bloqueo o rehabilitación de acceso, baja laboral y reinicio de vinculación Auth. El alta inicial está en{" "}
        <Link to="/portal/rrhh/alta-agente" className="font-medium text-blue-700 underline">
          Alta nuevo usuario
        </Link>
        .
      </p>

      {g.load ? (
        <p className="mt-6 text-sm text-slate-500">Cargando catálogos…</p>
      ) : (
        <div className="mt-4 space-y-0">
          <EstadoCuentaForm
            handleActualizarEstadoCuenta={g.handleActualizarEstadoCuenta}
            personaEstadoId={g.personaEstadoId}
            setPersonaEstadoId={g.setPersonaEstadoId}
            personasConCuenta={g.personasConCuenta}
            etiquetaPersona={etiquetaPersona}
            estadoAccesoId={g.estadoAccesoId}
            setEstadoAccesoId={g.setEstadoAccesoId}
            estadosCuentaAcceso={g.estadosCuentaAcceso}
            etiquetaCatalogo={etiquetaCatalogo}
            motivoEstado={g.motivoEstado}
            setMotivoEstado={g.setMotivoEstado}
            busyEstado={g.busyEstado}
          />
          <BajaLaboralForm
            handleAplicarBajaLaboral={g.handleAplicarBajaLaboral}
            personaBajaId={g.personaBajaId}
            setPersonaBajaId={g.setPersonaBajaId}
            personasConCuenta={g.personasConCuenta}
            etiquetaPersona={etiquetaPersona}
            fechaBaja={g.fechaBaja}
            setFechaBaja={g.setFechaBaja}
            causalFinAsignacionId={g.causalFinAsignacionId}
            setCausalFinAsignacionId={g.setCausalFinAsignacionId}
            causalesFinAsignacion={g.causalesFinAsignacion}
            motivoBajaId={g.motivoBajaId}
            setMotivoBajaId={g.setMotivoBajaId}
            motivosBajaPersona={g.motivosBajaPersona}
            etiquetaCatalogo={etiquetaCatalogo}
            bloquearAccesoEnBaja={g.bloquearAccesoEnBaja}
            setBloquearAccesoEnBaja={g.setBloquearAccesoEnBaja}
            motivoBajaTexto={g.motivoBajaTexto}
            setMotivoBajaTexto={g.setMotivoBajaTexto}
            busyBaja={g.busyBaja}
          />
          <ReinicioVinculacionForm
            handleReiniciarVinculacion={g.handleReiniciarVinculacion}
            personaReinicioId={g.personaReinicioId}
            setPersonaReinicioId={g.setPersonaReinicioId}
            personas={g.personas}
            etiquetaPersona={etiquetaPersona}
            resetEstadoOnboarding={g.resetEstadoOnboarding}
            setResetEstadoOnboarding={g.setResetEstadoOnboarding}
            estadoAccesoReinicioId={g.estadoAccesoReinicioId}
            setEstadoAccesoReinicioId={g.setEstadoAccesoReinicioId}
            estadosCuentaAcceso={g.estadosCuentaAcceso}
            etiquetaCatalogo={etiquetaCatalogo}
            motivoReinicio={g.motivoReinicio}
            setMotivoReinicio={g.setMotivoReinicio}
            busyReinicio={g.busyReinicio}
          />
        </div>
      )}
    </div>
  );
}
