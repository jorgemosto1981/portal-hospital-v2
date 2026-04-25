import AppBrandHeader from "./AppBrandHeader.jsx";
import BottomNavigationBar from "./BottomNavigationBar.jsx";

const DEFAULT_ACTIVE_TAB = "inicio";

/**
 * Móvil-first: columna + barra inferior; `md+` el mismo `BottomNavigationBar` actúa como
 * **sidebar** (mismo componente, clases distintas). `lg+` aún más ancho útil en el marco.
 */
export default function MobileLayout({
  children,
  activeTab = DEFAULT_ACTIVE_TAB,
  onTabChange,
}) {
  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-slate-100 sm:items-center sm:justify-center sm:py-6 sm:px-4 md:items-stretch md:justify-start md:px-0 md:py-0"
      data-mobile-layout
    >
      <div
        className="mx-auto flex h-dvh w-full min-h-0 max-w-md flex-1 flex-col overflow-hidden border-slate-100 bg-slate-50 sm:h-[min(100dvh,52rem)] sm:min-h-0 sm:max-h-[min(100dvh,52rem)] sm:shrink-0 sm:overflow-hidden sm:rounded-3xl sm:border sm:border-slate-100 sm:shadow-md md:my-4 md:mx-6 md:h-[min(100dvh,64rem)] md:max-h-[calc(100dvh-2rem)] md:max-w-6xl md:min-h-0 md:overflow-hidden md:rounded-2xl md:shadow-lg lg:max-w-7xl"
        data-mobile-shell
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
          <main
            className="order-1 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain md:order-2"
            id="app-main-scroll"
          >
            <AppBrandHeader />
            <div className="min-h-0 flex-1">{children}</div>
          </main>
          <BottomNavigationBar activeTab={activeTab} onTabChange={onTabChange} />
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_ACTIVE_TAB };
