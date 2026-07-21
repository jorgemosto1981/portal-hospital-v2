import { Link } from "react-router-dom";

const SECCIONES = [
  {
    to: "/portal/rrhh/alta-agente",
    titulo: "Alta nuevo usuario",
    detalle: "Identidad, laboral, check-in y aviso de primer acceso.",
  },
  {
    to: "/portal/rrhh/gestion-usuarios/acceso",
    titulo: "Gestión de acceso de cuenta",
    detalle: "Bloquear, rehabilitar o deshabilitar el ingreso al portal.",
  },
  {
    to: "/portal/rrhh/gestion-usuarios/baja",
    titulo: "Baja laboral transaccional",
    detalle: "Cierra HLc vigentes, marca baja y opcionalmente bloquea acceso.",
  },
  {
    to: "/portal/rrhh/gestion-usuarios/reinicio",
    titulo: "Reinicio de vinculación e invalidación de sesión",
    detalle: "Revoca sesión Auth y deja la cuenta lista para re-vincular por DNI.",
  },
  {
    to: "/portal/rrhh/seguimiento-enrolamiento",
    titulo: "Seguimiento de enrolamiento",
    detalle: "Estado de altas, vínculo Auth y onboarding por persona.",
  },
];

/** Índice de gestión de usuarios RRHH (alta + acciones administrativas + seguimiento). */
export default function GestionUsuariosRrhhPage() {
  return (
    <div className="mx-auto w-full max-w-md px-3 py-6 text-slate-900 md:max-w-lg">
      <h1 className="text-xl font-semibold">Gestión de usuarios</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Ciclo completo de cuentas: alta inicial, acceso, baja, re-vinculación y seguimiento.
      </p>

      <ul className="mt-5 space-y-3">
        {SECCIONES.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="block min-h-11 rounded-xl border border-slate-200 bg-white p-4 shadow-sm touch-manipulation active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <p className="text-base font-semibold text-slate-900">{s.titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{s.detalle}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
