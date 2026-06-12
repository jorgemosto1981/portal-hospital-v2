export {
  MASCARA_RELOJ_DEFAULT,
  extraerCamposSegunMascara,
  segmentarMascaraTokens,
  normalizarMascaraTokens,
  esMascaraParserV1,
} from "../../../../../shared/utils/mascaraTokensReloj.js";

export const CATALOGO_TOKENS_MASCARA = [
  { token: "TTTTT…", significado: "Número de tarjeta del agente", ejemplo: "09432" },
  { token: "DD/MM/YY", significado: "Fecha día/mes/año corto", ejemplo: "12/06/26" },
  { token: "DDMMYY", significado: "Fecha compacta (sin separadores)", ejemplo: "120626" },
  { token: "YYYY-MM-DD", significado: "Fecha ISO", ejemplo: "2026-06-12" },
  { token: "HH:MM", significado: "Hora:minutos", ejemplo: "14:30" },
  { token: "HHMM", significado: "Hora compacta (sin dos puntos)", ejemplo: "1430" },
  { token: "RRR…", significado: "Código del reloj / dispositivo", ejemplo: "001" },
  { token: "CC…", significado: "Código función (ingreso/egreso)", ejemplo: "01" },
];

export const EJEMPLOS_MASCARA_RAPIDOS = [
  {
    id: "plano",
    label: "Plano compacto",
    linea: "998231206261430001",
    mascara: "TTTTTDDMMYYHHMMRRR",
  },
  {
    id: "espacios",
    label: "Con espacios (default)",
    linea: "00123 13/06/26 06:05 001 01",
    mascara: "TTTTT DD/MM/YY HH:MM RRR CC",
  },
  {
    id: "comas",
    label: "Con comas",
    linea: "12543,12/06/26,22:05,02",
    mascara: "TTTTT,DD/MM/YY,HH:MM,CC",
  },
];
