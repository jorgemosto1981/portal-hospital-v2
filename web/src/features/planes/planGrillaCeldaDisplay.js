import { rangoHhmmLabel, resolverHorarioCelda } from "../../../../shared/utils/horarioInstitucionalDisplay.js";

export function normalizarTipoDiaCelda(tipoDiaRaw) {
  const t = String(tipoDiaRaw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "laborable" || t === "guardia" || t === "franco" || t === "no_laborable") return t;
  if (t === "no-laborable" || t === "nolaborable" || t === "no_laboral") return "no_laborable";
  return "franco";
}

function etiquetaTurno(turnoId, turnoEtiquetas = {}) {
  const tid = String(turnoId || "").trim();
  if (!tid) return "";
  return String(turnoEtiquetas[tid] || tid).trim();
}

/**
 * Presentación de celda para vistas VER (alineada al editor: dos líneas si hay turno + horario).
 * @param {object|null|undefined} celda
 * @param {{ turnoEtiquetas?: Record<string, string> }} [opts]
 */
export function presentacionCeldaGrillaAprobada(celda, opts = {}) {
  const turnoEtiquetas = opts.turnoEtiquetas || {};
  if (!celda || typeof celda !== "object") {
    return { linea1: "", linea2: "", unaLinea: "—", dosLineas: false, title: "" };
  }

  const linea1Snap = String(celda.display_linea1 || "").trim();
  const linea2Snap = String(celda.display_linea2 || "").trim();
  if (linea1Snap || linea2Snap) {
    const una =
      linea1Snap && linea2Snap ? `${linea1Snap} · ${linea2Snap}` : linea1Snap || linea2Snap;
    return {
      linea1: linea1Snap,
      linea2: linea2Snap,
      unaLinea: una,
      dosLineas: Boolean(linea1Snap && linea2Snap),
      title: una,
    };
  }

  const tipo = normalizarTipoDiaCelda(celda.tipo_dia);
  const esFranco =
    celda.es_franco === true || tipo === "franco" || tipo === "no_laborable";
  if (esFranco) {
    const txt = tipo === "no_laborable" ? "NL" : "F";
    return { linea1: txt, linea2: "", unaLinea: txt, dosLineas: false, title: txt };
  }

  if (celda.es_feriado && !celda.turno_id && !celda.turno_compuesto_id) {
    return { linea1: "Fer", linea2: "", unaLinea: "Fer", dosLineas: false, title: "Feriado" };
  }

  const turnoId = celda.turno_id || celda.turno_compuesto_id;
  const { ingreso, egreso } = resolverHorarioCelda(celda);
  const horario = rangoHhmmLabel(ingreso, egreso);
  const nombreTurno = etiquetaTurno(turnoId, turnoEtiquetas) || String(turnoId || "").trim();

  if (nombreTurno && horario) {
    return {
      linea1: nombreTurno,
      linea2: horario,
      unaLinea: `${nombreTurno} ${horario}`,
      dosLineas: true,
      title: `${nombreTurno} ${horario}`,
    };
  }
  if (horario && !nombreTurno) {
    return { linea1: horario, linea2: "", unaLinea: horario, dosLineas: false, title: horario };
  }
  if (nombreTurno) {
    return { linea1: nombreTurno, linea2: "", unaLinea: nombreTurno, dosLineas: false, title: nombreTurno };
  }
  return { linea1: "", linea2: "", unaLinea: "—", dosLineas: false, title: "" };
}
