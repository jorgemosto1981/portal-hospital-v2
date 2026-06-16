import { disciplinaHorariaIncumplimientoDesdeAnalitica } from "../../../../shared/utils/calcularDeltasCumplimiento.js";
import { toleranciasTextoDesdeAnalitica } from "./grillaAnaliticaCumplimientoUi.js";

export { toleranciasTextoDesdeAnalitica };

/**
 * Resultado legible fichada vs teoría (modal jefe).
 *
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
export function resultadoAnalisisFichadaJefe(celdaVis) {
  const celda = celdaVis && typeof celdaVis === "object" ? celdaVis : {};
  const anal = celda.analitica_cumplimiento;
  const sem = celda.validacion_fichada_dia?.estado_semaforo
    ? String(celda.validacion_fichada_dia.estado_semaforo)
    : "";

  if (celda.resuelto_rrhh === true) {
    return {
      titulo: "Horario OK (cerrado por RRHH)",
      detalle:
        "RRHH marcó el día como revisado. El semáforo queda en verde aunque la analítica registre desvíos menores.",
      hayDesvioTecnico: Boolean(
        anal?.disciplina?.fuera_de_margen ||
          anal?.debito_tiempo?.incumplimiento_carga_horaria ||
          anal?.fichada_fuera_turno_teorico,
      ),
    };
  }

  if (!anal || typeof anal !== "object") {
    return {
      titulo: sem === "VERDE" ? "Conforme (semáforo)" : "Ver detalle en semáforo",
      detalle: celda.validacion_fichada_dia?.texto_resumen || null,
      hayDesvioTecnico: sem === "AMARILLO" || sem === "ROJO",
    };
  }

  if (anal.fichada_fuera_turno_teorico === true) {
    return {
      titulo: "Marcas fuera del turno teórico",
      detalle: "No se evalúa tardanza/débito hasta alinear marcas con la ventana del turno.",
      hayDesvioTecnico: true,
    };
  }

  if (anal.ausencia_automatica === true) {
    return {
      titulo: "Ausencia (sin marcas tras ventana institucional)",
      detalle: null,
      hayDesvioTecnico: true,
    };
  }

  const inc = disciplinaHorariaIncumplimientoDesdeAnalitica(anal);
  const deficit = Number(anal.debito_tiempo?.deficit_minutos) || 0;
  const tolDeb = Number(anal.debito_tiempo?.tolerancia_debitohorario_minutos) || 0;

  if (inc.hay_incumplimiento) {
    const partes = [];
    if (inc.tardanza_punitiva_min > 0) partes.push(`tardanza ${inc.tardanza_punitiva_min} min`);
    if (inc.salida_anticipada_punitiva_min > 0) {
      partes.push(`salida anticipada ${inc.salida_anticipada_punitiva_min} min`);
    }
    return {
      titulo: "Fuera de margen horario",
      detalle: `Respecto al horario nominal del turno: ${partes.join(" · ")}.`,
      hayDesvioTecnico: true,
    };
  }

  if (anal.debito_tiempo?.incumplimiento_carga_horaria === true) {
    return {
      titulo: "Déficit de carga horaria",
      detalle: `Faltan ${deficit} min respecto a la carga teórica (tolerancia de cortesía ${tolDeb} min).`,
      hayDesvioTecnico: true,
    };
  }

  if (sem === "VERDE" || (!inc.hay_incumplimiento && !anal.debito_tiempo?.incumplimiento_carga_horaria)) {
    return {
      titulo: "Horario dentro de márgenes",
      detalle: "Ingreso y egreso dentro de los límites con gracia; carga dentro de tolerancia de débito.",
      hayDesvioTecnico: false,
    };
  }

  return {
    titulo: "Revisar fichada vs turno",
    detalle: celda.validacion_fichada_dia?.texto_resumen || null,
    hayDesvioTecnico: sem === "AMARILLO" || sem === "ROJO",
  };
}
