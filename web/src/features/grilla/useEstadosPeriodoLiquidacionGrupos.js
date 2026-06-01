import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { callConsultarEstadosPeriodoLiquidacionGrupo } from "../../services/callables.js";

function parsePeriodo(periodo) {
  const [yyyy, mm] = String(periodo || "").split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

export function claveEstadoPeriodo(periodo, grupoId) {
  return `${periodo}::${String(grupoId || "").trim()}`;
}

/**
 * @param {{ periodos: string[]; grupos: Array<{ id: string }>; habilitado?: boolean }} params
 */
export function useEstadosPeriodoLiquidacionGrupos({ periodos, grupos, habilitado = true }) {
  const [mapa, setMapa] = useState(
    /** @type {Record<string, { cerrado: boolean; sinDotacion: boolean }>} */ ({}),
  );
  const [cargando, setCargando] = useState(false);
  const avisoErrorRef = useRef(false);

  const itemsKey = useMemo(() => {
    const ps = Array.isArray(periodos) ? periodos : [];
    const gs = Array.isArray(grupos) ? grupos : [];
    const parts = [];
    for (const p of ps) {
      const ref = parsePeriodo(p);
      if (!ref) continue;
      for (const g of gs) {
        const id = String(g.id || "").trim();
        if (/^gdt_/i.test(id)) parts.push(`${p}|${id}`);
      }
    }
    return parts.sort().join(",");
  }, [periodos, grupos]);

  const recargar = useCallback(async () => {
    if (!habilitado || !itemsKey) {
      setMapa({});
      return;
    }
    const items = itemsKey.split(",").filter(Boolean).map((part) => {
      const sep = part.indexOf("|");
      const periodo = sep >= 0 ? part.slice(0, sep) : "";
      const grupo_trabajo_id = sep >= 0 ? part.slice(sep + 1) : "";
      const ref = parsePeriodo(periodo);
      return ref
        ? { grupo_trabajo_id, anio: ref.anio, mes: ref.mes }
        : null;
    }).filter(Boolean);
    if (items.length === 0) {
      setMapa({});
      return;
    }
    setCargando(true);
    try {
      const res = await callConsultarEstadosPeriodoLiquidacionGrupo({ items });
      const rows = Array.isArray(res?.data?.items) ? res.data.items : [];
      const next = {};
      for (const row of rows) {
        const gdt = String(row.grupo_trabajo_id || "").trim();
        const y = Number(row.anio);
        const m = Number(row.mes);
        if (!gdt || !Number.isFinite(y) || !Number.isFinite(m)) continue;
        const periodo = `${y}-${String(m).padStart(2, "0")}`;
        const pv = Number(row.personas_vigentes);
        const personasVigentes = Number.isFinite(pv) ? pv : null;
        next[claveEstadoPeriodo(periodo, gdt)] = {
          cerrado: row.cerrado === true,
          sinDotacion: personasVigentes === 0,
        };
      }
      setMapa(next);
      avisoErrorRef.current = false;
    } catch (e) {
      setMapa({});
      if (!avisoErrorRef.current) {
        avisoErrorRef.current = true;
        toast.error(e?.message || "No se pudo consultar el estado de liquidación de los grupos.");
      }
    } finally {
      setCargando(false);
    }
  }, [habilitado, itemsKey]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const estaCerrado = useCallback(
    (periodo, grupoId) => mapa[claveEstadoPeriodo(periodo, grupoId)]?.cerrado === true,
    [mapa],
  );

  const estaSinDotacion = useCallback(
    (periodo, grupoId) => mapa[claveEstadoPeriodo(periodo, grupoId)]?.sinDotacion === true,
    [mapa],
  );

  return { mapa, cargando, recargar, estaCerrado, estaSinDotacion };
}
