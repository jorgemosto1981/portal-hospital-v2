import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import {
  callListarColeccion,
  callListarColeccionPublicaTemporal,
  callRrhhAltaAgente,
  callRrhhAplicarBajaLaboral,
  callRrhhReiniciarVinculacionCuenta,
  callRrhhActualizarEstadoCuentaAcceso,
} from "../../services/callables.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";

/** Valor por defecto al abrir el form (agente estándar). */
const DEFAULT_ROL_ID = "CFG_USUARIO";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

export default function AltaAgenteRRHH() {
  const { user } = useAuthSession();
  const [grupos, setGrupos] = useState(/** @type {{ id: string, nombre?: string }[]} */ ([]));
  const [roles, setRoles] = useState(/** @type {{ id: string, nombre?: string, titulo_ui?: string }[]} */ ([]));
  const [personas, setPersonas] = useState(/** @type {{ id: string, nombre?: string, apellido?: string, dni?: string }[]} */ ([]));
  const [personasConCuentaIds, setPersonasConCuentaIds] = useState(/** @type {Set<string>} */ (new Set()));
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [rolId, setRolId] = useState(DEFAULT_ROL_ID);
  const [nivel, setNivel] = useState(10);
  const [estadosCuentaAcceso, setEstadosCuentaAcceso] = useState(
    /** @type {{ id: string, nombre?: string, titulo_ui?: string }[]} */ ([]),
  );
  const [personaEstadoId, setPersonaEstadoId] = useState("");
  const [estadoAccesoId, setEstadoAccesoId] = useState("");
  const [motivoEstado, setMotivoEstado] = useState("");
  const [busyEstado, setBusyEstado] = useState(false);
  const [causalesFinAsignacion, setCausalesFinAsignacion] = useState(
    /** @type {{ id: string, nombre?: string, titulo_ui?: string }[]} */ ([]),
  );
  const [motivosBajaPersona, setMotivosBajaPersona] = useState(
    /** @type {{ id: string, nombre?: string, titulo_ui?: string }[]} */ ([]),
  );
  const [personaBajaId, setPersonaBajaId] = useState("");
  const [fechaBaja, setFechaBaja] = useState(() => new Date().toISOString().slice(0, 10));
  const [causalFinAsignacionId, setCausalFinAsignacionId] = useState("");
  const [motivoBajaId, setMotivoBajaId] = useState("");
  const [bloquearAccesoEnBaja, setBloquearAccesoEnBaja] = useState(true);
  const [motivoBajaTexto, setMotivoBajaTexto] = useState("");
  const [busyBaja, setBusyBaja] = useState(false);
  const [personaReinicioId, setPersonaReinicioId] = useState("");
  const [resetEstadoOnboarding, setResetEstadoOnboarding] = useState(false);
  const [estadoAccesoReinicioId, setEstadoAccesoReinicioId] = useState("cfg_eca_pend_reg");
  const [motivoReinicio, setMotivoReinicio] = useState("");
  const [busyReinicio, setBusyReinicio] = useState(false);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user && !OPEN_ACCESS_TEMP) {
      return;
    }
    let a = true;
    setLoad(true);
    Promise.all([
      callListarColeccion({ collectionName: "grupos_de_trabajo" }),
      callListarColeccion({ collectionName: "cfg_rol" }),
      callListarColeccion({ collectionName: "cfg_estado_cuenta_acceso" }),
      callListarColeccion({ collectionName: "cfg_causal_fin_asignacion_laboral" }),
      callListarColeccion({ collectionName: "cfg_motivo_baja_persona" }),
      callListarColeccion({ collectionName: "usuarios_cuenta" }),
      callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 200 }),
    ])
      .then(([rG, rR, rEca, rCausal, rMotivosBaja, rUsuariosCuenta, rPersonas]) => {
        if (!a) return;
        const itemsG = (rG && rG.data && rG.data.items) || [];
        setGrupos(itemsG.filter((it) => it.activo !== false));
        setGrupoId((prev) => (prev && prev.length ? prev : (itemsG[0] && itemsG[0].id) || ""));

        const itemsR = (rR && rR.data && rR.data.items) || [];
        const rOk = itemsR.filter((it) => it.activo !== false);
        setRoles(rOk);
        setRolId((prev) => {
          if (rOk.some((x) => x.id === prev)) {
            return prev;
          }
          if (rOk.some((x) => x.id === DEFAULT_ROL_ID)) {
            return DEFAULT_ROL_ID;
          }
          return (rOk[0] && rOk[0].id) || "";
        });

        const itemsEca = (rEca && rEca.data && rEca.data.items) || [];
        const ecaOk = itemsEca.filter((it) => it.activo !== false);
        setEstadosCuentaAcceso(ecaOk);
        setEstadoAccesoId((prev) => {
          if (ecaOk.some((x) => x.id === prev)) return prev;
          if (ecaOk.some((x) => x.id === "cfg_eca_bloq")) return "cfg_eca_bloq";
          return (ecaOk[0] && ecaOk[0].id) || "";
        });
        setEstadoAccesoReinicioId((prev) => {
          if (ecaOk.some((x) => x.id === prev)) return prev;
          if (ecaOk.some((x) => x.id === "cfg_eca_pend_reg")) return "cfg_eca_pend_reg";
          return (ecaOk[0] && ecaOk[0].id) || "";
        });

        const itemsCausal = (rCausal && rCausal.data && rCausal.data.items) || [];
        const causalOk = itemsCausal.filter((it) => it.activo !== false);
        setCausalesFinAsignacion(causalOk);
        setCausalFinAsignacionId((prev) => {
          if (causalOk.some((x) => x.id === prev)) return prev;
          return (causalOk[0] && causalOk[0].id) || "";
        });

        const itemsMotivosBaja = (rMotivosBaja && rMotivosBaja.data && rMotivosBaja.data.items) || [];
        const motivosOk = itemsMotivosBaja.filter((it) => it.activo !== false);
        setMotivosBajaPersona(motivosOk);
        setMotivoBajaId((prev) => {
          if (motivosOk.some((x) => x.id === prev)) return prev;
          return (motivosOk[0] && motivosOk[0].id) || "";
        });

        const itemsPersonas = (rPersonas && rPersonas.data && rPersonas.data.items) || [];
        setPersonas(itemsPersonas);
        const itemsUsuariosCuenta = (rUsuariosCuenta && rUsuariosCuenta.data && rUsuariosCuenta.data.items) || [];
        const idsConCuenta = new Set(
          itemsUsuariosCuenta
            .map((u) => String(u.persona_id || "").trim())
            .filter(Boolean),
        );
        setPersonasConCuentaIds(idsConCuenta);
        const personasConCuenta = itemsPersonas.filter((p) => idsConCuenta.has(String(p.id || "")));
        setPersonaEstadoId((prev) => (prev ? prev : (personasConCuenta[0] && personasConCuenta[0].id) || ""));
        setPersonaBajaId((prev) => (prev ? prev : (itemsPersonas[0] && itemsPersonas[0].id) || ""));
        setPersonaReinicioId((prev) => (prev ? prev : (personasConCuenta[0] && personasConCuenta[0].id) || ""));
      })
      .catch((e) => {
        if (!a) return;
        const code = (e && /** @type {{ code?: string }} */ (e).code) || "";
        if (String(code).includes("permission") || String(code).includes("PERMISSION")) {
          toast.error("Sin permiso de RRHH (revisá el claim `portal_role: rrhh`).", { duration: 6_000 });
        } else {
          toast.error("No se pudo cargar el formulario (grupos / roles).");
        }
      })
      .finally(() => {
        if (a) setLoad(false);
      });
    return () => {
      a = false;
    };
  }, [user]);

  function etiquetaRol(r) {
    if (!r) return "";
    if (typeof r.titulo_ui === "string" && r.titulo_ui) return r.titulo_ui;
    if (typeof r.nombre === "string" && r.nombre) return r.nombre;
    return r.id || "";
  }

  function etiquetaPersona(p) {
    if (!p) return "";
    const apellido = String(p.apellido || "").trim();
    const nombre = String(p.nombre || "").trim();
    const full = [apellido, nombre].filter(Boolean).join(" ").trim();
    const dni = String(p.dni || "").trim();
    if (full && dni) return `${p.id} (${full} - DNI ${dni})`;
    if (full) return `${p.id} (${full})`;
    if (dni) return `${p.id} (DNI ${dni})`;
    return p.id || "";
  }
  const personasConCuenta = personas.filter((p) => personasConCuentaIds.has(String(p.id || "")));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(dni.replace(/\D/g, ""))) {
      toast.error("DNI: 6 a 12 dígitos.");
      return;
    }
    if (!grupoId) {
      toast.error("Seleccioná un grupo de trabajo.");
      return;
    }
    if (!rolId) {
      toast.error("Seleccioná el rol de aplicación (cfg_rol).");
      return;
    }
    setBusy(true);
    const t = toast.loading("Dando de alta cáscara de agente…");
    try {
      const { data } = await callRrhhAltaAgente({
        dni: dni.replace(/\D/g, ""),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        grupo_de_trabajo_id: grupoId,
        nivel_jerarquico: Math.min(99, Math.max(1, Math.floor(nivel) || 1)),
        role_ids: [rolId],
      });
      if (data?.ok) {
        toast.success(`Creado ${data.persona_id} — ` + `Cuenta ${data.cuenta_id}`, { id: t, duration: 5_000 });
        setDni("");
        setNombre("");
        setApellido("");
        setRolId(roles.some((x) => x.id === DEFAULT_ROL_ID) ? DEFAULT_ROL_ID : rolId);
      } else {
        throw new Error();
      }
    } catch (err) {
      const msg = (err && /** @type {{ message?: string }} */ (err).message) || "Revisá DNI, roles o permisos";
      toast.error(String(msg), { id: t });
    } finally {
      setBusy(false);
    }
  }

  async function handleActualizarEstadoCuenta(e) {
    e.preventDefault();
    if (!/^per_/i.test(personaEstadoId.trim())) {
      toast.error("Ingresá un persona_id válido (per_...).");
      return;
    }
    if (!estadoAccesoId) {
      toast.error("Seleccioná un estado de acceso.");
      return;
    }
    setBusyEstado(true);
    const t = toast.loading("Actualizando estado de cuenta...");
    try {
      const { data } = await callRrhhActualizarEstadoCuentaAcceso({
        persona_id: personaEstadoId.trim(),
        estado_acceso_id: estadoAccesoId,
        motivo: motivoEstado.trim() || null,
      });
      if (data?.ok) {
        const suffix = data.unchanged ? " (sin cambios)" : "";
        toast.success(`Estado actualizado${suffix}: ${data.estado_acceso_id}`, {
          id: t,
          duration: 4500,
        });
      } else {
        throw new Error("No se pudo actualizar el estado.");
      }
    } catch (err) {
      const msg = (err && /** @type {{ message?: string }} */ (err).message) || "Error al actualizar estado.";
      toast.error(String(msg), { id: t });
    } finally {
      setBusyEstado(false);
    }
  }

  async function handleAplicarBajaLaboral(e) {
    e.preventDefault();
    if (!/^per_/i.test(personaBajaId.trim())) {
      toast.error("Ingresá un persona_id válido (per_...).");
      return;
    }
    if (!fechaBaja) {
      toast.error("Ingresá fecha de baja laboral.");
      return;
    }
    if (!causalFinAsignacionId) {
      toast.error("Seleccioná causal de fin de asignación.");
      return;
    }
    setBusyBaja(true);
    const t = toast.loading("Aplicando baja laboral...");
    try {
      const { data } = await callRrhhAplicarBajaLaboral({
        persona_id: personaBajaId.trim(),
        fecha_baja_laboral: fechaBaja,
        causal_fin_asignacion_id: causalFinAsignacionId,
        motivo_baja_id: motivoBajaId || null,
        bloquear_acceso: bloquearAccesoEnBaja,
        estado_acceso_id: estadoAccesoId || "cfg_eca_bloq",
        motivo: motivoBajaTexto.trim() || null,
      });
      if (data?.ok) {
        toast.success(
          `Baja aplicada. HLc cerrados: ${data.cantidad_hlc_cerrados}${data.estado_acceso_id ? ` | estado acceso: ${data.estado_acceso_id}` : ""}`,
          { id: t, duration: 5500 },
        );
      } else {
        throw new Error("No se pudo aplicar la baja laboral.");
      }
    } catch (err) {
      const msg = (err && /** @type {{ message?: string }} */ (err).message) || "Error al aplicar baja laboral.";
      toast.error(String(msg), { id: t });
    } finally {
      setBusyBaja(false);
    }
  }

  async function handleReiniciarVinculacion(e) {
    e.preventDefault();
    if (!/^per_/i.test(personaReinicioId.trim())) {
      toast.error("Ingresá un persona_id válido (per_...).");
      return;
    }
    setBusyReinicio(true);
    const t = toast.loading("Reiniciando vinculación de cuenta...");
    try {
      const { data } = await callRrhhReiniciarVinculacionCuenta({
        persona_id: personaReinicioId.trim(),
        reset_estado_onboarding: resetEstadoOnboarding,
        estado_acceso_id: estadoAccesoReinicioId,
        motivo: motivoReinicio.trim() || null,
      });
      if (data?.ok) {
        toast.success(
          `Vinculación reiniciada. estado_acceso=${data.estado_acceso_id}${data.auth_uid_revocado ? " | sesión revocada" : ""}`,
          { id: t, duration: 5500 },
        );
      } else {
        throw new Error("No se pudo reiniciar la vinculación.");
      }
    } catch (err) {
      const msg =
        (err && /** @type {{ message?: string }} */ (err).message) ||
        "Error al reiniciar vinculación.";
      toast.error(String(msg), { id: t });
    } finally {
      setBusyReinicio(false);
    }
  }

  if (!user && !OPEN_ACCESS_TEMP) {
    return <p className="p-6 text-sm text-slate-500">Iniciá sesión (cuenta con rol RRHH) para pre-alta.</p>;
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-3 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold">Pre-alta (RRHH)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cáscara en PENDIENTE_ONBOARDING. El <strong>rol de aplicación</strong> se guarda en
          <code className="mx-1 text-xs">usuarios_cuenta.role_ids</code> (catálogo <code className="text-xs">cfg_rol</code>).
        </p>
        {!user && OPEN_ACCESS_TEMP && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Modo temporal habilitado: acceso RRHH sin sesión (solo entorno de desarrollo).
          </p>
        )}
        <div className="mb-4 mt-4">
          <Link to="/" className="text-sm text-blue-600">
            Volver a la app
          </Link>
        </div>

        {load ? (
          <p className="text-sm text-slate-500">Cargando catálogos (grupos, roles)…</p>
        ) : (
          <>
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
                      {etiquetaRol(r)}
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
                  <p className="mt-1 text-xs text-slate-500">
                    Solo personas con `usuarios_cuenta` asociada.
                  </p>
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
                        {x.id} ({etiquetaRol(x)})
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

            <Card className="mt-4 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900">Baja laboral transaccional (RRHH)</h2>
              <p className="mt-1 text-xs text-slate-500">
                Cierra todos los HLc vigentes de la persona, marca baja en <code>personas</code> y opcionalmente bloquea acceso.
              </p>
              <form onSubmit={handleAplicarBajaLaboral} className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium">persona_id</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={personaBajaId}
                    onChange={(e) => setPersonaBajaId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar persona...</option>
                    {personasConCuenta.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPersona(p)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Solo personas con `usuarios_cuenta` asociada.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">fecha_baja_laboral</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={fechaBaja}
                    onChange={(e) => setFechaBaja(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">causal_fin_asignacion_id</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={causalFinAsignacionId}
                    onChange={(e) => setCausalFinAsignacionId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar causal...</option>
                    {causalesFinAsignacion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id} ({etiquetaRol(x)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">motivo_baja_id (persona)</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={motivoBajaId}
                    onChange={(e) => setMotivoBajaId(e.target.value)}
                  >
                    <option value="">Sin motivo específico</option>
                    {motivosBajaPersona.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id} ({etiquetaRol(x)})
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={bloquearAccesoEnBaja}
                    onChange={(e) => setBloquearAccesoEnBaja(e.target.checked)}
                  />
                  Bloquear acceso de cuenta al aplicar la baja
                </label>
                <div>
                  <label className="text-sm font-medium">Motivo operativo (opcional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={motivoBajaTexto}
                    onChange={(e) => setMotivoBajaTexto(e.target.value)}
                    placeholder="Detalle para auditoría del evento"
                  />
                </div>
                <PrimaryButton type="submit" disabled={busyBaja} className="!mt-2 w-full">
                  {busyBaja ? "Aplicando baja..." : "Aplicar baja laboral"}
                </PrimaryButton>
              </form>
            </Card>

            <Card className="mt-4 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900">
                Reinicio de vinculación e invalidación de sesión (RRHH)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Revoca sesión Auth vinculada, limpia <code>auth_uid</code>/<code>username</code> y deja la cuenta en el estado de acceso seleccionado para re-vincular por DNI.
              </p>
              <form onSubmit={handleReiniciarVinculacion} className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium">persona_id</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={personaReinicioId}
                    onChange={(e) => setPersonaReinicioId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar persona...</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPersona(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={resetEstadoOnboarding}
                    onChange={(e) => setResetEstadoOnboarding(e.target.checked)}
                  />
                  Resetear persona a estado PENDIENTE_ONBOARDING
                </label>
                <div>
                  <label className="text-sm font-medium">estado_acceso_id destino</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={estadoAccesoReinicioId}
                    onChange={(e) => setEstadoAccesoReinicioId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar estado...</option>
                    {estadosCuentaAcceso.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id} ({etiquetaRol(x)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Motivo (opcional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={motivoReinicio}
                    onChange={(e) => setMotivoReinicio(e.target.value)}
                    placeholder="Detalle operativo para auditoría"
                  />
                </div>
                <PrimaryButton type="submit" disabled={busyReinicio} className="!mt-2 w-full">
                  {busyReinicio ? "Reiniciando..." : "Reiniciar vinculación y revocar sesión"}
                </PrimaryButton>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
