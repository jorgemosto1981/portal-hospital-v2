"use strict";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDay(value, fieldName) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Fecha inválida en ${fieldName}.`);
    }
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Formato de fecha inválido en ${fieldName}. Use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const utc = Date.UTC(year, month, day);
  const parsed = new Date(utc);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month || parsed.getUTCDate() !== day) {
    throw new Error(`Fecha inválida en ${fieldName}.`);
  }
  return utc;
}

function formatUtcDay(utcMs) {
  const d = new Date(utcMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diffDaysInclusive(startUtc, endUtc) {
  return Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
}

function safeNonNegativeInt(value, fieldName) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${fieldName} debe ser numérico y >= 0.`);
  return Math.floor(n);
}

function normalizeHlcInterval(row, index, corteUtc) {
  const inicioRaw = row && (row.fecha_inicio ?? row.fecha_desde ?? null);
  const finRaw = row && (row.fecha_fin ?? row.fecha_hasta ?? null);
  let inicioUtc;
  try {
    inicioUtc = toUtcDay(inicioRaw, `hlc[${index}].fecha_inicio/fecha_desde`);
  } catch (error) {
    return { ok: false, motivo: error.message, origen: row };
  }
  if (!inicioUtc) return { ok: false, motivo: "Sin fecha de inicio.", origen: row };

  let finUtc = null;
  try {
    finUtc = toUtcDay(finRaw, `hlc[${index}].fecha_fin/fecha_hasta`);
  } catch (error) {
    return { ok: false, motivo: error.message, origen: row };
  }

  if (finUtc != null && finUtc < inicioUtc) {
    return { ok: false, motivo: "fecha_fin/fecha_hasta anterior a fecha_inicio/fecha_desde.", origen: row };
  }
  if (inicioUtc > corteUtc) {
    return { ok: false, motivo: "Inicio posterior a fecha de corte.", origen: row };
  }
  const finTopadoUtc = finUtc == null ? corteUtc : Math.min(finUtc, corteUtc);
  if (finTopadoUtc < inicioUtc) {
    return { ok: false, motivo: "Tramo fuera de corte (fin topado queda antes del inicio).", origen: row };
  }
  return {
    ok: true,
    intervalo: {
      inicioUtc,
      finUtc: finTopadoUtc,
      inicio: formatUtcDay(inicioUtc),
      fin: formatUtcDay(finTopadoUtc),
      dias: diffDaysInclusive(inicioUtc, finTopadoUtc),
      origen: row,
    },
  };
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.inicioUtc - b.inicioUtc);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.inicioUtc <= last.finUtc + MS_PER_DAY) {
      if (current.finUtc > last.finUtc) {
        last.finUtc = current.finUtc;
        last.fin = formatUtcDay(current.finUtc);
      }
    } else {
      merged.push({ ...current });
    }
  }
  return merged.map((intervalo) => ({ ...intervalo, dias: diffDaysInclusive(intervalo.inicioUtc, intervalo.finUtc) }));
}

function normalizeReconocimiento(rec, idx, corteUtc) {
  const dias = safeNonNegativeInt(rec && rec.dias_reconocidos, `externos[${idx}].dias_reconocidos`);
  const estado = String((rec && rec.estado) || "vigente").trim().toLowerCase();
  if (estado === "anulado" || estado === "inactivo") {
    return { aplica: false, motivo: "Reconocimiento inactivo/anulado.", detalle: rec };
  }
  const fechaImpactoRaw = rec && (rec.fecha_impacto ?? null);
  let impactoUtc = null;
  if (fechaImpactoRaw) {
    try {
      impactoUtc = toUtcDay(fechaImpactoRaw, `externos[${idx}].fecha_impacto`);
    } catch (error) {
      return { aplica: false, motivo: error.message, detalle: rec };
    }
  }
  if (impactoUtc != null && impactoUtc > corteUtc) {
    return { aplica: false, motivo: "fecha_impacto posterior a fecha de corte.", detalle: rec };
  }
  return {
    aplica: true,
    dias,
    impactoUtc,
    detalle: { ...rec, fecha_impacto: impactoUtc == null ? null : formatUtcDay(impactoUtc) },
  };
}

function overlapDays(interval, mergedIntervals) {
  let overlap = 0;
  for (const base of mergedIntervals) {
    const start = Math.max(interval.inicioUtc, base.inicioUtc);
    const end = Math.min(interval.finUtc, base.finUtc);
    if (start <= end) overlap += diffDaysInclusive(start, end);
  }
  return overlap;
}

function splitDias(totalDias) {
  const years = Math.floor(totalDias / 365);
  const remAfterYears = totalDias % 365;
  const months = Math.floor(remAfterYears / 30);
  const days = remAfterYears % 30;
  return { años: years, meses: months, dias: days };
}

function calcularAntiguedad(hlcArray = [], fechaCorte = new Date(), diasExternos = 0) {
  const corteUtc = toUtcDay(fechaCorte, "fechaCorte");
  if (!corteUtc) throw new Error("fechaCorte es obligatoria.");
  if (!Array.isArray(hlcArray)) throw new Error("hlcArray debe ser un arreglo.");

  const hlcValidas = [];
  const hlcDescartadas = [];
  for (let i = 0; i < hlcArray.length; i += 1) {
    const normalized = normalizeHlcInterval(hlcArray[i], i, corteUtc);
    if (normalized.ok) hlcValidas.push(normalized.intervalo);
    else hlcDescartadas.push({ indice: i, motivo: normalized.motivo, origen: normalized.origen });
  }

  const diasHlcSinFusion = hlcValidas.reduce((acc, item) => acc + item.dias, 0);
  const intervalosFusionados = mergeIntervals(hlcValidas);
  const diasHlcFusionados = intervalosFusionados.reduce((acc, item) => acc + item.dias, 0);
  const diasSuperpuestosDescartados = Math.max(0, diasHlcSinFusion - diasHlcFusionados);

  let diasExternosReconocidos = 0;
  let diasExternosAplicados = 0;
  let diasExternosSolapadosDescartados = 0;
  let externosConsiderados = [];
  let externosExcluidosPorCorte = [];
  let intervalosExternosFusionados = [];
  if (Array.isArray(diasExternos)) {
    const externosIntervalos = [];
    for (let i = 0; i < diasExternos.length; i += 1) {
      const normalized = normalizeReconocimiento(diasExternos[i], i, corteUtc);
      if (normalized.aplica) {
        if (normalized.impactoUtc == null) {
          externosExcluidosPorCorte.push({
            indice: i,
            motivo: "Reconocimiento sin fecha_impacto. No se puede deduplicar por solape.",
            detalle: normalized.detalle,
          });
          continue;
        }
        diasExternosReconocidos += normalized.dias;
        const finUtc = Math.min(normalized.impactoUtc + (normalized.dias - 1) * MS_PER_DAY, corteUtc);
        if (finUtc < normalized.impactoUtc) {
          externosExcluidosPorCorte.push({ indice: i, motivo: "Intervalo externo fuera de corte.", detalle: normalized.detalle });
          continue;
        }
        externosIntervalos.push({
          indice: i,
          inicioUtc: normalized.impactoUtc,
          finUtc,
          dias: diffDaysInclusive(normalized.impactoUtc, finUtc),
          detalle: normalized.detalle,
        });
      } else {
        externosExcluidosPorCorte.push({ indice: i, motivo: normalized.motivo, detalle: normalized.detalle });
      }
    }

    let baseMerged = [...intervalosFusionados];
    const externosSorted = externosIntervalos.sort((a, b) => a.inicioUtc - b.inicioUtc);
    for (const ext of externosSorted) {
      const diasSolapados = overlapDays(ext, baseMerged);
      const diasNetos = Math.max(0, ext.dias - diasSolapados);
      diasExternosSolapadosDescartados += diasSolapados;
      diasExternosAplicados += diasNetos;
      externosConsiderados.push({
        ...ext.detalle,
        fecha_inicio_intervalo: formatUtcDay(ext.inicioUtc),
        fecha_fin_intervalo: formatUtcDay(ext.finUtc),
        dias_reconocidos: ext.dias,
        dias_solapados_descartados: diasSolapados,
        dias_netos_aplicados: diasNetos,
      });
      baseMerged = mergeIntervals([
        ...baseMerged,
        {
          inicioUtc: ext.inicioUtc,
          finUtc: ext.finUtc,
          inicio: formatUtcDay(ext.inicioUtc),
          fin: formatUtcDay(ext.finUtc),
        },
      ]);
    }
    intervalosExternosFusionados = mergeIntervals(
      externosSorted.map((ext) => ({
        inicioUtc: ext.inicioUtc,
        finUtc: ext.finUtc,
        inicio: formatUtcDay(ext.inicioUtc),
        fin: formatUtcDay(ext.finUtc),
      })),
    ).map((item) => ({
      fecha_inicio: item.inicio,
      fecha_fin: item.fin,
      dias: item.dias,
    }));
  } else {
    diasExternosReconocidos = safeNonNegativeInt(diasExternos, "diasExternos");
    diasExternosAplicados = diasExternosReconocidos;
  }

  const totalDiasCalculados = diasHlcFusionados + diasExternosAplicados;
  const desglose = splitDias(totalDiasCalculados);

  return {
    ...desglose,
    totalDiasCalculados,
    detalleCalculo: {
      versionAlgoritmo: "antiguedad-hlc-v1",
      fechaCorteAplicada: formatUtcDay(corteUtc),
      diasExternosAplicados,
      resumen: {
        cantidadHlcOriginales: hlcArray.length,
        cantidadHlcValidas: hlcValidas.length,
        cantidadHlcDescartadas: hlcDescartadas.length,
        cantidadIntervalosFusionados: intervalosFusionados.length,
        diasHlcSinFusion,
        diasHlcFusionados,
        diasSuperpuestosDescartados,
        diasExternosReconocidos,
        diasExternosNetosAplicados: diasExternosAplicados,
        diasExternosSolapadosDescartados,
      },
      hlcConsideradas: hlcValidas.map((item) => ({
        fecha_inicio: item.inicio,
        fecha_fin_topada: item.fin,
        dias: item.dias,
        escalafon_id: item.origen && (item.origen.escalafon_id || item.origen.escalafon || null),
        agrupamiento_id: item.origen && (item.origen.agrupamiento_id || item.origen.agrupamiento || null),
        tipo_vinculo_id: item.origen && (item.origen.tipo_vinculo_id || item.origen.tipo_vinculo || null),
      })),
      hlcDescartadas,
      intervalosFusionados: intervalosFusionados.map((item) => ({
        fecha_inicio: item.inicio,
        fecha_fin: item.fin,
        dias: item.dias,
      })),
      externosConsiderados,
      intervalosExternosFusionados,
      externosExcluidosPorCorte,
      reglasAplicadas: [
        "Se topa fecha fin por fecha de corte.",
        "Los tramos HLC superpuestos o continuos se fusionan.",
        "Los reconocimientos externos con fecha_impacto posterior a fecha de corte no se aplican.",
        "Los reconocimientos externos se deduplican por solape contra HLC y entre sí.",
      ],
    },
  };
}

module.exports = { calcularAntiguedad };
