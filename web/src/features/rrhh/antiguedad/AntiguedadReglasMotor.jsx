export function AntiguedadReglasMotor({ reglasAplicadas }) {
  const list = reglasAplicadas || [];
  if (!list.length) return null;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
      <summary className="cursor-pointer touch-manipulation select-none font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        Reglas que aplicó el motor en este cálculo
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-600">
        {list.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
    </details>
  );
}
