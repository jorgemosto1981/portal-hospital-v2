import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import toast from "react-hot-toast";

import {
  MSG_BLOQUEO_COLA_PENDIENTE,
  registrarBloqueoColaPendiente,
} from "./cargaManualNavigationGuard.js";

/**
 * Impide salir de la pantalla si hay pendientes: cierre de pestaña, tabs del portal,
 * enlaces internos y botón Atrás.
 * @param {boolean} activo
 */
export function useBloqueoSalidaColaPendiente(activo) {
  useEffect(() => {
    registrarBloqueoColaPendiente(activo);
    return () => registrarBloqueoColaPendiente(false);
  }, [activo]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      activo && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    toast.error(MSG_BLOQUEO_COLA_PENDIENTE, { duration: 5000 });
    blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!activo) return;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClickCapture = (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.getAttribute("target") === "_blank") return;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || /^https?:/i.test(href)) return;
      const destino = href.split("?")[0];
      if (destino === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      toast.error(MSG_BLOQUEO_COLA_PENDIENTE, { duration: 5000 });
    };

    window.history.pushState({ colaPendiente: true }, "", window.location.href);
    const onPopState = () => {
      window.history.pushState({ colaPendiente: true }, "", window.location.href);
      toast.error(MSG_BLOQUEO_COLA_PENDIENTE, { duration: 5000 });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [activo]);
}
