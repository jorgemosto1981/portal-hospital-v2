/**
 * Esquemas ligeros (JSDoc) alineados a `docs/v2/` y `web/SCHEMA.md`.
 * Sin runtime; el IDE ofrece autocompletar si el proyecto acepta checkJs.
 * Próximo paso opcional: migrar a .ts o Zod.
 */

/**
 * @typedef {`cfg_eca_pend_reg` | `cfg_eca_onb` | `cfg_eca_pend_mail` | `cfg_eca_activo` | `cfg_eca_bloq`} CfgEstadoCuentaAccesoId
 * @typedef {`cfg_epd_borr` | `cfg_epd_inc` | `cfg_epd_comp` | `cfg_epd_rec`} CfgEstadoPerfilDatosId
 * @typedef {`per_${string}`} PersonaDocId
 * @typedef {`usr_${string}`} UsuarioCuentaDocId
 * @typedef {`evt_${string}`} EventoTicketDocId
 */

export const V2_TYPES_VERSION = 1;
