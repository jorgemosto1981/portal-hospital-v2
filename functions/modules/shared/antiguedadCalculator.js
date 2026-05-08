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
  if (row && row.computa_antiguedad_licencias === false) {
    return {
      ok: false,
      motivo: "HLC excluida: no computa antigüedad para licencias.",
      origen: row,
      tipo: "NO_COMPUTA_ANTIGUEDAD_LICENCIAS",
    };
  }
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

function splitDias(totalDias) {
  const years = Math.floor(totalDias / 365);
  const remAfterYears = totalDias % 365;
  const months = Math.floor(remAfterYears / 30);
  const days = remAfterYears % 30;
  return { años: years, meses: months, dias: days };
}

function equivDiasDesdeAmd(amd) {
  const a = Math.max(0, Math.floor(Number(amd?.años ?? 0)));
  const m = Math.max(0, Math.floor(Number(amd?.meses ?? 0)));
  const d = Math.max(0, Math.floor(Number(amd?.dias ?? 0)));
  return a * 365 + m * 30 + d;
}

function amdFromExternoRecord(rec) {
  const a = Math.max(0, Math.floor(Number(rec?.anios ?? 0)));
  const m = Math.max(0, Math.floor(Number(rec?.meses ?? 0)));
  const d = Math.max(0, Math.floor(Number(rec?.dias ?? 0)));
  if (a > 0 || m > 0 || d > 0) {
    return { años: a, meses: m, dias: d };
  }
  const explicitRaw = rec?.dias_reconocidos ?? rec?.diasReconocidos;
  const explicit = Number(explicitRaw);
  if (Number.isFinite(explicit) && explicit > 0) {
    return splitDias(Math.floor(explicit));
  }
  return { años: 0, meses: 0, dias: 0 };
}

function normalizarAcarreoAmd(anios, meses, dias) {
  let a = Math.max(0, Math.floor(Number(anios)));
  let m = Math.max(0, Math.floor(Number(meses)));
  let d = Math.max(0, Math.floor(Number(dias)));
  while (d > 29) {
    m += 1;
    d -= 30;
  }
  while (m > 11) {
    a += 1;
    m -= 12;
  }
  return { años: a, meses: m, dias: d };
}

function normalizeReconocimiento(rec, idx, corteUtc) {
  const amd = amdFromExternoRecord(rec);
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
    amd,
    impactoUtc,
    detalle: { ...rec, fecha_impacto: impactoUtc == null ? null : formatUtcDay(impactoUtc) },
  };
}

function calcularAntiguedad(hlcArray = [], fechaCorte = new Date(), diasExternos = 0) {
  const corteUtc = toUtcDay(fechaCorte, "fechaCorte");
  if (!corteUtc) throw new Error("fechaCorte es obligatoria.");
  if (!Array.isArray(hlcArray)) throw new Error("hlcArray debe ser un arreglo.");

  const hlcValidas = [];
  const hlcDescartadas = [];
  const hlcExcluidasNoComputaAntiguedad = [];
  for (let i = 0; i < hlcArray.length; i += 1) {
    const normalized = normalizeHlcInterval(hlcArray[i], i, corteUtc);
    if (normalized.ok) {
      hlcValidas.push(normalized.intervalo);
      continue;
    }
    const itemDescartado = { indice: i, motivo: normalized.motivo, origen: normalized.origen };
    hlcDescartadas.push(itemDescartado);
    if (normalized.tipo === "NO_COMPUTA_ANTIGUEDAD_LICENCIAS") {
      hlcExcluidasNoComputaAntiguedad.push(itemDescartado);
    }
  }

  const diasHlcSinFusion = hlcValidas.reduce((acc, item) => acc + item.dias, 0);
  const intervalosFusionados = mergeIntervals(hlcValidas);
  const diasHlcFusionados = intervalosFusionados.reduce((acc, item) => acc + item.dias, 0);
  const diasSuperpuestosDescartados = Math.max(0, diasHlcSinFusion - diasHlcFusionados);

  const amdHlc = splitDias(diasHlcFusionados);
  let sumExtA = 0;
  let sumExtM = 0;
  let sumExtD = 0;
  let diasExternosReconocidos = 0;
  let diasExternosAplicados = 0;
  let externosConsiderados = [];
  let externosExcluidosPorCorte = [];

  if (Array.isArray(diasExternos)) {
    for (let i = 0; i < diasExternos.length; i += 1) {
      const normalized = normalizeReconocimiento(diasExternos[i], i, corteUtc);
      if (normalized.aplica) {
        const { años: ea, meses: em, dias: ed } = normalized.amd;
        sumExtA += ea;
        sumExtM += em;
        sumExtD += ed;
        const equiv = equivDiasDesdeAmd(normalized.amd);
        diasExternosReconocidos += equiv;
        diasExternosAplicados += equiv;
        const raw = diasExternos[i] || {};
        const diasDesgloseNormativo = Math.max(0, Math.floor(Number(raw?.dias ?? 0)));
        const { dias: _diasComponenteNormativo, ...restSinColisionDias } = raw;
        externosConsiderados.push({
          ...restSinColisionDias,
          dias_desglose_normativo: diasDesgloseNormativo,
          fecha_impacto: normalized.detalle.fecha_impacto,
          amd_aportado: { ...normalized.amd },
          dias_reconocidos: equiv,
          dias_netos_aplicados: equiv,
        });
      } else {
        externosExcluidosPorCorte.push({ indice: i, motivo: normalized.motivo, detalle: normalized.detalle });
      }
    }
  } else {
    const soloDias = safeNonNegativeInt(diasExternos, "diasExternos");
    const amdScalar = splitDias(soloDias);
    sumExtA = amdScalar.años;
    sumExtM = amdScalar.meses;
    sumExtD = amdScalar.dias;
    diasExternosReconocidos = soloDias;
    diasExternosAplicados = soloDias;
  }

  const amdExternoSumadoRaw = { años: sumExtA, meses: sumExtM, dias: sumExtD };
  const desglose = normalizarAcarreoAmd(
    amdHlc.años + sumExtA,
    amdHlc.meses + sumExtM,
    amdHlc.dias + sumExtD,
  );
  const totalDiasCalculados = equivDiasDesdeAmd(desglose);

  return {
    ...desglose,
    totalDiasCalculados,
    detalleCalculo: {
      versionAlgoritmo: "antiguedad-hlc-v2-amd-suma",
      fechaCorteAplicada: formatUtcDay(corteUtc),
      diasExternosAplicados,
      amdHlc,
      amdExternoSumadoRaw,
      amdFinal: desglose,
      resumen: {
        cantidadHlcOriginales: hlcArray.length,
        cantidadHlcValidas: hlcValidas.length,
        cantidadHlcDescartadas: hlcDescartadas.length,
        cantidadHlcExcluidasNoComputaAntiguedad: hlcExcluidasNoComputaAntiguedad.length,
        cantidadIntervalosFusionados: intervalosFusionados.length,
        diasHlcSinFusion,
        diasHlcFusionados,
        diasSuperpuestosDescartados,
        diasExternosReconocidos,
        diasExternosNetosAplicados: diasExternosAplicados,
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
      hlcExcluidasNoComputaAntiguedad: hlcExcluidasNoComputaAntiguedad.map((item) => {
        const row = item && item.origen && typeof item.origen === "object" ? item.origen : {};
        return {
          indice: item.indice,
          motivo: item.motivo,
          hlc_id: row.id || null,
          fecha_inicio: row.fecha_inicio || row.fecha_desde || null,
          fecha_fin: row.fecha_fin || row.fecha_hasta || null,
          escalafon_id: row.escalafon_id || row.escalafon || null,
          agrupamiento_id: row.agrupamiento_id || row.agrupamiento || null,
          tipo_vinculo_id: row.tipo_vinculo_id || row.tipo_vinculo || null,
          cargo_funcional_id: row.cargo_funcional_id || null,
          efector_cumplimiento_id: row.efector_cumplimiento_id || null,
        };
      }),
      intervalosFusionados: intervalosFusionados.map((item) => ({
        fecha_inicio: item.inicio,
        fecha_fin: item.fin,
        dias: item.dias,
      })),
      externosConsiderados,
      externosExcluidosPorCorte,
      reglasAplicadas: [
        "Se topa fecha fin por fecha de corte.",
        "Solo se incluyen HLC con computa_antiguedad_licencias=true (o campo ausente).",
        "Los tramos HLC superpuestos o continuos se fusionan (solo entre cargos HLC; no involucra al crédito externo).",
        "No se analiza solapamiento ni intersección temporal entre crédito externo y períodos HLC.",
        "Los reconocimientos externos con fecha_impacto posterior a fecha de corte no se aplican.",
        "Tras validar fechas, el crédito externo (años/meses/días informados) se suma al desglose HLC (365/30).",
        "Acarreo: si días > 29 → +1 mes y −30 días; si meses > 11 → +1 año y −12 meses.",
      ],
    },
  };
}

module.exports = { calcularAntiguedad };
