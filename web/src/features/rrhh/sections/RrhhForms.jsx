import Card from "../../../components/ui/Card.jsx";
import PrimaryButton from "../../../components/ui/PrimaryButton.jsx";

export function AltaAgenteForm({
  handleSubmit,
  dni,
  setDni,
  nombre,
  setNombre,
  apellido,
  setApellido,
  rolId,
  setRolId,
  roles,
  grupoId,
  setGrupoId,
  grupos,
  nivel,
  setNivel,
  busy,
  etiquetaCatalogo,
}) {
  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium">DNI (solo números)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            maxLength={12}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Apellido</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Rol de aplicación</label>
          <p className="mb-1 text-xs text-slate-500">
            Definido en <code>cfg_rol</code> (V2). Un rol por cáscara en este formulario; la cuenta puede
            ampliarse luego vía administración.
          </p>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            required
          >
            <option value="">{roles.length ? "Elegir…" : "Sembrá cfg_rol (npm run seed:cfg)"}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {etiquetaCatalogo(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Grupo de trabajo</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
          >
            <option value="">{grupos.length ? "Elegir…" : "Sin nodos (seed primero)"}</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre || g.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Nivel jerárquico (1–99 en la burbuja)</label>
          <input
            type="number"
            min={1}
            max={99}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={nivel}
            onChange={(e) => setNivel(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <PrimaryButton type="submit" disabled={busy} className="!mt-4 w-full">
          {busy ? "Enviando…" : "Crear cáscara (personas + cuenta pend.)"}
        </PrimaryButton>
      </form>
    </Card>
  );
}

export function EstadoCuentaForm({
  handleActualizarEstadoCuenta,
  personaEstadoId,
  setPersonaEstadoId,
  personasConCuenta,
  etiquetaPersona,
  estadoAccesoId,
  setEstadoAccesoId,
  estadosCuentaAcceso,
  etiquetaCatalogo,
  motivoEstado,
  setMotivoEstado,
  busyEstado,
}) {
  return (
    <Card className="mt-4 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">Gestión de acceso de cuenta (RRHH)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Permite bloquear/rehabilitar/deshabilitar acceso en <code>usuarios_cuenta.estado_acceso</code> por <code>persona_id</code>.
      </p>
      <form onSubmit={handleActualizarEstadoCuenta} className="mt-3 space-y-3">
        <div>
          <label className="text-sm font-medium">persona_id</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={personaEstadoId}
            onChange={(e) => setPersonaEstadoId(e.target.value)}
            required
          >
            <option value="">Seleccionar persona...</option>
            {personasConCuenta.map((p) => (
              <option key={p.id} value={p.id}>
                {etiquetaPersona(p)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Solo personas con `usuarios_cuenta` asociada.</p>
        </div>
        <div>
          <label className="text-sm font-medium">estado_acceso_id</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={estadoAccesoId}
            onChange={(e) => setEstadoAccesoId(e.target.value)}
            required
          >
            <option value="">Seleccionar estado...</option>
            {estadosCuentaAcceso.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} ({etiquetaCatalogo(x)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Motivo (opcional)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={motivoEstado}
            onChange={(e) => setMotivoEstado(e.target.value)}
            placeholder="Ej: bloqueo preventivo, rehabilitación, etc."
          />
        </div>
        <PrimaryButton type="submit" disabled={busyEstado} className="!mt-2 w-full">
          {busyEstado ? "Aplicando..." : "Aplicar estado de acceso"}
        </PrimaryButton>
      </form>
    </Card>
  );
}

export function BajaLaboralForm(props) {
  const {
    handleAplicarBajaLaboral, personaBajaId, setPersonaBajaId, personasConCuenta, etiquetaPersona,
    fechaBaja, setFechaBaja, causalFinAsignacionId, setCausalFinAsignacionId, causalesFinAsignacion,
    motivoBajaId, setMotivoBajaId, motivosBajaPersona, etiquetaCatalogo, bloquearAccesoEnBaja,
    setBloquearAccesoEnBaja, motivoBajaTexto, setMotivoBajaTexto, busyBaja,
  } = props;
  return (
    <Card className="mt-4 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">Baja laboral transaccional (RRHH)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Cierra todos los HLc vigentes de la persona, marca baja en <code>personas</code> y opcionalmente bloquea acceso.
      </p>
      <form onSubmit={handleAplicarBajaLaboral} className="mt-3 space-y-3">
        <div>
          <label className="text-sm font-medium">persona_id</label>
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={personaBajaId} onChange={(e) => setPersonaBajaId(e.target.value)} required>
            <option value="">Seleccionar persona...</option>
            {personasConCuenta.map((p) => <option key={p.id} value={p.id}>{etiquetaPersona(p)}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Solo personas con `usuarios_cuenta` asociada.</p>
        </div>
        <div>
          <label className="text-sm font-medium">fecha_baja_laboral</label>
          <input type="date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium">causal_fin_asignacion_id</label>
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={causalFinAsignacionId} onChange={(e) => setCausalFinAsignacionId(e.target.value)} required>
            <option value="">Seleccionar causal...</option>
            {causalesFinAsignacion.map((x) => <option key={x.id} value={x.id}>{x.id} ({etiquetaCatalogo(x)})</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">motivo_baja_id (persona)</label>
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={motivoBajaId} onChange={(e) => setMotivoBajaId(e.target.value)}>
            <option value="">Sin motivo específico</option>
            {motivosBajaPersona.map((x) => <option key={x.id} value={x.id}>{x.id} ({etiquetaCatalogo(x)})</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={bloquearAccesoEnBaja} onChange={(e) => setBloquearAccesoEnBaja(e.target.checked)} />
          Bloquear acceso de cuenta al aplicar la baja
        </label>
        <div>
          <label className="text-sm font-medium">Motivo operativo (opcional)</label>
          <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={motivoBajaTexto} onChange={(e) => setMotivoBajaTexto(e.target.value)} placeholder="Detalle para auditoría del evento" />
        </div>
        <PrimaryButton type="submit" disabled={busyBaja} className="!mt-2 w-full">
          {busyBaja ? "Aplicando baja..." : "Aplicar baja laboral"}
        </PrimaryButton>
      </form>
    </Card>
  );
}

export function ReinicioVinculacionForm(props) {
  const {
    handleReiniciarVinculacion, personaReinicioId, setPersonaReinicioId, personas, etiquetaPersona,
    resetEstadoOnboarding, setResetEstadoOnboarding, estadoAccesoReinicioId, setEstadoAccesoReinicioId,
    estadosCuentaAcceso, etiquetaCatalogo, motivoReinicio, setMotivoReinicio, busyReinicio,
  } = props;
  return (
    <Card className="mt-4 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">Reinicio de vinculación e invalidación de sesión (RRHH)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Revoca sesión Auth vinculada, limpia <code>auth_uid</code>/<code>username</code> y deja la cuenta en el estado de acceso seleccionado para re-vincular por DNI.
      </p>
      <form onSubmit={handleReiniciarVinculacion} className="mt-3 space-y-3">
        <div>
          <label className="text-sm font-medium">persona_id</label>
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={personaReinicioId} onChange={(e) => setPersonaReinicioId(e.target.value)} required>
            <option value="">Seleccionar persona...</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{etiquetaPersona(p)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={resetEstadoOnboarding} onChange={(e) => setResetEstadoOnboarding(e.target.checked)} />
          Resetear persona a estado PENDIENTE_ONBOARDING
        </label>
        <div>
          <label className="text-sm font-medium">estado_acceso_id destino</label>
          <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={estadoAccesoReinicioId} onChange={(e) => setEstadoAccesoReinicioId(e.target.value)} required>
            <option value="">Seleccionar estado...</option>
            {estadosCuentaAcceso.map((x) => <option key={x.id} value={x.id}>{x.id} ({etiquetaCatalogo(x)})</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Motivo (opcional)</label>
          <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={motivoReinicio} onChange={(e) => setMotivoReinicio(e.target.value)} placeholder="Detalle operativo para auditoría" />
        </div>
        <PrimaryButton type="submit" disabled={busyReinicio} className="!mt-2 w-full">
          {busyReinicio ? "Reiniciando..." : "Reiniciar vinculación y revocar sesión"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
