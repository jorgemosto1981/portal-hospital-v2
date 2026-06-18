import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { sanearMaterializacionDiaSiNecesario } from "../../services/grillaSanacionMaterializacionService.js";
import { teoriaRefsLicenciaDesdeEventos } from "./grillaTeoriaRefsDesdeEventos.js";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {{
 *   teoria_obsoleta?: boolean;
 *   desalineado_materializacion?: boolean;
 *   teoria_obsoleta_licencia?: boolean;
 *   motivo_licencia?: string | null;
 *   tooltip_licencia?: string | null;
 * }} CoherenciaTeoriaDia
 */

/**
 * Al abrir el modal: evalúa coherencia (firma + licencias) vía callable; auto-sanación solo si aplica.
 * @param {{
 *   open: boolean;
 *   personaId?: string;
 *   fechaYmd?: string;
 *   grupoTrabajoId?: string;
 *   eventos?: Array<Record<string, unknown>>;
 *   habilitar?: boolean;
 *   aplicarSiDesalineado?: boolean;
 *   onSanado?: (payload: { vis_dia?: Record<string, unknown> | null }) => void | Promise<void>;
 * }} opts
 */
export function useAutoSanacionDiaGrillaModal({
  open,
  personaId,
  fechaYmd,
  grupoTrabajoId,
  eventos = [],
  habilitar = false,
  aplicarSiDesalineado = true,
  onSanado,
}) {
  const [sincronizando, setSincronizando] = useState(false);
  const [coherencia, setCoherencia] = useState(/** @type {CoherenciaTeoriaDia | null} */ (null));
  const ultimaClave = useRef("");

  const ejecutarSanacion = useCallback(
    async (aplicar, { silencioso = false } = {}) => {
      const pid = String(personaId || "").trim();
      const gdt = String(grupoTrabajoId || "").trim();
      const ymd = String(fechaYmd || "").slice(0, 10);
      if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdt) || !YMD.test(ymd)) {
        return null;
      }
      const teoria_refs_licencia = teoriaRefsLicenciaDesdeEventos(eventos);
      const toastId = aplicar && !silencioso ? toast.loading("Sincronizando estructura de turno…") : null;
      try {
        const res = await sanearMaterializacionDiaSiNecesario({
          persona_id: pid,
          fecha: ymd,
          grupo_trabajo_id: gdt,
          aplicar_si_desalineado: aplicar,
          teoria_refs_licencia,
        });
        const coh = res?.coherencia && typeof res.coherencia === "object"
          ? res.coherencia
          : res?.vis_dia?.coherencia_teoria;
        if (coh && typeof coh === "object") {
          setCoherencia(coh);
        } else {
          setCoherencia({
            teoria_obsoleta: res?.desalineado === true,
            desalineado_materializacion: res?.desalineado === true,
            teoria_obsoleta_licencia: false,
          });
        }
        if (res?.sanado === true) {
          if (toastId) toast.success("Turno del día actualizado.", { id: toastId });
          await onSanado?.({ vis_dia: res.vis_dia ?? null });
        } else if (toastId) {
          toast.dismiss(toastId);
        }
        return res;
      } catch (e) {
        if (toastId) {
          toast.error(e?.message || "No se pudo sincronizar el turno del día.", { id: toastId });
        }
        throw e;
      }
    },
    [personaId, fechaYmd, grupoTrabajoId, eventos, onSanado],
  );

  const actualizarTeoriaAhora = useCallback(async () => {
    setSincronizando(true);
    try {
      await ejecutarSanacion(true, { silencioso: false });
    } finally {
      setSincronizando(false);
    }
  }, [ejecutarSanacion]);

  useEffect(() => {
    if (!open || !habilitar) {
      setSincronizando(false);
      if (!open) {
        ultimaClave.current = "";
        setCoherencia(null);
      }
      return;
    }
    const pid = String(personaId || "").trim();
    const gdt = String(grupoTrabajoId || "").trim();
    const ymd = String(fechaYmd || "").slice(0, 10);
    if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdt) || !YMD.test(ymd)) return;

    const refsKey = teoriaRefsLicenciaDesdeEventos(eventos).length;
    const clave = `${pid}|${gdt}|${ymd}|${refsKey}|${aplicarSiDesalineado ? "a" : "e"}`;
    if (ultimaClave.current === clave) return;
    ultimaClave.current = clave;

    let cancelled = false;
    setSincronizando(true);

    void (async () => {
      try {
        await ejecutarSanacion(aplicarSiDesalineado, { silencioso: !aplicarSiDesalineado });
      } catch {
        /* toast en ejecutarSanacion */
      } finally {
        if (!cancelled) setSincronizando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, habilitar, personaId, fechaYmd, grupoTrabajoId, eventos, aplicarSiDesalineado, ejecutarSanacion]);

  const teoriaObsoleta = coherencia?.teoria_obsoleta === true;
  const requiereActualizacionManual = teoriaObsoleta
    && (coherencia?.teoria_obsoleta_licencia === true
      || (coherencia?.desalineado_materializacion === true && !aplicarSiDesalineado));

  return {
    sincronizando,
    coherencia,
    teoriaObsoleta,
    requiereActualizacionManual,
    actualizarTeoriaAhora,
  };
}
