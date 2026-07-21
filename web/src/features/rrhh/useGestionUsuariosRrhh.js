import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  callListarColeccion,
  callListarColeccionPublicaTemporal,
  callRrhhActualizarEstadoCuentaAcceso,
  callRrhhAplicarBajaLaboral,
  callRrhhReiniciarVinculacionCuenta,
} from "../../services/callables.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";
import {
  buildActualizarEstadoPayload,
  buildBajaLaboralPayload,
  buildReinicioPayload,
  isValidPersonaId,
} from "./utils.js";

const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

/** Estado y acciones de gestión de cuenta (acceso / baja / reinicio). */
export function useGestionUsuariosRrhh() {
  const { user } = useAuthSession();
  const [personas, setPersonas] = useState(/** @type {{ id: string, nombre?: string, apellido?: string, dni?: string }[]} */ ([]));
  const [personasConCuentaIds, setPersonasConCuentaIds] = useState(/** @type {Set<string>} */ (new Set()));
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

  useEffect(() => {
    if (!user && !OPEN_ACCESS_TEMP) return;
    let alive = true;
    setLoad(true);
    Promise.all([
      callListarColeccion({ collectionName: "cfg_estado_cuenta_acceso" }),
      callListarColeccion({ collectionName: "cfg_causal_fin_asignacion_laboral" }),
      callListarColeccion({ collectionName: "cfg_motivo_baja_persona" }),
      callListarColeccion({ collectionName: "usuarios_cuenta" }),
      callListarColeccionPublicaTemporal({ collectionName: "personas", pageSize: 200 }),
    ])
      .then(([rEca, rCausal, rMotivosBaja, rUsuariosCuenta, rPersonas]) => {
        if (!alive) return;
        const ecaOk = ((rEca?.data?.items) || []).filter((it) => it.activo !== false);
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
        const causalOk = ((rCausal?.data?.items) || []).filter((it) => it.activo !== false);
        setCausalesFinAsignacion(causalOk);
        setCausalFinAsignacionId((prev) => (causalOk.some((x) => x.id === prev) ? prev : (causalOk[0]?.id || "")));
        const motivosOk = ((rMotivosBaja?.data?.items) || []).filter((it) => it.activo !== false);
        setMotivosBajaPersona(motivosOk);
        setMotivoBajaId((prev) => (motivosOk.some((x) => x.id === prev) ? prev : (motivosOk[0]?.id || "")));
        const itemsPersonas = (rPersonas?.data?.items) || [];
        setPersonas(itemsPersonas);
        const idsConCuenta = new Set(
          ((rUsuariosCuenta?.data?.items) || [])
            .map((u) => String(u.persona_id || "").trim())
            .filter(Boolean),
        );
        setPersonasConCuentaIds(idsConCuenta);
        const personasConCuenta = itemsPersonas.filter((p) => idsConCuenta.has(String(p.id || "")));
        setPersonaEstadoId((prev) => prev || personasConCuenta[0]?.id || "");
        setPersonaBajaId((prev) => prev || personasConCuenta[0]?.id || "");
        setPersonaReinicioId((prev) => prev || personasConCuenta[0]?.id || "");
      })
      .catch((e) => {
        if (!alive) return;
        const code = (e && /** @type {{ code?: string }} */ (e).code) || "";
        if (String(code).includes("permission") || String(code).includes("PERMISSION")) {
          toast.error("Sin permiso de RRHH para gestión de usuarios.", { duration: 8_000 });
        } else {
          toast.error("No se pudo cargar catálogos de gestión.");
        }
      })
      .finally(() => {
        if (alive) setLoad(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const personasConCuenta = personas.filter((p) => personasConCuentaIds.has(String(p.id || "")));

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
      if (!data?.ok) throw new Error("No se pudo actualizar el estado.");
      toast.success(`Estado actualizado${data.unchanged ? " (sin cambios)" : ""}: ${data.estado_acceso_id}`, {
        id: t,
        duration: 4500,
      });
    } catch (err) {
      toast.error(String((err && /** @type {{ message?: string }} */ (err).message) || "Error al actualizar estado."), {
        id: t,
      });
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
      if (!data?.ok) throw new Error("No se pudo aplicar la baja laboral.");
      toast.success(
        `Baja aplicada. HLc cerrados: ${data.cantidad_hlc_cerrados}${data.estado_acceso_id ? ` | estado acceso: ${data.estado_acceso_id}` : ""}`,
        { id: t, duration: 5500 },
      );
    } catch (err) {
      toast.error(
        String((err && /** @type {{ message?: string }} */ (err).message) || "Error al aplicar baja laboral."),
        { id: t },
      );
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
      if (!data?.ok) throw new Error("No se pudo reiniciar la vinculación.");
      toast.success(
        `Vinculación reiniciada. estado_acceso=${data.estado_acceso_id}${data.auth_uid_revocado ? " | sesión revocada" : ""}`,
        { id: t, duration: 5500 },
      );
    } catch (err) {
      toast.error(
        String((err && /** @type {{ message?: string }} */ (err).message) || "Error al reiniciar vinculación."),
        { id: t },
      );
    } finally {
      setBusyReinicio(false);
    }
  }

  return {
    user,
    openAccessTemp: OPEN_ACCESS_TEMP,
    load,
    personas,
    personasConCuenta,
    estadosCuentaAcceso,
    personaEstadoId,
    setPersonaEstadoId,
    estadoAccesoId,
    setEstadoAccesoId,
    motivoEstado,
    setMotivoEstado,
    busyEstado,
    handleActualizarEstadoCuenta,
    causalesFinAsignacion,
    motivosBajaPersona,
    personaBajaId,
    setPersonaBajaId,
    fechaBaja,
    setFechaBaja,
    causalFinAsignacionId,
    setCausalFinAsignacionId,
    motivoBajaId,
    setMotivoBajaId,
    bloquearAccesoEnBaja,
    setBloquearAccesoEnBaja,
    motivoBajaTexto,
    setMotivoBajaTexto,
    busyBaja,
    handleAplicarBajaLaboral,
    personaReinicioId,
    setPersonaReinicioId,
    resetEstadoOnboarding,
    setResetEstadoOnboarding,
    estadoAccesoReinicioId,
    setEstadoAccesoReinicioId,
    motivoReinicio,
    setMotivoReinicio,
    busyReinicio,
    handleReiniciarVinculacion,
  };
}
