import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import {
  callHealthV2,
  callRegistroPrimerAcceso,
  callRrhhAltaAgente,
  callSyncSessionClaims,
} from "../../../services/callables.js";
import { authV2, dbV2 } from "../../../services/firebase.js";
import { formatCallableData, formatCallableError } from "../devMessageUtils.js";

export function usePortalHome() {
  const [firestoreMsg, setFirestoreMsg] = useState("Comprobando Firestore…");
  const [user, setUser] = useState(null);
  const [userPending, setUserPending] = useState(true);
  const [callableMsg, setCallableMsg] = useState(null);
  const [callableBusy, setCallableBusy] = useState(false);
  const [rrhhDni, setRrhhDni] = useState("");
  const [rrhhNom, setRrhhNom] = useState("");
  const [rrhhApe, setRrhhApe] = useState("");
  const [regDni, setRegDni] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPin, setRegPin] = useState("");

  useEffect(() => onAuthStateChanged(authV2, (u) => {
    setUser(u);
    setUserPending(false);
  }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDoc(doc(dbV2, "_connectivity_probe", "ping"));
        if (!cancelled) {
          setFirestoreMsg("Lectura permitida en la prueba (revisá reglas si esperabas deny-all).");
        }
      } catch (e) {
        if (cancelled) {
          return;
        }
        if (e?.code === "permission-denied") {
          setFirestoreMsg("Firestore OK (permission-denied: reglas activas).");
        } else {
          setFirestoreMsg(`Firestore: ${e?.code || ""} ${e?.message || String(e)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runHealth = useCallback(async () => {
    setCallableBusy(true);
    setCallableMsg(null);
    try {
      const res = await callHealthV2();
      setCallableMsg(formatCallableData(res.data));
    } catch (e) {
      setCallableMsg(formatCallableError(e));
    } finally {
      setCallableBusy(false);
    }
  }, []);

  const runRrhhAlta = useCallback(async () => {
    if (!authV2.currentUser) {
      setCallableMsg("Iniciá sesión con un usuario con claim `portal_role: \"rrhh\"` (Admin SDK) para probar `rrhhAltaAgente`.");
      return;
    }
    setCallableBusy(true);
    setCallableMsg(null);
    try {
      const res = await callRrhhAltaAgente({ dni: rrhhDni, nombre: rrhhNom, apellido: rrhhApe });
      setCallableMsg(formatCallableData(res.data));
    } catch (e) {
      setCallableMsg(formatCallableError(e));
    } finally {
      setCallableBusy(false);
    }
  }, [rrhhDni, rrhhNom, rrhhApe]);

  const runPasoB = useCallback(async () => {
    setCallableBusy(true);
    setCallableMsg(null);
    try {
      const res = await callRegistroPrimerAcceso({ dni: regDni, email: regEmail, pin: regPin });
      setCallableMsg(formatCallableData(res.data));
    } catch (e) {
      setCallableMsg(formatCallableError(e));
    } finally {
      setCallableBusy(false);
    }
  }, [regDni, regEmail, regPin]);

  const runSyncClaims = useCallback(async () => {
    if (!authV2.currentUser) {
      setCallableMsg("Iniciá sesión (email/contraseña) para probar syncSessionClaims.");
      return;
    }
    setCallableBusy(true);
    setCallableMsg(null);
    try {
      const res = await callSyncSessionClaims();
      await authV2.currentUser.getIdToken(true);
      setCallableMsg(
        formatCallableData({ ...res.data, nota: "Token refrescado (getIdToken true)." }),
      );
    } catch (e) {
      setCallableMsg(formatCallableError(e));
    } finally {
      setCallableBusy(false);
    }
  }, []);

  return {
    projectId: import.meta.env.VITE_V2_FIREBASE_PROJECT_ID,
    authAppName: authV2?.app?.name,
    user,
    userPending,
    firestoreMsg,
    callableMsg,
    callableBusy,
    rrhh: { dni: rrhhDni, setDni: setRrhhDni, nom: rrhhNom, setNom: setRrhhNom, ape: rrhhApe, setApe: setRrhhApe },
    reg: { dni: regDni, setDni: setRegDni, email: regEmail, setEmail: setRegEmail, pin: regPin, setPin: setRegPin },
    runHealth,
    runRrhhAlta,
    runPasoB,
    runSyncClaims,
  };
}
