import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { authV2, dbV2 } from "./services/firebase.js";

import "./App.css";

export default function App() {
  const [firestoreMsg, setFirestoreMsg] = useState("Comprobando Firestore…");

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
          <dt>Firestore</dt>
          <dd>{firestoreMsg}</dd>
        </dl>
      </section>
    </main>
  );
}
