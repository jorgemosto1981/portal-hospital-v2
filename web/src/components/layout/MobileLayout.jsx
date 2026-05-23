import AppBrandHeader from "./AppBrandHeader.jsx";
import BottomNavigationBar from "./BottomNavigationBar.jsx";
import PublicAuthMenu from "./PublicAuthMenu.jsx";

const DEFAULT_ACTIVE_TAB = "inicio";

/**
 * Móvil-first: columna + barra inferior; `md+` el mismo `BottomNavigationBar` actúa como
 * **sidebar** (mismo componente, clases distintas). `lg+` aún más ancho útil en el marco.
 * Scroll: el contenido entre cabecera y barra vive en un único contenedor `overflow-y-auto`
 * para que en móviles el desplazamiento vertical no quede bloqueado.
 * En móvil (antes de `sm`) el marco usa `h-dvh` + `min-h-0` (no solo `min-h-dvh`) para no expandir
 * el documento y evitar que el navegador priorice pan horizontal por desbordes de ancho.
 * `overflow-anchor: none` evita avisos de Chrome (“anclaje deshabilitado…”) con HMR/contenido dinámico.
 */
export default function MobileLayout({
  children,
  activeTab = DEFAULT_ACTIVE_TAB,
  onTabChange,
  /** Solo desarrollo: aviso cuando `VITE_BYPASS_AUTH=true` y no hay sesión. */
  devBypassAuth = false,
}) {
  return (
    <div
      className="flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-slate-100 sm:min-h-dvh sm:max-h-none sm:h-auto sm:overflow-visible sm:items-center sm:justify-center sm:px-4 sm:py-6 md:items-stretch md:justify-start md:px-0 md:py-0"
      data-mobile-layout
    >
      <div
        className="mx-auto flex h-full min-h-0 w-full min-w-0 max-w-md flex-1 flex-col overflow-x-hidden border-slate-100 bg-slate-50 sm:max-h-[min(100dvh,52rem)] sm:min-h-[min(100dvh,52rem)] sm:h-auto sm:shrink-0 sm:rounded-3xl sm:border sm:border-slate-100 sm:shadow-md md:mx-6 md:my-4 md:max-h-[calc(100dvh-2rem)] md:max-w-6xl md:rounded-2xl md:shadow-lg lg:max-w-7xl"
        data-mobile-shell
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
          <main
            className="order-1 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:order-2"
            id="app-main-scroll"
          >
            {devBypassAuth ? <PublicAuthMenu active="none" /> : null}
            <AppBrandHeader />
            {devBypassAuth && (
              <p
                className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] leading-tight text-amber-950"
                role="status"
              >
                Modo sin login — <span className="font-mono">VITE_BYPASS_AUTH</span>. No usar en
                producción.
              </p>
            )}
            <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y [overflow-anchor:none]">
              <div className="min-w-0 w-full max-w-full flex-1">{children}</div>
            </div>
          </main>
          <BottomNavigationBar activeTab={activeTab} onTabChange={onTabChange} />
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_ACTIVE_TAB };
