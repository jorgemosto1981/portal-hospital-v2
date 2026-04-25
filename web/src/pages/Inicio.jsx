import { Link } from "react-router-dom";

export default function Inicio() {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Inicio</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-500">
        Pantalla dummy de la Fase A. Aquí vivirá el resumen del portal cuando conectemos datos reales. Por
        ahora sirve para validar navegación, scroll y el layout responsivo sin Firebase.
      </p>
      <div className="mt-6">
        <Link
          to="/onboarding"
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
        >
          Alta de legajo (Fase B)
        </Link>
      </div>
    </section>
  );
}
