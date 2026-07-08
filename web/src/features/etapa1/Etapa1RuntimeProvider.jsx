/**
 * Provider + hooks para cfg_etapa1/runtime (feature flags Etapa 1).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, getDoc } from "firebase/firestore";

import { dbV2 } from "../../services/firebase.js";
import {
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
  ETAPA1_RUNTIME_DEFAULTS,
  normalizeEtapa1Runtime,
} from "../../../../shared/utils/etapa1RuntimeConfig.js";

const Etapa1RuntimeContext = createContext(null);

export function Etapa1RuntimeProvider({ children }) {
  const [cfg, setCfg] = useState(() => normalizeEtapa1Runtime(ETAPA1_RUNTIME_DEFAULTS));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDoc(doc(dbV2, CFG_ETAPA1_COLLECTION, CFG_ETAPA1_RUNTIME_DOC));
      setCfg(normalizeEtapa1Runtime(snap.exists() ? snap.data() : null));
    } catch (e) {
      setError(e?.message || "No se pudo leer cfg Etapa 1");
      setCfg(normalizeEtapa1Runtime(ETAPA1_RUNTIME_DEFAULTS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      cfg,
      loading,
      error,
      reload,
      jefeGsoHabilitado: cfg.jefe_gso_habilitado === true,
      laoHabilitada: cfg.lao_habilitada === true,
      licenciasMedicasHabilitadas: cfg.licencias_medicas_habilitadas === true,
    }),
    [cfg, loading, error, reload],
  );

  return <Etapa1RuntimeContext.Provider value={value}>{children}</Etapa1RuntimeContext.Provider>;
}

export function useEtapa1Runtime() {
  const ctx = useContext(Etapa1RuntimeContext);
  if (!ctx) {
    throw new Error("useEtapa1Runtime debe usarse dentro de Etapa1RuntimeProvider");
  }
  return ctx;
}

/** Safe fuera de provider (defaults). */
export function useEtapa1RuntimeOptional() {
  return useContext(Etapa1RuntimeContext);
}
