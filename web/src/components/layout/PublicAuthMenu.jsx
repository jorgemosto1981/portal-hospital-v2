import { Link, useLocation } from "react-router-dom";

const BASE =
  "rounded-lg px-2.5 py-2 text-sm font-medium leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 sm:px-3 sm:py-1.5";
const INACTIVE = `${BASE} text-slate-800 hover:bg-slate-100`;
const ACTIVE = `${BASE} bg-blue-100 text-blue-900`;

/** @param {string} pathname */
function deriveActive(pathname) {
  if (pathname === "/registro") return "registro";
  if (pathname === "/vinculacion") return "vinculacion";
  if (pathname === "/login" || pathname === "/") return "login";
  return "login";
}

/**
 * Menú horizontal: acceso, registro y vinculación (pantallas públicas previas al shell).
 * @param {{ active?: "login" | "registro" | "vinculacion" | "none" }} p
 * — Si `active` se omite, se infiere con la ruta actual. Usá `active="none"` (p. ej. shell con `VITE_BYPASS_AUTH`).
 */
export default function PublicAuthMenu({ active: activeProp }) {
  const { pathname } = useLocation();
  const active = activeProp === undefined ? deriveActive(pathname) : activeProp;

  return (
    <nav
      className="relative z-30 w-full shrink-0 border-b border-slate-200 bg-white shadow-sm"
      aria-label="Menú de acceso e identidad"
    >
      <ul className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-1 gap-y-2 px-2 py-2.5 sm:min-h-[2.75rem] sm:gap-0 sm:px-3">
        <li>
          <Link
            to="/login"
            className={active === "login" ? ACTIVE : INACTIVE}
            aria-current={active === "login" ? "page" : undefined}
          >
            Iniciar sesión
          </Link>
        </li>
        <li className="hidden text-slate-300 sm:mx-1 sm:inline" aria-hidden>
          ·
        </li>
        <li>
          <Link
            to="/registro"
            className={active === "registro" ? ACTIVE : INACTIVE}
            aria-current={active === "registro" ? "page" : undefined}
          >
            Registro
          </Link>
        </li>
        <li className="hidden text-slate-300 sm:mx-1 sm:inline" aria-hidden>
          ·
        </li>
        <li>
          <Link
            to="/vinculacion"
            className={active === "vinculacion" ? ACTIVE : INACTIVE}
            aria-current={active === "vinculacion" ? "page" : undefined}
          >
            Vinculación (soporte)
          </Link>
        </li>
        <li className="hidden text-slate-300 sm:mx-1 sm:inline" aria-hidden>
          ·
        </li>
        <li>
          <Link to="/" className={INACTIVE}>
            Inicio
          </Link>
        </li>
      </ul>
    </nav>
  );
}
