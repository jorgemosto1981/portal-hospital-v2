import { Link, useLocation } from "react-router-dom";

const BASE =
  "rounded-lg px-2.5 py-2 text-sm font-medium leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 sm:px-3 sm:py-1.5";
const INACTIVE = `${BASE} text-slate-800 hover:bg-slate-100`;
const ACTIVE = `${BASE} bg-blue-100 text-blue-900`;

/** @param {string} pathname @param {string} search */
function deriveActive(pathname, search) {
  if (pathname === "/vinculacion") return "vinculacion";
  if (pathname === "/login") {
    return new URLSearchParams(search).get("alta") === "1" ? "registro" : "login";
  }
  if (pathname === "/registro") return "registro";
  if (pathname === "/") return "login";
  return "login";
}

/**
 * Menú horizontal: acceso unificado en `/login`, primer acceso, vinculación e inicio del portal.
 * @param {{ active?: "login" | "registro" | "vinculacion" | "none" }} p
 */
export default function PublicAuthMenu({ active: activeProp }) {
  const { pathname, search } = useLocation();
  const active = activeProp === undefined ? deriveActive(pathname, search) : activeProp;

  return (
    <nav
      className="relative z-30 w-full shrink-0 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm"
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
            to="/login?alta=1"
            className={active === "registro" ? ACTIVE : INACTIVE}
            aria-current={active === "registro" ? "page" : undefined}
          >
            Primer acceso
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
          <Link to="/inicio" className={INACTIVE}>
            Inicio portal
          </Link>
        </li>
      </ul>
    </nav>
  );
}
