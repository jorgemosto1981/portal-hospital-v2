export function formatValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{...}";
  return String(v);
}

export function formatCargaPorDia(v) {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((x) => (x == null ? "-" : String(x))).join(" / ");
}

export function isoToDateInput(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function takeFirst(items, max = 5) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

export function emptyCargaDia() {
  return { dia_semana_id: "", horas: "" };
}

export function normalizeCargaRowsFromRecord(rawCarga) {
  if (!Array.isArray(rawCarga)) return [emptyCargaDia()];
  if (rawCarga.length === 0) return [emptyCargaDia()];
  return rawCarga.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return {
        dia_semana_id: String(item.dia_semana_id || ""),
        horas: item.horas == null ? "" : String(item.horas),
      };
    }
    return {
      dia_semana_id: "",
      horas: item == null ? "" : String(item),
    };
  });
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
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compareIsoDesc(a, b) {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function estadoDesdeFechas(desde, hasta) {
  const nowIso = new Date().toISOString().slice(0, 10);
  if (!desde) return "desconocido";
  if (hasta && hasta < nowIso) return "cerrado";
  if (desde > nowIso) return "pendiente";
  return "activo";
}

function sumCargaPorDiaSemana(carga) {
  if (!Array.isArray(carga)) return 0;
  return carga.reduce((acc, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const n = Number(item.horas);
      return Number.isFinite(n) ? acc + n : acc;
    }
    const n = Number(item);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
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
}) {
  const persona = String(personaId || "").trim();
  const includeAllPersonas = !persona;
  const items = [];
  const epsilon = 0.01;
  const cargoTotalHlg = new Map();

  (hlgRows || []).forEach((row) => {
    const rowPersona = String(row.persona_id || "");
    if (!includeAllPersonas && rowPersona !== persona) return;
    const dato = idxHld.get(String(row.dato_laboral_id || ""));
    const cargoId = String((dato && dato.cargo_id) || "");
    if (!cargoId) return;
    const prev = cargoTotalHlg.get(cargoId) || 0;
    cargoTotalHlg.set(cargoId, prev + sumCargaPorDiaSemana(row.carga_por_dia_semana));
  });

  (hlcRows || [])
    .filter((row) => includeAllPersonas || String(row.persona_id || "") === persona)
    .forEach((row) => {
      const desde = toDateKey(row.fecha_desde);
      const hasta = toDateKey(row.fecha_hasta);
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
      const desde = toDateKey(row.fecha_inicio);
      const hasta = toDateKey(row.fecha_fin);
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
          `Rol: ${labelIdNombre(idxRoles, row.rol_id)} · ` +
          `Funcion: ${labelIdNombre(idxFunciones, row.funcion_real_id)}`,
        conflictos,
        warning_codes: warningCodes,
      });
    });

  (hlgRows || [])
    .filter((row) => includeAllPersonas || String(row.persona_id || "") === persona)
    .forEach((row) => {
      const desde = toDateKey(row.fecha_inicio);
      const hasta = toDateKey(row.fecha_fin);
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
      const rowDesde = toDateKey(row.fecha_inicio);
      const rowHasta = toDateKey(row.fecha_fin);
      const solape = (hlgRows || []).find((other) => {
        if (String(other.id || "") === String(row.id || "")) return false;
        const otherDato = idxHld.get(String(other.dato_laboral_id || ""));
        const otherCargoId = String((otherDato && otherDato.cargo_id) || "");
        if (!cargoId || !otherCargoId || otherCargoId !== cargoId) return false;
        if (String(other.grupo_de_trabajo_id || "") !== grupoId) return false;
        const otherDesde = toDateKey(other.fecha_inicio);
        const otherHasta = toDateKey(other.fecha_fin);
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
  const fechaIso = fecha ? toDateKey(fecha) : new Date().toISOString().slice(0, 10);
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
}) {
  const targetGrupo = String(grupoId || "").trim();
  const includeAllGrupos = !targetGrupo;
  const fechaIso = fechaCorte ? toDateKey(fechaCorte) : new Date().toISOString().slice(0, 10);
  const epsilon = 0.01;
  const rows = (hlgRows || []).filter(
    (row) => includeAllGrupos || String(row.grupo_de_trabajo_id || "") === targetGrupo,
  );
  const cargoTotalHlg = new Map();
  rows.forEach((row) => {
    const dato = idxHld.get(String(row.dato_laboral_id || ""));
    const cargoId = String((dato && dato.cargo_id) || "");
    if (!cargoId) return;
    cargoTotalHlg.set(
      cargoId,
      Number(cargoTotalHlg.get(cargoId) || 0) + sumCargaPorDiaSemana(row.carga_por_dia_semana),
    );
  });

  return rows
    .map((row) => {
      const desde = toDateKey(row.fecha_inicio);
      const hasta = toDateKey(row.fecha_fin);
      const activoEnFecha = !!desde && desde <= fechaIso && (!hasta || hasta >= fechaIso);
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
          toDateKey(row.fecha_inicio),
          toDateKey(row.fecha_fin),
          toDateKey(other.fecha_inicio),
          toDateKey(other.fecha_fin),
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
        fecha_inicio: desde || "—",
        fecha_fin: hasta || "—",
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
