import { useCallback, useEffect, useState } from "react";

import { normalizarFilasGrillaEquipo } from "../../grilla/grillaMesFilasUtils.js";
import {
  callListarRosterParaFichadas,
  callListarVistaGrillaMesPorGrupo,
} from "../../../services/callables.js";

const CACHE_PREFIX = "roster_fichadas_";

function rosterDesdeFilasGrilla(filas) {
  const map = new Map();
  for (const f of filas) {
    const pid = String(f.persona_id || "").trim();
    if (!pid || map.has(pid)) continue;
    const nombre = [f.apellido, f.nombre].filter(Boolean).join(", ");
    const label = nombre || f.persona_label || f.persona_nombre || f.agente_nombre || pid;
    const gdt = String(f.grupo_trabajo_id || f.grupo_de_trabajo_id || "").trim();
    map.set(pid, {
      persona_id: pid,
      label: String(label),
      dni: f.dni ? String(f.dni) : "",
      grupo_trabajo_id: /^gdt_/i.test(gdt) ? gdt : "",
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/**
 * Roster para carga manual: sector (grilla del mes) o global en caché de sesión (reloj universal).
 *
 * @param {{ relojId: string; grupoTrabajoId: string; fechaYmd: string }} opts
 */
export function useCargaManualRoster({ relojId, grupoTrabajoId, fechaYmd }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modoSector = /^gdt_/i.test(grupoTrabajoId);
  const modoGlobal = Boolean(relojId) && !modoSector;

  const cargar = useCallback(async () => {
    setError("");
    if (!modoSector && !modoGlobal) {
      setRoster([]);
      return;
    }

    const fechaRef = /^\d{4}-\d{2}-\d{2}$/.test(fechaYmd) ? fechaYmd : "";

    if (modoSector) {
      if (!fechaRef) {
        setLoading(true);
        try {
          const res = await callListarRosterParaFichadas({
            grupo_trabajo_id: grupoTrabajoId,
            reloj_id: relojId,
          });
          const agentes = (res.data?.agentes || []).map((a) => ({
            persona_id: a.persona_id,
            label: a.label,
            dni: a.dni || "",
            grupo_trabajo_id: a.grupo_trabajo_id || "",
          }));
          setRoster(agentes);
        } catch (e) {
          setError(e?.message || "No se pudo cargar el roster del sector.");
          setRoster([]);
        } finally {
          setLoading(false);
        }
        return;
      }
      const [y, m] = fechaRef.split("-").map(Number);
      const cacheKey = `${CACHE_PREFIX}${grupoTrabajoId}_${y}-${String(m).padStart(2, "0")}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setRoster(JSON.parse(cached));
          return;
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
      setLoading(true);
      try {
        const res = await callListarVistaGrillaMesPorGrupo({
          grupo_trabajo_id: grupoTrabajoId,
          anio: y,
          mes: m,
        });
        const filas = normalizarFilasGrillaEquipo(res.data?.filas || res.data?.items || []);
        const agentes = rosterDesdeFilasGrilla(filas);
        sessionStorage.setItem(cacheKey, JSON.stringify(agentes));
        setRoster(agentes);
      } catch (e) {
        setError(e?.message || "No se pudo cargar el roster del grupo.");
        setRoster([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    const cacheKey = `${CACHE_PREFIX}GLOBAL_${relojId}_${fechaRef || "hoy"}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setRoster(JSON.parse(cached));
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    setLoading(true);
    try {
      const res = await callListarRosterParaFichadas({
        grupo_trabajo_id: "GLOBAL",
        reloj_id: relojId,
        ...(fechaRef ? { fecha_ymd: fechaRef } : {}),
      });
      const agentes = (res.data?.agentes || []).map((a) => ({
        persona_id: a.persona_id,
        label: a.label,
        dni: a.dni || "",
        grupo_trabajo_id: a.grupo_trabajo_id || "",
      }));
      sessionStorage.setItem(cacheKey, JSON.stringify(agentes));
      setRoster(agentes);
    } catch (e) {
      setError(e?.message || "No se pudo cargar el roster global.");
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [modoSector, modoGlobal, grupoTrabajoId, fechaYmd, relojId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    roster,
    loading,
    error,
    modoGlobal,
    modoSector,
    recargar: cargar,
  };
}
