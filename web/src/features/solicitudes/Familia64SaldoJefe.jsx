/**
 * Saldo Art. 64 del agente, para que el jefe elija modalidad con información.
 * Se carga a pedido: el panel arranca cerrado con un botón.
 * @param {{
 *   resumen: Record<string, unknown> | null,
 *   pedido?: boolean,
 *   cargando?: boolean,
 *   error?: string,
 *   onVerSaldo?: () => void,
 *   codigoConGoce?: string,
 *   codigoSinGoce?: string,
 *   sinGoceInsuficiente?: boolean,
 * }} props
 */
export default function Familia64SaldoJefe({
  resumen,
  pedido = false,
  cargando = false,
  error = "",
  onVerSaldo,
  codigoConGoce = "",
  codigoSinGoce = "",
  sinGoceInsuficiente = false,
}) {
  if (!pedido) {
    return (
      <button
        type="button"
        onClick={onVerSaldo}
        className="min-h-[44px] w-full touch-manipulation rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-sm font-semibold text-sky-800 active:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        Ver saldo disponible
      </button>
    );
  }

  if (cargando) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
        role="status"
      >
        Consultando saldo del agente…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
        role="status"
      >
        <p>No se pudo consultar el saldo: {error}</p>
        <button
          type="button"
          onClick={onVerSaldo}
          className="min-h-[44px] touch-manipulation rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 active:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!resumen) return null;

  const anio = resumen.anio_ciclo ?? "—";
  // Saldo previo al alta de este trámite: el descuento del pedido actual se
  // muestra aparte, no restado de antemano.
  const con = resumen.con_goce_disponible_previo ?? resumen.con_goce_disponible;
  const sin = resumen.sin_goce_disponible_previo ?? resumen.sin_goce_disponible;
  const dias = Number(resumen.dias_solicitados) || 1;
  const sinDato = con == null && sin == null;

  const fila = (codigo, etiqueta, valor, alerta) => (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-slate-700">
        {codigo ? <span className="font-medium text-slate-900">{codigo}</span> : null} {etiqueta}
      </span>
      <span className={alerta ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
        {valor == null ? "sin dato" : `${valor} ${valor === 1 ? "día" : "días"}`}
      </span>
    </li>
  );

  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
        Saldo disponible del agente · ciclo {anio}
      </p>
      <ul className="space-y-1.5">
        {fila(codigoConGoce, "con goce", con, false)}
        {fila(codigoSinGoce, "sin goce", sin, sinGoceInsuficiente)}
      </ul>
      <p className="text-xs text-slate-600">
        Total disponible, sin contar la reserva de este trámite. Si aprobás la solicitud{" "}
        {dias === 1 ? "se descuenta" : "se descuentan"}{" "}
        <strong>
          {dias} {dias === 1 ? "día" : "días"}
        </strong>{" "}
        de la modalidad que elijas.
      </p>
      {sinGoceInsuficiente ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
          No alcanza el saldo sin goce para pasar el trámite a esa modalidad. Podés autorizarlo con
          goce o rechazarlo.
        </p>
      ) : null}
      {sinDato ? (
        <p className="text-xs text-slate-600">
          El agente no tiene check-in de saldo Art. 64 en este ciclo. RRHH debe cargar las bolsas
          antes de que se pueda pasar a sin goce.
        </p>
      ) : null}
    </div>
  );
}
