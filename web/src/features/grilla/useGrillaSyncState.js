import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { dbV2 } from "../../services/firebase.js";
import { buildGrillaSyncGrupoMesDocId, fechaDesdeFirestore } from "./grillaSyncGrupoMesDocId.js";

/**
 * @typedef {{
 *   estado: string;
 *   existe: boolean;
 *   docId: string;
 *   ultimoOkAt: Date | null;
 *   solicitadoAt: Date | null;
 *   errorMensaje: string | null;
 *   metadata: Record<string, unknown> | null;
 *   listenerError: string | null;
 * }} GrillaSyncSnapshot
 */

/**
 * Escucha `grilla_sync_grupo_mes/{docId}` (lectura autenticada).
 * @param {{ grupoTrabajoId?: string; periodoYm?: string; enabled?: boolean }} opts
 */
export function useGrillaSyncState({ grupoTrabajoId = "", periodoYm = "", enabled = true }) {
  const docId = useMemo(
    () => buildGrillaSyncGrupoMesDocId(grupoTrabajoId, periodoYm),
    [grupoTrabajoId, periodoYm],
  );

  const [snap, setSnap] = useState(/** @type {GrillaSyncSnapshot} */ ({
    estado: "idle",
    existe: false,
    docId: "",
    ultimoOkAt: null,
    solicitadoAt: null,
    errorMensaje: null,
    metadata: null,
    listenerError: null,
  }));

  useEffect(() => {
    if (!enabled || !docId) {
      setSnap({
        estado: "idle",
        existe: false,
        docId: "",
        ultimoOkAt: null,
        solicitadoAt: null,
        errorMensaje: null,
        metadata: null,
        listenerError: null,
      });
      return;
    }

    const ref = doc(dbV2, "grilla_sync_grupo_mes", docId);
    const unsub = onSnapshot(
      ref,
      (ds) => {
        if (!ds.exists()) {
          setSnap({
            estado: "idle",
            existe: false,
            docId,
            ultimoOkAt: null,
            solicitadoAt: null,
            errorMensaje: null,
            metadata: null,
            listenerError: null,
          });
          return;
        }
        const data = ds.data() || {};
        const err = data.error && typeof data.error === "object" ? data.error : null;
        setSnap({
          estado: String(data.estado || "idle"),
          existe: true,
          docId,
          ultimoOkAt: fechaDesdeFirestore(data.ultimo_ok_at),
          solicitadoAt: fechaDesdeFirestore(data.solicitado_at),
          errorMensaje: err?.mensaje ? String(err.mensaje) : null,
          metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : null,
          listenerError: null,
        });
      },
      (e) => {
        setSnap((prev) => ({
          ...prev,
          docId,
          listenerError: e?.message || "No se pudo escuchar el estado de sincronización.",
        }));
      },
    );

    return () => unsub();
  }, [enabled, docId]);

  const sincronizando = snap.estado === "pendiente" || snap.estado === "en_curso";

  return {
    ...snap,
    docId: docId || snap.docId,
    sincronizando,
  };
}
