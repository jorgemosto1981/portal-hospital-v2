/**
 * Copy SSoT — modal ayuda «Configuración de la bolsa» (RFC §7, GUIA_RRHH, CASOS_BORDE).
 * @see docs/v2/RFC_SALDOS_PATRONES_ABC_V2.md
 */

export const AYUDA_PATRONES_DOC_VERSION = "2026-05-16";
export const AYUDA_PATRONES_SCHEMA_VERSION = 1;

export const AYUDA_PATRONES_TABS = [
  { id: "guia", label: "Guía A/B/C" },
  { id: "rrhh", label: "Resumen RRHH" },
  { id: "casos", label: "Casos borde" },
];

/** @type {{ titulo: string, intro?: string, patrones: { id: string, nombre: string, descripcion: string, bullets: { label: string, texto: string }[] }[] }} */
export const AYUDA_GUIA_PATRONES_BOLSA_SALDO = {
  titulo: "Guía de configuración de saldos",
  intro:
    "El sistema enruta automáticamente el comportamiento de las bolsas según el momento de reseteo y el origen de los días en esta versión del artículo.",
  patrones: [
    {
      id: "A",
      nombre: "Patrón A — Stock acumulativo multi-año (ej. LAO)",
      descripcion:
        "Licencias que acumulan días a favor y no vencen al cerrar el año calendario. Las bolsas históricas siguen vivas hasta agotarse.",
      bullets: [
        {
          label: "Momento de reseteo",
          texto: "Sin reinicio automático. El saldo no vuelve a cero el 31 de diciembre.",
        },
        {
          label: "De dónde salen los días",
          texto:
            "Bolsa interna (portal). El sistema calcula el derecho (antigüedad). En carga histórica RRHH puede informar saldos pasados; el artículo sigue siendo interno.",
        },
      ],
    },
    {
      id: "B",
      nombre: "Patrón B — Topes cíclicos (ej. 64-A, exámenes)",
      descripcion:
        "Permisos con límite fijo por período. Al terminar el ciclo, el cupo no usado caduca y se abre uno nuevo.",
      bullets: [
        {
          label: "Momento de reseteo",
          texto: "Reinicio anual, mensual o diario. El marcador del ciclo se renueva al cambiar el período.",
        },
        {
          label: "De dónde salen los días",
          texto:
            "Bolsa interna (portal). El cupo fijo (ej. 6 días anuales) se define en los parámetros de esta versión.",
        },
      ],
    },
    {
      id: "C",
      nombre: "Patrón C — Cuenta corriente continua (ej. francos)",
      descripcion: "Días u horas por esfuerzo extra. No se reinician por el solo cambio de año.",
      bullets: [
        {
          label: "Momento de reseteo",
          texto: "Sin reinicio automático. Lo ganado en diciembre se traslada a enero.",
        },
        {
          label: "De dónde salen los días",
          texto:
            "Externo informado (carga RRHH) o externo calculado (fichadas). El portal no inventa el crédito.",
        },
      ],
    },
  ],
};

/** @type {{ titulo: string, secciones: { titulo: string, parrafos?: string[], lista?: string[] }[] }} */
export const AYUDA_RESUMEN_RRHH_SALDOS = {
  titulo: "Resumen para RRHH",
  secciones: [
    {
      titulo: "Resumen contable",
      parrafos: [
        "El agente ve un resumen simplificado vía servidor (Callable). RRHH accede a la auditoría completa del marcador por persona.",
      ],
      lista: [
        "Bolsas activas: por artículo y año de origen (A), ciclo (B) o global (C), con disponible y consumido.",
        "Bolsas expiradas o agotadas: sección colapsable con historial reciente (≈24 meses).",
      ],
    },
    {
      titulo: "Ajustes manuales",
      lista: [
        "No editar contadores del marcador en consola ni en pantalla.",
        "Usar formulario de ajuste: artículo, año de bolsa, delta (+/−) y justificación (mín. 15 caracteres).",
        "El sistema genera sol_ajuste_rrhh y actualiza el marcador por trigger.",
      ],
    },
    {
      titulo: "Retroactivo sobre bolsa expirada",
      parrafos: [
        "El agente no inicia trámites contra bolsas expiradas. RRHH puede, con motivo y auditoría, si hay remanente.",
        "Si disponible es 0, primero un ajuste manual de crédito y después el trámite.",
      ],
    },
  ],
};

/** @type {{ titulo: string, casos: { id: string, nombre: string, comportamiento: string, tecnico: string }[] }} */
export const AYUDA_CASOS_BORDE_SALDOS = {
  titulo: "Casos borde de saldos (1–8)",
  casos: [
    {
      id: "1",
      nombre: "Cruce de año calendario",
      comportamiento: "Prohibido en una misma solicitud.",
      tecnico: "UI y backend bloquean si año(fecha_desde) ≠ año(fecha_hasta). Dos tickets separados.",
    },
    {
      id: "2",
      nombre: "Horizonte temporal",
      comportamiento: "Agente: mes actual + mes siguiente. RRHH: sin límite, con advertencia.",
      tecnico: "DatePicker y validación en Functions.",
    },
    {
      id: "3",
      nombre: "Anulación / FIFO reverso",
      comportamiento: "Los días vuelven a las bolsas de origen (LAO).",
      tecnico: "Metadato _debito_origen en sol_*; trigger de reverso atómico.",
    },
    {
      id: "4",
      nombre: "Feriados y asuetos",
      comportamiento: "Cómputo hábil según calendario institucional unificado.",
      tecnico: "Cruce con cfg_calendario_feriados_institucional (cfg_cal_YYYY).",
    },
    {
      id: "5",
      nombre: "Pluriempleo",
      comportamiento: "Todo se imputa a la persona (legajo), no al cargo.",
      tecnico: "Sin cargo_id en llaves sal_YYYY_per_* ni sal_global_per_*.",
    },
    {
      id: "6",
      nombre: "Cierre con pendientes",
      comportamiento: "El job de cierre no espera a jefatura.",
      tecnico: "Consumo al iniciar trámite; reverso post-cierre en bolsa expirada.",
    },
    {
      id: "7",
      nombre: "Ajustes post-check-in",
      comportamiento: "Sin edición directa del marcador.",
      tecnico: "sol con cfg_esa_ajuste_rrhh + trigger de delta.",
    },
    {
      id: "8",
      nombre: "LAO + enfermedad",
      comportamiento: "Alerta RRHH; corte manual (fase 1).",
      tecnico: "Fase 2: recorte, reverso FIFO y habilitación médica.",
    },
  ],
};

/**
 * @param {string} tabId
 * @returns {string}
 */
export function ayudaPatronesTabLabel(tabId) {
  return AYUDA_PATRONES_TABS.find((t) => t.id === tabId)?.label ?? tabId;
}
