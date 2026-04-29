import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

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
import {
  buildActualizarEstadoPayload,
  buildAltaAgentePayload,
  buildBajaLaboralPayload,
  buildReinicioPayload,
  DEFAULT_ROL_ID,
  etiquetaCatalogo,
  etiquetaPersona,
  isValidPersonaId,
  normalizeDni,
} from "./utils.js";
import {
  AltaAgenteForm,
  BajaLaboralForm,
  EstadoCuentaForm,
  ReinicioVinculacionForm,
} from "./sections/RrhhForms.jsx";

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

  const personasConCuenta = personas.filter((p) => personasConCuentaIds.has(String(p.id || "")));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(normalizeDni(dni))) {
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
      const { data } = await callRrhhAltaAgente(
        buildAltaAgentePayload({ dni, nombre, apellido, grupoId, nivel, rolId }),
      );
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
    if (!isValidPersonaId(personaEstadoId)) {
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
      const { data } = await callRrhhActualizarEstadoCuentaAcceso(
        buildActualizarEstadoPayload({ personaEstadoId, estadoAccesoId, motivoEstado }),
      );
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
    if (!isValidPersonaId(personaBajaId)) {
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
      const { data } = await callRrhhAplicarBajaLaboral(
        buildBajaLaboralPayload({
          personaBajaId,
          fechaBaja,
          causalFinAsignacionId,
          motivoBajaId,
          bloquearAccesoEnBaja,
          estadoAccesoId,
          motivoBajaTexto,
        }),
      );
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
    if (!isValidPersonaId(personaReinicioId)) {
      toast.error("Ingresá un persona_id válido (per_...).");
      return;
    }
    setBusyReinicio(true);
    const t = toast.loading("Reiniciando vinculación de cuenta...");
    try {
      const { data } = await callRrhhReiniciarVinculacionCuenta(
        buildReinicioPayload({
          personaReinicioId,
          resetEstadoOnboarding,
          estadoAccesoReinicioId,
          motivoReinicio,
        }),
      );
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
            <AltaAgenteForm
              handleSubmit={handleSubmit}
              dni={dni}
              setDni={setDni}
              nombre={nombre}
              setNombre={setNombre}
              apellido={apellido}
              setApellido={setApellido}
              rolId={rolId}
              setRolId={setRolId}
              roles={roles}
              grupoId={grupoId}
              setGrupoId={setGrupoId}
              grupos={grupos}
              nivel={nivel}
              setNivel={setNivel}
              busy={busy}
              etiquetaCatalogo={etiquetaCatalogo}
            />

            <EstadoCuentaForm
              handleActualizarEstadoCuenta={handleActualizarEstadoCuenta}
              personaEstadoId={personaEstadoId}
              setPersonaEstadoId={setPersonaEstadoId}
              personasConCuenta={personasConCuenta}
              etiquetaPersona={etiquetaPersona}
              estadoAccesoId={estadoAccesoId}
              setEstadoAccesoId={setEstadoAccesoId}
              estadosCuentaAcceso={estadosCuentaAcceso}
              etiquetaCatalogo={etiquetaCatalogo}
              motivoEstado={motivoEstado}
              setMotivoEstado={setMotivoEstado}
              busyEstado={busyEstado}
            />

            <BajaLaboralForm
              handleAplicarBajaLaboral={handleAplicarBajaLaboral}
              personaBajaId={personaBajaId}
              setPersonaBajaId={setPersonaBajaId}
              personasConCuenta={personasConCuenta}
              etiquetaPersona={etiquetaPersona}
              fechaBaja={fechaBaja}
              setFechaBaja={setFechaBaja}
              causalFinAsignacionId={causalFinAsignacionId}
              setCausalFinAsignacionId={setCausalFinAsignacionId}
              causalesFinAsignacion={causalesFinAsignacion}
              motivoBajaId={motivoBajaId}
              setMotivoBajaId={setMotivoBajaId}
              motivosBajaPersona={motivosBajaPersona}
              etiquetaCatalogo={etiquetaCatalogo}
              bloquearAccesoEnBaja={bloquearAccesoEnBaja}
              setBloquearAccesoEnBaja={setBloquearAccesoEnBaja}
              motivoBajaTexto={motivoBajaTexto}
              setMotivoBajaTexto={setMotivoBajaTexto}
              busyBaja={busyBaja}
            />

            <ReinicioVinculacionForm
              handleReiniciarVinculacion={handleReiniciarVinculacion}
              personaReinicioId={personaReinicioId}
              setPersonaReinicioId={setPersonaReinicioId}
              personas={personas}
              etiquetaPersona={etiquetaPersona}
              resetEstadoOnboarding={resetEstadoOnboarding}
              setResetEstadoOnboarding={setResetEstadoOnboarding}
              estadoAccesoReinicioId={estadoAccesoReinicioId}
              setEstadoAccesoReinicioId={setEstadoAccesoReinicioId}
              estadosCuentaAcceso={estadosCuentaAcceso}
              etiquetaCatalogo={etiquetaCatalogo}
              motivoReinicio={motivoReinicio}
              setMotivoReinicio={setMotivoReinicio}
              busyReinicio={busyReinicio}
            />
          </>
        )}
      </div>
    </div>
  );
}
