export function validateCheckinPatronC(saldoInicial) {
  const raw = String(saldoInicial ?? "").trim();
  if (raw === "") {
    return { ok: true, saldo: 0, empty: true };
  }
  if (!/^-?\d+$/.test(raw)) {
    return { ok: false, message: "El saldo debe ser un número entero (sin decimales)." };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, message: "El saldo inicial debe ser un número." };
  }
  return { ok: true, saldo: n, empty: false };
}
