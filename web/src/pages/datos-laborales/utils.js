import {
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
  obtenerYmdHoyInstitucional,
  vigenteEnFechaInclusivaYmd,
  ymdDesdeValorLaboral,
} from "../../../../shared/utils/fechaLaboralYmd.js";

export function formatValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{...}";
  if (typeof v === "string") {
    const formattedDate = formatDateDdMmAaaa(v, null);
    if (formattedDate) return formattedDate;
  }
  return String(v);
}

export function derivarCargaSemanalDesdeRegimen(regimenDoc) {
  if (!regimenDoc || typeof regimenDoc !== "object") return null;
  const tipo = regimenDoc.tipo_patron;
  if (tipo === "fijo") {
    const dias = regimenDoc.dias;
    if (!Array.isArray(dias)) return null;
    return dias.reduce((acc, d) => {
      const h = d && d.turno && typeof d.turno.horas_efectivas === "number" ? d.turno.horas_efectivas : 0;
      return acc + h;
    }, 0);
  }
  if (tipo === "rotativo") {
    const ciclo = regimenDoc.ciclo;
    if (!Array.isArray(ciclo) || ciclo.length === 0) return null;
    const sumaCiclo = ciclo.reduce((acc, pos) => {
      const h = pos && pos.turno && typeof pos.turno.horas_efectivas === "number" ? pos.turno.horas_efectivas : 0;
      return acc + h;
    }, 0);
    return (sumaCiclo / ciclo.length) * 7;
  }
  if (tipo === "planificado") {
    const v = regimenDoc.carga_horaria_semanal_teorica;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return null;
}

export function isoToDateInput(iso) {
  return ymdDesdeValorLaboral(iso);
}

export function formatDateDdMmAaaa(value, fallback = "—") {
  const iso = toDateKey(value);
  if (!iso) return fallback;
  const [yyyy, mm, dd] = iso.split("-");
  if (!yyyy || !mm || !dd) return fallback;
  return `${dd}/${mm}/${yyyy}`;
}

export function takeFirst(items, max = 5) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

export function updateFormDataField(prev, key, value) {
  if (key === "fecha_desde") {
    const nextDesde = String(value || "");
    const nextHasta = prev.fecha_hasta && nextDesde && prev.fecha_hasta < nextDesde ? "" : prev.fecha_hasta;
    return { ...prev, fecha_desde: nextDesde, fecha_hasta: nextHasta };
  }
  if (key === "fecha_hasta") {
    const nextHasta = String(value || "");
    if (nextHasta && prev.fecha_desde && nextHasta < prev.fecha_desde) {
      return { ...prev, fecha_hasta: "" };
    }
    return { ...prev, fecha_hasta: nextHasta };
  }
  return { ...prev, [key]: value };
}

export function normalizarWarnings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const code = typeof w.code === "string" ? w.code.trim() : "";
      const message = typeof w.message === "string" ? w.message.trim() : "";
      if (!code && !message) return null;
      return { code, message };
    })
    .filter(Boolean);
}

export function crearIndicePorId(rows) {
  const idx = new Map();
  (rows || []).forEach((row) => {
    if (row && row.id) idx.set(String(row.id), row);
  });
  return idx;
}

export function labelDesdeIndice(idx, id, campo = "nombre") {
  if (!id) return "—";
  const row = idx.get(String(id));
  if (!row) return String(id);
  return row[campo] ? String(row[campo]) : String(id);
}

function labelIdNombre(idx, id, campo = "nombre") {
  const rawId = String(id || "").trim();
  if (!rawId) return "—";
  const row = idx && idx.get ? idx.get(rawId) : null;
  if (!row) return rawId;
  const nombre = row[campo] ? String(row[campo]).trim() : "";
  return nombre ? `${rawId} (${nombre})` : rawId;
}

function personaIdNombre(idxPersonas, personaId) {
  const rawId = String(personaId || "").trim();
  if (!rawId) return "—";
  const row = idxPersonas && idxPersonas.get ? idxPersonas.get(rawId) : null;
  if (!row) return rawId;
  const apellido = String(row.apellido || "").trim();
  const nombre = String(row.nombre || "").trim();
  const etiqueta = [apellido, nombre].filter(Boolean).join(" ").trim();
  return etiqueta ? `${rawId} (${etiqueta})` : rawId;
}

function toDateKey(value) {
  return ymdDesdeValorLaboral(value);
}

/** Vigencia inclusiva [desde, hasta] respecto a hoy institucional (BA). */
export {
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
  obtenerYmdHoyInstitucional,
  vigenteEnFechaInclusivaYmd,
  ymdDesdeValorLaboral,
};

/** Documento laboral no dado de baja administrativa (`activo !== false`). */
export function registroLaboralActivo(row) {
  if (!row || typeof row !== "object") return true;
  const a = row.activo;
  if (a === false || a === "false" || a === 0) return false;
  return true;
}

export function registroLaboralVigenteEnHoy(row, tipo) {
  if (!row || typeof row !== "object") return false;
  if (!registroLaboralActivo(row)) return false;
  const ref = obtenerYmdHoyInstitucional();
  if (tipo === "hlc") {
    return vigenteEnFechaInclusivaYmd(hlcFechaDesdeYmd(row), hlcFechaHastaYmd(row) || null, ref);
  }
  return vigenteEnFechaInclusivaYmd(hldHlgFechaInicioYmd(row), hldHlgFechaFinYmd(row) || null, ref);
}

/** HLg/HLd dados de baja administrativa (no operativos en UI). */
export function isHlgAsignacionDeshabilitada(row) {
  return !registroLaboralActivo(row);
}

/** HLg que se muestran en pantalla (excluye `activo: false`). */
export function hlgVisibleEnPantalla(row) {
  return registroLaboralActivo(row);
}

/** Vigencia del dato laboral (HLD) para la ficha — distinta del período de cargo (HLc) y del grupo (HLg). */
export function formatVigenciaHldPantalla(hldRow) {
  if (!hldRow || typeof hldRow !== "object") return null;
  const desdeYmd = hldHlgFechaInicioYmd(hldRow);
  if (!desdeYmd) return null;
  const hastaYmd = hldHlgFechaFinYmd(hldRow);
  const desde = formatDateDdMmAaaa(desdeYmd, "—");
  if (hastaYmd) {
    return `Desde ${desde} · Hasta ${formatDateDdMmAaaa(hastaYmd, "—")}`;
  }
  return `Desde ${desde} · Vigente`;
}

export function isHlgOHldVigenteEnHoy(row) {
  return registroLaboralVigenteEnHoy(row, "hlg");
}

export function isHlcOperativo(row) {
  if (!row || typeof row !== "object") return false;
  if (row.activo === false) return false;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return false;
  return registroLaboralVigenteEnHoy(row, "hlc");
}

export function isHlcHistoricoVisible(row) {
  if (!row || typeof row !== "object") return false;
  if (row.activo === false) return false;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return false;
  const hasta = hlcFechaHastaYmd(row);
  if (!hasta) return false;
  return !registroLaboralVigenteEnHoy(row, "hlc");
}

function compareIsoDesc(a, b) {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function estadoDesdeFechas(desde, hasta) {
  const nowIso = obtenerYmdHoyInstitucional();
  if (!desde) return "desconocido";
  if (hasta && hasta < nowIso) return "cerrado";
  if (desde > nowIso) return "pendiente";
  return "activo";
}

export function cargaSemanalDesdeHlg(hlgRow, idxRegimenes) {
  const regId = String(hlgRow.regimen_horario_id || "").trim();
  if (!regId || !idxRegimenes) return null;
  return derivarCargaSemanalDesdeRegimen(idxRegimenes.get(regId));
}

function rangoSolapadoInclusivo(desdeA, hastaA, desdeB, hastaB) {
  if (!desdeA || !desdeB) return false;
  const finA = hastaA || "9999-12-31";
  const finB = hastaB || "9999-12-31";
  return desdeA <= finB && desdeB <= finA;
}

export function buildTimelineItemsByPersona({
  personaId,
  hlcRows,
  hldRows,
  hlgRows,
  idxHlc,
  idxHld,
  idxGrupos,
  idxEfectores,
  idxPersonas,
  idxRoles,
  idxFunciones,
  idxRegimenes,
}) {
  const persona = String(personaId || "").trim();
  const includeAllPersonas = !persona;
  const items = [];
  const epsilon = 0.01;
  const cargoTotalHlg = new Map();

  (hlgRows || []).forEach((row) => {
    if (!hlgVisibleEnPantalla(row)) return;
    const rowPersona = String(row.persona_id || "");
    if (!includeAllPersonas && rowPersona !== persona) return;
    const dato = idxHld.get(String(row.dato_laboral_id || ""));
    const cargoId = String((dato && dato.cargo_id) || "");
    if (!cargoId) return;
    const prev = cargoTotalHlg.get(cargoId) || 0;
    const h = cargaSemanalDesdeHlg(row, idxRegimenes);
    cargoTotalHlg.set(cargoId, prev + (h != null ? h : 0));
  });

  (hlcRows || [])
    .filter((row) => includeAllPersonas || String(row.persona_id || "") === persona)
    .forEach((row) => {
      const desde = hlcFechaDesdeYmd(row);
      const hasta = hlcFechaHastaYmd(row);
      const conflictos = [];
      const warningCodes = [];
      if (row.grupo_de_trabajo_id && !idxGrupos.get(String(row.grupo_de_trabajo_id))) {
        conflictos.push("HLc con grupo_de_trabajo_id sin referencia.");
      }
      if (row.efector_designacion_id && !idxEfectores.get(String(row.efector_designacion_id))) {
        conflictos.push("HLc con efector_designacion_id sin referencia.");
      }
      if (row.efector_cumplimiento_id && !idxEfectores.get(String(row.efector_cumplimiento_id))) {
        conflictos.push("HLc con efector_cumplimiento_id sin referencia.");
      }
      const esperado = Number(row.carga_horaria_total);
      const totalHlg = Number(cargoTotalHlg.get(String(row.id || "")) || 0);
      if (Number.isFinite(esperado) && Math.abs(totalHlg - esperado) > epsilon) {
        conflictos.push(
          `Desvío carga normativa/operativa: HLg=${totalHlg} vs HLc=${esperado} (informativo).`,
        );
        warningCodes.push("DESVIO_CARGA_NORMATIVA");
      }
      items.push({
        id: String(row.id || ""),
        tipo: "HLc",
        persona_id: persona,
        grupo_de_trabajo_id: String(row.grupo_de_trabajo_id || ""),
        estado_asignacion_id: String(row.estado_asignacion_id || ""),
        nivel_jerarquico: null,
        desde,
        hasta,
        estado: estadoDesdeFechas(desde, hasta),
        principal: `Cargo ${row.id || ""}`,
        secundario:
          `Persona: ${personaIdNombre(idxPersonas, row.persona_id)} · ` +
          `Grupo: ${labelIdNombre(idxGrupos, row.grupo_de_trabajo_id)} · ` +
          `Efectores: ${labelIdNombre(idxEfectores, row.efector_designacion_id)} / ${labelIdNombre(idxEfectores, row.efector_cumplimiento_id)}`,
        conflictos,
        warning_codes: warningCodes,
      });
    });

  (hldRows || [])
    .filter((row) => includeAllPersonas || String(row.persona_id || "") === persona)
    .forEach((row) => {
      const desde = hldHlgFechaInicioYmd(row);
      const hasta = hldHlgFechaFinYmd(row);
      const cargo = idxHlc.get(String(row.cargo_id || ""));
      const conflictos = [];
      const warningCodes = [];
      if (!cargo) conflictos.push("HLd con cargo_id inexistente.");
      if (cargo && String(cargo.persona_id || "") !== persona) {
        conflictos.push("HLd con persona_id distinto al cargo referenciado.");
      }
      const esperado = Number(cargo && cargo.carga_horaria_total);
      const totalHlg = Number(cargoTotalHlg.get(String((cargo && cargo.id) || "")) || 0);
      if (cargo && Number.isFinite(esperado) && Math.abs(totalHlg - esperado) > epsilon) {
        conflictos.push(
          `Desvío carga normativa/operativa del cargo: HLg=${totalHlg} vs HLc=${esperado} (informativo).`,
        );
        warningCodes.push("DESVIO_CARGA_NORMATIVA");
      }
      items.push({
        id: String(row.id || ""),
        tipo: "HLd",
        persona_id: persona,
        grupo_de_trabajo_id: cargo ? String(cargo.grupo_de_trabajo_id || "") : "",
        estado_asignacion_id: cargo ? String(cargo.estado_asignacion_id || "") : "",
        nivel_jerarquico:
          row.nivel_jerarquico == null || Number.isNaN(Number(row.nivel_jerarquico))
            ? null
            : Number(row.nivel_jerarquico),
        desde,
        hasta,
        estado: estadoDesdeFechas(desde, hasta),
        principal: `Dato laboral ${row.id || ""}`,
        secundario:
          `Persona: ${personaIdNombre(idxPersonas, row.persona_id)} · ` +
          `Cargo: ${row.cargo_id || "—"} · ` +
          `Rol: ${labelIdNombre(idxRoles, cargo && cargo.rol_id)} · ` +
          `Funcion: ${labelIdNombre(idxFunciones, row.funcion_real_id)}`,
        conflictos,
        warning_codes: warningCodes,
      });
    });

  (hlgRows || [])
    .filter((row) => hlgVisibleEnPantalla(row))
    .filter((row) => includeAllPersonas || String(row.persona_id || "") === persona)
    .forEach((row) => {
      const desde = hldHlgFechaInicioYmd(row);
      const hasta = hldHlgFechaFinYmd(row);
      const dato = idxHld.get(String(row.dato_laboral_id || ""));
      const conflictos = [];
      const warningCodes = [];
      if (!dato) conflictos.push("HLg con dato_laboral_id inexistente.");
      if (dato && String(dato.persona_id || "") !== persona) {
        conflictos.push("HLg con persona_id distinto al dato laboral referenciado.");
      }
      if (row.grupo_de_trabajo_id && !idxGrupos.get(String(row.grupo_de_trabajo_id))) {
        conflictos.push("HLg con grupo_de_trabajo_id sin referencia.");
      }
      const cargo = dato ? idxHlc.get(String(dato.cargo_id || "")) : null;
      const cargoId = String((cargo && cargo.id) || "");
      const grupoId = String(row.grupo_de_trabajo_id || "");
      const rowDesde = hldHlgFechaInicioYmd(row);
      const rowHasta = hldHlgFechaFinYmd(row);
      const solape = (hlgRows || []).find((other) => {
        if (String(other.id || "") === String(row.id || "")) return false;
        const otherDato = idxHld.get(String(other.dato_laboral_id || ""));
        const otherCargoId = String((otherDato && otherDato.cargo_id) || "");
        if (!cargoId || !otherCargoId || otherCargoId !== cargoId) return false;
        if (String(other.grupo_de_trabajo_id || "") !== grupoId) return false;
        const otherDesde = hldHlgFechaInicioYmd(other);
        const otherHasta = hldHlgFechaFinYmd(other);
        return rangoSolapadoInclusivo(rowDesde, rowHasta, otherDesde, otherHasta);
      });
      if (solape) {
        conflictos.push(
          `Solape operativo en mismo cargo+grupo detectado (conflicto con ${String(solape.id || "—")}).`,
        );
        warningCodes.push("SOLAPE_CARGO_GRUPO");
      }
      const esperado = Number(cargo && cargo.carga_horaria_total);
      const totalHlg = Number(cargoTotalHlg.get(cargoId) || 0);
      if (cargo && Number.isFinite(esperado) && Math.abs(totalHlg - esperado) > epsilon) {
        conflictos.push(
          `Desvío carga normativa/operativa del cargo: HLg=${totalHlg} vs HLc=${esperado} (informativo).`,
        );
        warningCodes.push("DESVIO_CARGA_NORMATIVA");
      }
      items.push({
        id: String(row.id || ""),
        tipo: "HLg",
        persona_id: persona,
        grupo_de_trabajo_id: String(row.grupo_de_trabajo_id || ""),
        estado_asignacion_id: cargo
          ? String(cargo.estado_asignacion_id || "")
          : "",
        nivel_jerarquico:
          row.nivel_jerarquico == null || Number.isNaN(Number(row.nivel_jerarquico))
            ? null
            : Number(row.nivel_jerarquico),
        desde,
        hasta,
        estado: estadoDesdeFechas(desde, hasta),
        principal: `Grupo laboral ${row.id || ""}`,
        secundario:
          `Persona: ${personaIdNombre(idxPersonas, row.persona_id)} · ` +
          `Grupo: ${labelIdNombre(idxGrupos, row.grupo_de_trabajo_id)} · ` +
          `Nivel: ${row.nivel_jerarquico || "—"} · Dato: ${row.dato_laboral_id || "—"}`,
        conflictos,
        warning_codes: warningCodes,
      });
    });

  return items.sort((a, b) => compareIsoDesc(a.desde, b.desde));
}

export function filterTimelineItems(items, { filtro, fecha }) {
  const list = Array.isArray(items) ? items : [];
  const fechaIso = fecha ? toDateKey(fecha) : obtenerYmdHoyInstitucional();
  if (!filtro || filtro === "todos") return list;
  if (filtro === "activos") return list.filter((item) => item.estado === "activo");
  if (filtro === "no_activos") return list.filter((item) => item.estado !== "activo");
  if (filtro === "cerrados") return list.filter((item) => !!item.hasta);
  if (filtro === "conflicto") return list.filter((item) => (item.conflictos || []).length > 0);
  if (filtro === "vigentes") {
    return list.filter((item) => {
      if (!item.desde) return false;
      if (item.desde > fechaIso) return false;
      if (item.hasta && item.hasta < fechaIso) return false;
      return true;
    });
  }
  if (filtro === "no_vigentes") {
    return list.filter((item) => {
      if (!item.desde) return true;
      if (item.desde > fechaIso) return true;
      if (item.hasta && item.hasta < fechaIso) return true;
      return false;
    });
  }
  return list;
}

export function filterTimelineItemsAdvanced(items, filters) {
  const list = filterTimelineItems(items, {
    filtro: filters && filters.filtro,
    fecha: filters && filters.fecha,
  });
  const tipo = String((filters && filters.tipo) || "todos");
  const grupoId = String((filters && filters.grupoId) || "");
  const estadoAsignacionId = String((filters && filters.estadoAsignacionId) || "");
  const nivelMinRaw = filters && filters.nivelMin;
  const nivelMaxRaw = filters && filters.nivelMax;
  const onlySinReferencias = !!(filters && filters.onlySinReferencias);
  const onlySolape = !!(filters && filters.onlySolape);
  const warningTipo = String((filters && filters.warningTipo) || "todos");
  const nivelMin = Number.isFinite(Number(nivelMinRaw)) ? Number(nivelMinRaw) : null;
  const nivelMax = Number.isFinite(Number(nivelMaxRaw)) ? Number(nivelMaxRaw) : null;

  return list.filter((item) => {
    if (tipo !== "todos" && item.tipo !== tipo) return false;
    if (grupoId && String(item.grupo_de_trabajo_id || "") !== grupoId) return false;
    if (estadoAsignacionId && String(item.estado_asignacion_id || "") !== estadoAsignacionId) return false;
    if (nivelMin != null && (item.nivel_jerarquico == null || Number(item.nivel_jerarquico) < nivelMin)) {
      return false;
    }
    if (nivelMax != null && (item.nivel_jerarquico == null || Number(item.nivel_jerarquico) > nivelMax)) {
      return false;
    }
    if (onlySinReferencias) {
      const refs = (item.conflictos || []).join(" ").toLowerCase();
      const hasReferenciasRota =
        refs.includes("sin referencia") ||
        refs.includes("inexistente") ||
        refs.includes("no encontrado");
      if (!hasReferenciasRota) return false;
    }
    if (onlySolape) {
      const codes = Array.isArray(item.warning_codes) ? item.warning_codes : [];
      const refs = (item.conflictos || []).join(" ").toLowerCase();
      if (!codes.includes("SOLAPE_CARGO_GRUPO") && !refs.includes("solape")) return false;
    }
    if (warningTipo !== "todos") {
      const codes = Array.isArray(item.warning_codes) ? item.warning_codes : [];
      if (!codes.includes(warningTipo)) return false;
    }
    return true;
  });
}

export function buildVistaGrupoItems({
  grupoId,
  fechaCorte,
  hlgRows,
  idxPersonas,
  idxHld,
  idxHlc,
  idxRegimenes,
}) {
  const targetGrupo = String(grupoId || "").trim();
  const includeAllGrupos = !targetGrupo;
  const fechaIso = fechaCorte ? toDateKey(fechaCorte) : new Date().toISOString().slice(0, 10);
  const epsilon = 0.01;
  const rows = (hlgRows || [])
    .filter((row) => hlgVisibleEnPantalla(row))
    .filter((row) => includeAllGrupos || String(row.grupo_de_trabajo_id || "") === targetGrupo);
  const cargoTotalHlg = new Map();
  rows.forEach((row) => {
    const dato = idxHld.get(String(row.dato_laboral_id || ""));
    const cargoId = String((dato && dato.cargo_id) || "");
    if (!cargoId) return;
    const h = cargaSemanalDesdeHlg(row, idxRegimenes);
    cargoTotalHlg.set(
      cargoId,
      Number(cargoTotalHlg.get(cargoId) || 0) + (h != null ? h : 0),
    );
  });

  return rows
    .map((row) => {
      const desde = hldHlgFechaInicioYmd(row);
      const hasta = hldHlgFechaFinYmd(row);
      const activoEnFecha = vigenteEnFechaInclusivaYmd(desde, hasta || null, fechaIso);
      const personaId = String(row.persona_id || "");
      const persona = idxPersonas.get(personaId);
      const dato = idxHld.get(String(row.dato_laboral_id || ""));
      const cargo = dato ? idxHlc.get(String(dato.cargo_id || "")) : null;
      const cargoId = String((cargo && cargo.id) || "");
      const warningCodes = [];
      const conflictos = [];
      const solape = rows.find((other) => {
        if (String(other.id || "") === String(row.id || "")) return false;
        if (String(other.grupo_de_trabajo_id || "") !== String(row.grupo_de_trabajo_id || "")) return false;
        const otherDato = idxHld.get(String(other.dato_laboral_id || ""));
        const otherCargoId = String((otherDato && otherDato.cargo_id) || "");
        if (!cargoId || !otherCargoId || otherCargoId !== cargoId) return false;
        return rangoSolapadoInclusivo(
          hldHlgFechaInicioYmd(row),
          hldHlgFechaFinYmd(row),
          hldHlgFechaInicioYmd(other),
          hldHlgFechaFinYmd(other),
        );
      });
      if (solape) {
        warningCodes.push("SOLAPE_CARGO_GRUPO");
        conflictos.push(`Solape mismo cargo+grupo con ${String(solape.id || "—")}.`);
      }
      const esperado = Number(cargo && cargo.carga_horaria_total);
      const totalHlg = Number(cargoTotalHlg.get(cargoId) || 0);
      if (cargo && Number.isFinite(esperado) && Math.abs(totalHlg - esperado) > epsilon) {
        warningCodes.push("DESVIO_CARGA_NORMATIVA");
        conflictos.push(`Desvío carga: HLg=${totalHlg} vs HLc=${esperado}.`);
      }
      const nombrePersona = persona
        ? `${String(persona.apellido || "").trim()} ${String(persona.nombre || "").trim()}`.trim()
        : "";
      return {
        id: String(row.id || ""),
        persona_id: personaId,
        persona_label: nombrePersona ? `${personaId} (${nombrePersona})` : personaId || "—",
        nivel_jerarquico: row.nivel_jerarquico == null ? null : Number(row.nivel_jerarquico),
        fecha_inicio: formatDateDdMmAaaa(desde, "—"),
        fecha_fin: formatDateDdMmAaaa(hasta, "—"),
        activo_en_fecha: activoEnFecha,
        dato_laboral_id: String(row.dato_laboral_id || ""),
        cargo_id: cargoId,
        warning_codes: warningCodes,
        conflictos,
      };
    })
    .sort((a, b) => {
      const na = Number.isFinite(a.nivel_jerarquico) ? a.nivel_jerarquico : 999;
      const nb = Number.isFinite(b.nivel_jerarquico) ? b.nivel_jerarquico : 999;
      if (na !== nb) return na - nb;
      return a.persona_label.localeCompare(b.persona_label);
    });
}

export function personaLabelFromIndex(idxPersonas, personaId) {
  const raw = String(personaId || "").trim();
  if (!raw) return "—";
  const row = idxPersonas && idxPersonas.get ? idxPersonas.get(raw) : null;
  if (!row) return raw;
  const apellido = String(row.apellido || "").trim();
  const nombre = String(row.nombre || "").trim();
  const full = [apellido, nombre].filter(Boolean).join(" ").trim();
  return full ? `${raw} (${full})` : raw;
}

export function buildRegistrosEdicionDetallados({
  registrosPorTipo,
  tipoAlta,
  idxPersonas,
  idxFunciones,
  idxGrupos,
  idxHld,
  idxHlc,
}) {
  const rows = Array.isArray(registrosPorTipo) ? registrosPorTipo : [];
  return rows.map((x) => {
    if (tipoAlta === "historial_laboral_cargos") {
      const persona = personaLabelFromIndex(idxPersonas, x.persona_id);
      const cargoFuncional = labelDesdeIndice(idxFunciones, x.cargo_funcional_id);
      const grupo = labelDesdeIndice(idxGrupos, x.grupo_de_trabajo_id);
      const desde = x.fecha_desde || "—";
      const hasta = x.fecha_hasta || "abierto";
      const desdeLabel = formatDateDdMmAaaa(desde, "—");
      const hastaLabel = hasta === "abierto" ? "abierto" : formatDateDdMmAaaa(hasta, "—");
      return {
        id: x.id,
        label: `${x.id} | persona:${persona} | cargo:${cargoFuncional} | grupo:${grupo} | ${desdeLabel} -> ${hastaLabel}`,
      };
    }
    const persona = personaLabelFromIndex(idxPersonas, x.persona_id);
    const grupo = labelDesdeIndice(idxGrupos, x.grupo_de_trabajo_id);
    const nivel = x.nivel_jerarquico == null ? "—" : String(x.nivel_jerarquico);
    const desde = x.fecha_inicio || "—";
    const hasta = x.fecha_fin || "abierto";
    const desdeLabel = formatDateDdMmAaaa(desde, "—");
    const hastaLabel = hasta === "abierto" ? "abierto" : formatDateDdMmAaaa(hasta, "—");
    const dato = x.dato_laboral_id || "—";
    const datoLaboral = idxHld.get(String(x.dato_laboral_id || ""));
    const cargo = datoLaboral ? idxHlc.get(String(datoLaboral.cargo_id || "")) : null;
    const cargoFuncional = cargo ? labelDesdeIndice(idxFunciones, cargo.cargo_funcional_id) : "—";
    return {
      id: x.id,
      label:
        `${x.id} | persona:${persona} | grupo:${grupo} | cargo:${cargoFuncional} | ` +
        `nivel:${nivel} | hld:${dato} | ${desdeLabel} -> ${hastaLabel}`,
    };
  });
}

export function buildTimelineResumen(items) {
  const base = {
    total: Array.isArray(items) ? items.length : 0,
    activos: 0,
    cerrados: 0,
    conflictos: 0,
    hlc: 0,
    hld: 0,
    hlg: 0,
    warningSolapeCargoGrupo: 0,
    warningDesvioCargaNormativa: 0,
  };
  (items || []).forEach((item) => {
    if (item.estado === "activo") base.activos += 1;
    if (item.hasta) base.cerrados += 1;
    if ((item.conflictos || []).length > 0) base.conflictos += 1;
    if (item.tipo === "HLc") base.hlc += 1;
    if (item.tipo === "HLd") base.hld += 1;
    if (item.tipo === "HLg") base.hlg += 1;
    const codes = Array.isArray(item.warning_codes) ? item.warning_codes : [];
    if (codes.includes("SOLAPE_CARGO_GRUPO")) base.warningSolapeCargoGrupo += 1;
    if (codes.includes("DESVIO_CARGA_NORMATIVA")) base.warningDesvioCargaNormativa += 1;
  });
  return base;
}

export function buildIntegridadLaboral({
  hlcRows,
  hldRows,
  hlgRows,
  idxHlc,
  idxHld,
  idxGrupos,
  idxEfectores,
}) {
  const hldSinCargo = (hldRows || []).filter((row) => !idxHlc.has(String(row.cargo_id || "")));
  const hlgSinDato = (hlgRows || [])
    .filter((row) => hlgVisibleEnPantalla(row))
    .filter((row) => !idxHld.has(String(row.dato_laboral_id || "")));
  const hlcConGrupoInvalido = (hlcRows || []).filter(
    (row) => row.grupo_de_trabajo_id && !idxGrupos.has(String(row.grupo_de_trabajo_id)),
  );
  const hlcConEfectorDesignacionInvalido = (hlcRows || []).filter(
    (row) => row.efector_designacion_id && !idxEfectores.has(String(row.efector_designacion_id)),
  );
  const hlcConEfectorCumplimientoInvalido = (hlcRows || []).filter(
    (row) => row.efector_cumplimiento_id && !idxEfectores.has(String(row.efector_cumplimiento_id)),
  );
  const totalAlertasIntegridad =
    hldSinCargo.length +
    hlgSinDato.length +
    hlcConGrupoInvalido.length +
    hlcConEfectorDesignacionInvalido.length +
    hlcConEfectorCumplimientoInvalido.length;

  const hldByCargo = new Map();
  (hldRows || []).forEach((row) => {
    const cargoId = String(row.cargo_id || "");
    if (!cargoId) return;
    const list = hldByCargo.get(cargoId) || [];
    list.push(String(row.id));
    hldByCargo.set(cargoId, list);
  });
  const hlgByHld = new Map();
  (hlgRows || []).forEach((row) => {
    if (!hlgVisibleEnPantalla(row)) return;
    const hldId = String(row.dato_laboral_id || "");
    if (!hldId) return;
    hlgByHld.set(hldId, true);
  });
  const hlcActivosSinGrupo = (hlcRows || []).filter((row) => {
    const activo = row.activo !== false && !hlcFechaHastaYmd(row);
    if (!activo) return false;
    const hldIds = hldByCargo.get(String(row.id || "")) || [];
    if (hldIds.length === 0) return true;
    return !hldIds.some((id) => hlgByHld.get(id));
  });

  return {
    hldSinCargo,
    hlgSinDato,
    hlcConGrupoInvalido,
    hlcConEfectorDesignacionInvalido,
    hlcConEfectorCumplimientoInvalido,
    totalAlertasIntegridad,
    hlcActivosSinGrupo,
  };
}
