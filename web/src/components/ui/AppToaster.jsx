import { Toaster } from "react-hot-toast";

/**
 * Toaster global: estilos alineados con la app (slate / verde / rojo), sin `px` fijos.
 */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerClassName="!font-sans"
      toastOptions={{
        duration: 4000,
        className: "!text-sm !shadow-md !rounded-xl !border !border-slate-100 !text-slate-900",
        success: {
          className: "!text-emerald-900 !border-emerald-200 !bg-emerald-50",
          iconTheme: { primary: "#059669", secondary: "#ecfdf5" },
        },
        error: {
          className: "!text-red-900 !border-red-200 !bg-red-50",
          iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
        },
        loading: {
          className: "!text-slate-800 !border-slate-200 !bg-white",
        },
      }}
    />
  );
}
