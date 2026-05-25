export function diasAAniosMesesDias(totalDiasRaw) {
  const totalDias = Math.max(0, Number(totalDiasRaw || 0));
  const anios = Math.floor(totalDias / 365);
  const resto = totalDias % 365;
  const meses = Math.floor(resto / 30);
  const dias = resto % 30;
  return `${anios} años, ${meses} meses, ${dias} días`;
}

/** Misma base 365/30 que el motor; para textos legales con “y” antes del último término. */
export function amdLegibleDesdeDias(totalDiasRaw) {
  const totalDias = Math.max(0, Number(totalDiasRaw || 0));
  const anios = Math.floor(totalDias / 365);
  const resto = totalDias % 365;
  const meses = Math.floor(resto / 30);
  const dias = resto % 30;
  const partes = [];
  partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function formatoAmdLegible(amd) {
  if (!amd || typeof amd !== "object") return "—";
  const a = Math.max(0, Number(amd.años ?? amd.anios ?? 0));
  const m = Math.max(0, Number(amd.meses ?? 0));
  const d = Math.max(0, Number(amd.dias ?? 0));
  const partes = [
    `${a} ${a === 1 ? "año" : "años"}`,
    `${m} ${m === 1 ? "mes" : "meses"}`,
    `${d} ${d === 1 ? "día" : "días"}`,
  ];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function amdLegibleDesdeReconocimiento(rec) {
  if (rec?.amd_aportado && typeof rec.amd_aportado === "object") {
    return formatoAmdLegible(rec.amd_aportado);
  }
  const a = Math.max(0, Number(rec?.anios ?? 0));
  const m = Math.max(0, Number(rec?.meses ?? 0));
  const d = Math.max(0, Number(rec?.dias_desglose_normativo ?? rec?.dias ?? 0));
  const partes = [];
  partes.push(`${a} ${a === 1 ? "año" : "años"}`);
  partes.push(`${m} ${m === 1 ? "mes" : "meses"}`);
  partes.push(`${d} ${d === 1 ? "día" : "días"}`);
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function catalogLabel(item) {
  if (!item) return "";
  if (typeof item.titulo_ui === "string" && item.titulo_ui.trim()) return item.titulo_ui.trim();
  if (typeof item.nombre === "string" && item.nombre.trim()) return item.nombre.trim();
  return String(item.id || "").trim();
}
