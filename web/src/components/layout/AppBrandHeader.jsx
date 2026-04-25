import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";

/**
 * Cabecera de marca: logo institucional + título del sistema (móvil y escritorio).
 */
export default function AppBrandHeader() {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 md:px-5">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 lg:max-w-6xl">
        <img
          src={LOGO_SRC}
          alt={INSTITUTION_NAME}
          className="h-10 w-auto max-h-12 max-w-[10rem] shrink-0 object-contain sm:h-11"
          loading="eager"
          decoding="async"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug tracking-tight text-slate-900 md:text-lg">
            {APP_TITLE}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{INSTITUTION_NAME}</p>
        </div>
      </div>
    </header>
  );
}
