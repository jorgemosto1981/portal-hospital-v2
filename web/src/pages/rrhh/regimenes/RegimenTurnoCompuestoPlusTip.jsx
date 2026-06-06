/**
 * Aviso operativo: ids con "+" descomponen tramos para cobertura parcial.
 */
export default function RegimenTurnoCompuestoPlusTip({ className = "" }) {
  return (
    <div
      className={`rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 ${className}`}
      role="note"
    >
      <p className="font-semibold text-indigo-800">Turnos compuestos con «+»</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-indigo-900/90">
        <li>
          En el <strong>plan mensual</strong>, use <span className="font-mono">M+T</span>,{" "}
          <span className="font-mono">T+N</span>, <span className="font-mono">M+T+N</span>, etc. (no{" "}
          <span className="font-mono">MT</span> atómico) para que el motor genere{" "}
          <strong>un tramo por turno base</strong>.
        </li>
        <li>
          Si los tramos encadenan sin hueco (ej. M 06–14 y T 14–22), las{" "}
          <strong>fichadas esperadas siguen siendo 2</strong> (entrada y salida de la jornada).
        </li>
        <li>
          La descomposición habilita <strong>cobertura parcial por tramo</strong> (
          <span className="font-mono">segmentos_cubiertos: [&quot;T&quot;]</span> → solo 14–22).
        </li>
        <li>
          Tras cambiar ids en régimen o plan, <strong>rematerialice</strong> el mes del grupo para
          sobrescribir capa teórica y grilla (<span className="font-mono">vis_*</span>).
        </li>
      </ul>
    </div>
  );
}
