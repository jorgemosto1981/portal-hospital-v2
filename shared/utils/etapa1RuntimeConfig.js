/**
 * Etapa 1 vida real — constantes y reglas puras (feature flags / allowlist).
 * @see docs/v2/ETAPA1_GO_LIVE_V2.md
 */

/** Colección + doc id runtime */
export const CFG_ETAPA1_COLLECTION = "cfg_etapa1";
export const CFG_ETAPA1_RUNTIME_DOC = "runtime";

/** Arts Etapa 1 conocidos (CAMBIO-DIA se agrega al seed cuando exista art_*) */
export const ARTICULO_64A_ETAPA1_ID = "art_01KRNK10V10CH7W5M2W6V558GS";
export const ARTICULO_64B_ETAPA1_ID = "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ";
export const ARTICULO_63J_ETAPA1_ID = "art_01KVWVW9Z50VR6T1BC6J0R3YQ8";
export const ARTICULO_LAO_ID = "art_01KRNYDN5WR7RER7MWXRZ817E7";

/** Defaults si falta el doc (fail-safe: superficies cerradas, piloto off) */
export const ETAPA1_RUNTIME_DEFAULTS = Object.freeze({
  etapa1_habilitada: false,
  /** true = filtrar catálogo aunque piloto off (uso puntual Soft Launch prep). Soft Launch real: activar etapa1_habilitada. */
  forzar_catalogo_etapa1: false,
  gdt_ids_etapa1: /** @type {string[]} */ ([]),
  articulo_ids_etapa1: [
    ARTICULO_64A_ETAPA1_ID,
    ARTICULO_64B_ETAPA1_ID,
    ARTICULO_63J_ETAPA1_ID,
  ],
  persona_ids_ops_bypass: /** @type {string[]} */ ([]),
  jefe_gso_habilitado: false,
  lao_habilitada: false,
  licencias_medicas_habilitadas: false,
});

/**
 * @param {unknown} raw
 * @returns {typeof ETAPA1_RUNTIME_DEFAULTS & Record<string, unknown>}
 */
export function normalizeEtapa1Runtime(raw) {
  const d = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const strArr = (v) =>
    Array.isArray(v) ? [...new Set(v.map((x) => String(x || "").trim()).filter(Boolean))] : [];

  return {
    ...ETAPA1_RUNTIME_DEFAULTS,
    etapa1_habilitada: d.etapa1_habilitada === true,
    forzar_catalogo_etapa1:
      d.forzar_catalogo_etapa1 === undefined
        ? ETAPA1_RUNTIME_DEFAULTS.forzar_catalogo_etapa1
        : d.forzar_catalogo_etapa1 === true,
    gdt_ids_etapa1: strArr(d.gdt_ids_etapa1),
    articulo_ids_etapa1: strArr(d.articulo_ids_etapa1).length
      ? strArr(d.articulo_ids_etapa1)
      : [...ETAPA1_RUNTIME_DEFAULTS.articulo_ids_etapa1],
    persona_ids_ops_bypass: strArr(d.persona_ids_ops_bypass),
    jefe_gso_habilitado: d.jefe_gso_habilitado === true,
    lao_habilitada: d.lao_habilitada === true,
    licencias_medicas_habilitadas: d.licencias_medicas_habilitadas === true,
  };
}

/**
 * @param {ReturnType<typeof normalizeEtapa1Runtime>} cfg
 * @param {string} personaId
 * @param {{ esRrhh?: boolean }} [opts]
 */
export function personaEnBypassOpsEtapa1(cfg, personaId, opts = {}) {
  const pid = String(personaId || "").trim();
  if (!pid) return false;
  if (opts.esRrhh === true) return true;
  return (cfg.persona_ids_ops_bypass || []).includes(pid);
}

/**
 * GDT allowlist solo con piloto activo y lista no vacía.
 * @param {ReturnType<typeof normalizeEtapa1Runtime>} cfg
 * @param {string} personaId
 * @param {Array<{ grupo_de_trabajo_id?: string }>} hlcVigentes
 * @param {{ esRrhh?: boolean }} [opts]
 */
export function personaPermitidaCircuitoEtapa1(cfg, personaId, hlcVigentes, opts = {}) {
  if (personaEnBypassOpsEtapa1(cfg, personaId, opts)) return true;
  if (!cfg.etapa1_habilitada) return true;
  const allow = cfg.gdt_ids_etapa1 || [];
  if (!allow.length) return false;
  const set = new Set(allow);
  const rows = Array.isArray(hlcVigentes) ? hlcVigentes : [];
  return rows.some((h) => set.has(String(h?.grupo_de_trabajo_id || "").trim()));
}

/**
 * @param {ReturnType<typeof normalizeEtapa1Runtime>} cfg
 */
export function debeFiltrarCatalogoEtapa1(cfg) {
  return cfg.etapa1_habilitada === true || cfg.forzar_catalogo_etapa1 === true;
}

/**
 * @param {ReturnType<typeof normalizeEtapa1Runtime>} cfg
 * @param {string} articuloId
 */
export function articuloPermitidoEtapa1(cfg, articuloId) {
  const id = String(articuloId || "").trim();
  if (!id) return false;
  if (!debeFiltrarCatalogoEtapa1(cfg)) return true;
  if (id === ARTICULO_LAO_ID && cfg.lao_habilitada !== true) return false;
  return (cfg.articulo_ids_etapa1 || []).includes(id);
}

/**
 * @param {ReturnType<typeof normalizeEtapa1Runtime>} cfg
 * @param {Record<string, unknown>} articuloRow — fila listado (puede traer modo_licencia_medica_id)
 */
export function articuloFilaPermitidaEtapa1(cfg, articuloRow) {
  const id = String(articuloRow?.articulo_id || "").trim();
  if (!articuloPermitidoEtapa1(cfg, id)) return false;
  if (cfg.licencias_medicas_habilitadas === true) return true;
  const modoLm = String(articuloRow?.modo_licencia_medica_id || "").trim();
  if (modoLm) return false;
  if (articuloRow?.requiere_causal_larga === true) return false;
  return true;
}
