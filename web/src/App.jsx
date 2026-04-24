import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import { callHealthV2, callSyncSessionClaims } from "./services/callables.js";
import { authV2, dbV2 } from "./services/firebase.js";

import "./App.css";

export default function App() {
  const [firestoreMsg, setFirestoreMsg] = useState("Comprobando Firestore…");
  const [user, setUser] = useState(null);
  const [userPending, setUserPending] = useState(true);
  const [callableMsg, setCallableMsg] = useState(null);
  const [callableBusy, setCallableBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(authV2, (u) => {
      setUser(u);
      setUserPending(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDoc(doc(dbV2, "_connectivity_probe", "ping"));
        if (!cancelled) {
          setFirestoreMsg("Lectura permitida en la prueba (revisá reglas si esperabas deny-all).");
        }
      } catch (e) {
        if (!cancelled) {
          if (e?.code === "permission-denied") {
            setFirestoreMsg("Firestore OK (permission-denied: reglas activas).");
          } else {
            setFirestoreMsg(`Firestore: ${e?.code || ""} ${e?.message || String(e)}`);
          }
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
      setCallableMsg(JSON.stringify(res.data, null, 2));
    } catch (e) {
      setCallableMsg(`Error: ${e?.code || ""} ${e?.message || String(e)}`);
    } finally {
      setCallableBusy(false);
    }
  }, []);

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
      setCallableMsg(JSON.stringify({ ...res.data, nota: "Token refrescado (getIdToken true)." }, null, 2));
    } catch (e) {
      setCallableMsg(`Error: ${e?.code || ""} ${e?.message || String(e)}`);
    } finally {
      setCallableBusy(false);
    }
  }, []);

  return (
    <main className="shell">
      <h1>Portal Hospital V2</h1>
      <p className="muted">App web nueva · Firebase SDK compartido desde la raíz del repo.</p>
      <section className="card">
        <h2>Estado</h2>
        <dl>
          <dt>Proyecto</dt>
          <dd>
            <code>{import.meta.env.VITE_V2_FIREBASE_PROJECT_ID}</code>
          </dd>
          <dt>Auth app</dt>
          <dd>
            <code>{authV2?.app?.name}</code>
          </dd>
          <dt>Sesión</dt>
          <dd>
            {userPending ? (
              "…"
            ) : user ? (
              <>
                <code>{user.uid}</code>
                {user.email ? (
                  <>
                    {" "}
                    · <code>{user.email}</code>
                  </>
                ) : null}
              </>
            ) : (
              "Sin sesión"
            )}
          </dd>
          <dt>Firestore</dt>
          <dd>{firestoreMsg}</dd>
        </dl>
      </section>

      <section className="card devPanel">
        <h2>Desarrollo — Callables</h2>
        <p className="muted small">
          Con emulador: en <code>.env.v2.local</code> poné <code>VITE_V2_USE_FUNCTIONS_EMULATOR=true</code> y levantá{" "}
          <code>npm run firebase:emulators:with-functions</code>.
        </p>
        <div className="btnRow">
          <button type="button" className="btn" disabled={callableBusy} onClick={runHealth}>
            healthV2
          </button>
          <button type="button" className="btn" disabled={callableBusy || !user} onClick={runSyncClaims}>
            syncSessionClaims
          </button>
        </div>
        {callableMsg ? (
          <pre className="callableOut" role="status">
            {callableMsg}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
