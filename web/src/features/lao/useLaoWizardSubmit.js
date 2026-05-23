import { useCallback, useState } from "react";
import toast from "react-hot-toast";

import { crearSolicitudArticuloLaoBorrador } from "../../services/solicitudesArticuloV2Service.js";

/**
 * Persistencia paso 3 wizard LAO (`setDoc` + trigger backend).
 * @param {{
 *   wizardCtx: import("./laoWizardCtx.js").LaoWizardCtx | null,
 *   rangoSnapshot: { fechaDesde: string, fechaHasta: string, resumenComputo: Record<string, unknown> } | null,
 *   articuloId: string,
 *   personaId: string,
 *   actorAltaId: string,
 *   onSuccess?: (solicitudId: string) => void,
 * }} params
 */
export function useLaoWizardSubmit({
  wizardCtx,
  rangoSnapshot,
  articuloId,
  personaId,
  actorAltaId,
  onSuccess,
}) {
  const [enviando, setEnviando] = useState(false);

  const submit = useCallback(async () => {
    if (!wizardCtx || !rangoSnapshot?.resumenComputo) {
      toast.error("Faltan datos requeridos para la solicitud.");
      return null;
    }
    if (!/^per_/i.test(personaId)) {
      toast.error("Tu sesión no tiene persona vinculada.");
      return null;
    }
    if (!/^per_/i.test(actorAltaId)) {
      toast.error("No se pudo identificar al usuario que realiza el alta.");
      return null;
    }

    const dias = Number(rangoSnapshot.resumenComputo.dias_consumo);
    if (!Number.isInteger(dias) || dias < 1) {
      toast.error("El cómputo de días no es válido.");
      return null;
    }

    setEnviando(true);
    try {
      const { solicitud_id } = await crearSolicitudArticuloLaoBorrador({
        personaId,
        actorAltaId,
        articuloId: String(articuloId || "").trim(),
        versionAplicadaId: wizardCtx.version_aplicada_id,
        fechaDesde: rangoSnapshot.fechaDesde,
        fechaHasta: rangoSnapshot.fechaHasta,
        diasSolicitados: dias,
        anioOrigenBolsa: wizardCtx.anio_origen_bolsa_activo,
        resumenComputo: rangoSnapshot.resumenComputo,
      });

      toast.success(`Solicitud generada: ${solicitud_id}`);
      if (typeof onSuccess === "function") onSuccess(solicitud_id);
      return solicitud_id;
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message : "No se pudo guardar la solicitud.";
      console.error("Error al persistir borrador LAO:", e);
      toast.error(msg);
      return null;
    } finally {
      setEnviando(false);
    }
  }, [wizardCtx, rangoSnapshot, articuloId, personaId, actorAltaId, onSuccess]);

  return { submit, enviando };
}
