export function periodoActualYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function desplazarPeriodo(periodoYm, deltaMeses) {
  const [anio, mes] = String(periodoYm || periodoActualYm()).split("-").map(Number);
  const dt = new Date(anio, (mes || 1) - 1 + deltaMeses, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function periodosVentanaJefe(baseYm = periodoActualYm()) {
  return [desplazarPeriodo(baseYm, -1), baseYm, desplazarPeriodo(baseYm, 1)];
}

export function periodoPermitidoJefe(periodoYm, baseYm = periodoActualYm()) {
  return periodosVentanaJefe(baseYm).includes(String(periodoYm || ""));
}

export function normalizarPeriodoJefe(periodoYm, baseYm = periodoActualYm()) {
  return periodoPermitidoJefe(periodoYm, baseYm) ? periodoYm : baseYm;
}

export function rangoFechasVentanaJefe(baseYm = periodoActualYm()) {
  const [prevYm, , nextYm] = periodosVentanaJefe(baseYm);
  const [prevY, prevM] = prevYm.split("-").map(Number);
  const [nextY, nextM] = nextYm.split("-").map(Number);
  const lastDay = new Date(nextY, nextM, 0).getDate();
  return {
    desdeYmd: `${prevY}-${String(prevM).padStart(2, "0")}-01`,
    hastaYmd: `${nextY}-${String(nextM).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}
