import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import { useCallback, useEffect, useState } from "react";

import {
  callHealthV2,
  callSyncSessionClaims,
} from "../../../services/callables.js";
import { authV2, dbV2 } from "../../../services/firebase.js";
import { formatCallableData, formatCallableError } from "../devMessageUtils.js";

const idleCall = { status: "idle" };

export function usePortalHome() {
  const [firestoreOp, setFirestoreOp] = useState({
    status: "loading",
    message: "Comprobando conexión con Firestore…",
  });
  const [user, setUser] = useState(null);
  const [userPending, setUserPending] = useState(true);
  const [callableMsg, setCallableMsg] = useState(null);
  const [callableOp, setCallableOp] = useState(idleCall);
  const [callableBusy, setCallableBusy] = useState(false);

  useEffect(
    () => onAuthStateChanged(authV2, (u) => {
        setUser(u);
        setUserPending(false);
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFirestoreOp({ status: "loading", message: "Comprobando conexión con Firestore…" });
      try {
        await getDoc(doc(dbV2, "_connectivity_probe", "ping"));
        if (cancelled) {
          return;
        }
        setFirestoreOp({
          status: "success",
          message: "Lectura permitida en la prueba (revisá reglas si esperabas reglas de solo denegación).",
        });
      } catch (e) {
        if (cancelled) {
          return;
        }
        if (e?.code === "permission-denied") {
          setFirestoreOp({
            status: "success",
            message: "Conexión correcta (Firestore respondió: reglas activas con permission-denied).",
          });
        } else {
          setFirestoreOp({
            status: "error",
            message: `Error de Firestore: ${e?.code || ""} ${e?.message || String(e)}`.trim(),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runHealth = useCallback(async () => {
    setCallableOp({ status: "loading", message: "Llamando a healthV2…" });
    setCallableMsg(null);
    setCallableBusy(true);
    const id = toast.loading("Consultando el servicio (base / functions)…");
    try {
      const res = await callHealthV2();
      const text = formatCallableData(res.data);
      setCallableMsg(text);
      setCallableOp({ status: "success", message: "Operación completada correctamente" });
      toast.success("Listo: healthV2 respondió correctamente", { id });
    } catch (e) {
      const err = formatCallableError(e);
      setCallableMsg(err);
      setCallableOp({ status: "error", message: err });
      toast.error("Error al contactar el servicio", { id });
    } finally {
      setCallableBusy(false);
    }
  }, []);

  const runSyncClaims = useCallback(async () => {
    if (!authV2.currentUser) {
      setCallableOp({ status: "error", message: "Iniciá sesión (email/contraseña) para probar syncSessionClaims." });
      toast.error("Iniciá sesión para actualizar permisos");
      return;
    }
    setCallableOp({ status: "loading", message: "Sincronizando claims y sesión…" });
    setCallableMsg(null);
    setCallableBusy(true);
    const id = toast.loading("Sincronizando permisos con el servidor…");
    try {
      const res = await callSyncSessionClaims();
      await authV2.currentUser.getIdToken(true);
      const text = formatCallableData({ ...res.data, nota: "Token refrescado (getIdToken true)." });
      setCallableMsg(text);
      setCallableOp({ status: "success", message: "Operación completada correctamente" });
      toast.success("Claims y token actualizados", { id });
    } catch (e) {
      const err = formatCallableError(e);
      setCallableMsg(err);
      setCallableOp({ status: "error", message: err });
      toast.error("Error al sincronizar permisos", { id });
    } finally {
      setCallableBusy(false);
    }
  }, []);

  return {
    projectId: import.meta.env.VITE_V2_FIREBASE_PROJECT_ID,
    authAppName: authV2?.app?.name,
    user,
    userPending,
    firestoreOp,
    callableOp,
    callableMsg,
    callableBusy,
    runHealth,
    runSyncClaims,
  };
}
