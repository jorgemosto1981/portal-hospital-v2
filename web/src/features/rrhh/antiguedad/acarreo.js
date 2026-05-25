/** Suma cruda HLC + externo antes del acarreo (debe coincidir con amdFinal si no hubo ajuste). */
export function detectarAcarreo(det) {
  if (!det?.amdHlc || !det?.amdFinal) return { hubo: false, antes: null };
  const ext = det.amdExternoSumadoRaw || { años: 0, meses: 0, dias: 0 };
  const antes = {
    años: det.amdHlc.años + ext.años,
    meses: det.amdHlc.meses + ext.meses,
    dias: det.amdHlc.dias + ext.dias,
  };
  const f = det.amdFinal;
  const hubo =
    antes.años !== f.años || antes.meses !== f.meses || antes.dias !== f.dias;
  return { hubo, antes, despues: f };
}
