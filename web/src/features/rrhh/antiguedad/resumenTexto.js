import { detectarAcarreo } from "./acarreo.js";
import { catalogLabel, formatoAmdLegible } from "./amdFormat.js";
import { formatDdMmAaaa } from "./dateIso.js";

export function construirTextoResumen({
  personaId,
  personaLabel,
  fechaCorteDdMm,
  resultado,
  idxEscalafon,
  idxAgrupamiento,
  idxTipoVinculo,
}) {
  const det = resultado?.detalleCalculo;
  const lines = [];
  lines.push("PORTAL — Antigüedad (resumen copiado)");
  lines.push(`Persona: ${personaLabel}`);
  lines.push(`persona_id: ${personaId}`);
  lines.push(`Fecha de corte: ${fechaCorteDdMm}`);
  lines.push(
    `Total: ${resultado.totalDiasCalculados} días (ref. 365/30) · ${formatoAmdLegible({
      años: resultado.años,
      meses: resultado.meses,
      dias: resultado.dias,
    })}`,
  );
  const ac = detectarAcarreo(det);
  if (ac.hubo && ac.antes) {
    lines.push(
      `Acarreo aplicado: antes ${ac.antes.años}a ${ac.antes.meses}m ${ac.antes.dias}d → después ${ac.despues.años}a ${ac.despues.meses}m ${ac.despues.dias}d`,
    );
  } else {
    lines.push("Acarreo: no fue necesario (suma cruda = total final).");
  }
  if (det?.amdHlc) {
    lines.push(`HLC (365/30): ${formatoAmdLegible(det.amdHlc)}`);
  }
  if (det?.amdExternoSumadoRaw) {
    const e = det.amdExternoSumadoRaw;
    if (e.años > 0 || e.meses > 0 || e.dias > 0) {
      lines.push(`Crédito externo sumado: ${formatoAmdLegible(e)}`);
    }
  }
  lines.push(`HLC válidas: ${det?.resumen?.cantidadHlcValidas ?? 0} · Fusionados: ${det?.resumen?.cantidadIntervalosFusionados ?? 0}`);
  const fusionados = det?.intervalosFusionados || [];
  if (fusionados.length) {
    lines.push("Intervalos HLC fusionados:");
    fusionados.forEach((it) => {
      lines.push(`  - ${formatDdMmAaaa(it.fecha_inicio)} a ${formatDdMmAaaa(it.fecha_fin)} · ${it.dias} días`);
    });
  }
  const hlc = det?.hlcConsideradas || [];
  if (hlc.length) {
    lines.push("HLC consideradas (detalle):");
    hlc.forEach((item) => {
      const esc = catalogLabel(idxEscalafon.get(String(item.escalafon_id || ""))) || item.escalafon_id || "—";
      const agr = catalogLabel(idxAgrupamiento.get(String(item.agrupamiento_id || ""))) || item.agrupamiento_id || "—";
      const vin = catalogLabel(idxTipoVinculo.get(String(item.tipo_vinculo_id || ""))) || item.tipo_vinculo_id || "—";
      lines.push(`  - ${esc} · ${agr} · ${vin}`);
      lines.push(`    ${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin_topada)} · ${item.dias} días`);
    });
  }
  (det?.externosConsiderados || []).forEach((rec) => {
    lines.push(
      `Externo APLICA: ${rec?.normativa || "—"} · ${formatDdMmAaaa(rec?.fecha_impacto)} · A/M/D ${rec?.amd_aportado ? `${rec.amd_aportado.años}/${rec.amd_aportado.meses}/${rec.amd_aportado.dias}` : "—"}`,
    );
  });
  (det?.externosExcluidosPorCorte || []).forEach((row) => {
    lines.push(
      `Externo NO aplica: ${row?.detalle?.normativa || "—"} · ${formatDdMmAaaa(row?.detalle?.fecha_impacto)} · ${row?.motivo || ""}`,
    );
  });
  if ((det?.reglasAplicadas || []).length) {
    lines.push("Reglas del motor:");
    det.reglasAplicadas.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  lines.push(`Generado: ${new Date().toISOString()}`);
  return lines.join("\n");
}
