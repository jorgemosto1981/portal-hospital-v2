import ArticuloConfigTabs from "../features/configuracion/articulos/ArticuloConfigTabs.jsx";

export default function ArticuloConfiguracion() {
  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Artículos — configuración</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
          Panel de versión alineado a <span className="font-mono text-slate-700">cfgArticuloVersionSchema</span> y al
          contrato en <span className="font-mono text-slate-700">docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md</span>.
          Podés precargar ids con la query{" "}
          <span className="font-mono text-slate-700">?articuloId=art_…&versionId=ver_…</span>.
        </p>
      </header>
      <ArticuloConfigTabs />
    </div>
  );
}
