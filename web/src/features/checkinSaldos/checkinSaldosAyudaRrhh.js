/**
 * Copy operativo RRHH — pantalla Check-in de saldos.
 * @see docs/v2/HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md
 */

import { CHECKIN_COPY_ANIO_A } from "../../../../shared/utils/laoVersionResolver.js";

export const CHECKIN_AYUDA_DOC_VERSION = "2026-05-18";

export const CHECKIN_AYUDA_TABS = [
  { id: "objetivo", label: "Objetivo" },
  { id: "flujo", label: "Flujo" },
  { id: "patrones", label: "A / B / C" },
  { id: "validaciones", label: "Validaciones" },
];

/** @param {string} tabId */
export function checkinAyudaTabLabel(tabId) {
  return CHECKIN_AYUDA_TABS.find((t) => t.id === tabId)?.label ?? tabId;
}

/** @type {{ titulo: string, parrafos: string[], lista?: string[] }} */
export const CHECKIN_AYUDA_OBJETIVO = {
  titulo: "¿Para qué sirve esta pantalla?",
  parrafos: [
    "Registrá la fotografía inicial de saldos del agente en el portal: licencias históricas (LAO y similares), ciclos anuales (64-A, exámenes) y cuentas continuas (francos, etc.).",
    "Es el acto formal de activación de saldos para el portal V2. No reemplaza la carga de datos laborales ni de HLC: esas piezas deben estar listas antes del check-in nuevo.",
    "La guía de alta RRHH considera el paso «check-in» completo solo cuando existe cierre global (campo checkin_saldos_portal_en en la persona).",
  ],
  lista: [
    "Ruta: /portal/rrhh/checkin-saldos",
    "Solo personal con rol RRHH",
    "Al cambiar de agente, el formulario se reinicia",
  ],
};

/** @type {{ titulo: string, pasos: { orden: string, texto: string }[] }} */
export const CHECKIN_AYUDA_FLUJO = {
  titulo: "Orden recomendado del operador",
  pasos: [
    { orden: "1", texto: "Buscar y elegir el agente (DNI, nombre o ID per_*)." },
    { orden: "2", texto: "Indicar el año de corte A (año calendario de go-live del portal para esa persona)." },
    {
      orden: "3",
      texto:
        "Si el agente ya tiene bolsas o check-in previo, elegir Check-in nuevo o Rectificación. Si el cierre global ya está hecho, usá Rectificación (o marcá recarga autorizada en el banner).",
    },
    {
      orden: "4",
      texto: "En check-in nuevo: confirmar que las HLC operativas están cargadas (casilla obligatoria).",
    },
    {
      orden: "5",
      texto: "Completar pestañas LAO (A), Ciclos anuales (B) y Cuenta continua (C). Guardado parcial por pestaña: solo persiste lo que informaste.",
    },
    {
      orden: "6",
      texto:
        "En check-in nuevo: Finalizar check-in global (modal en 3 pasos). Lee las advertencias y confirmá cada ítem antes de cerrar.",
    },
  ],
};

/** @type {{ titulo: string, patrones: { id: string, nombre: string, queCargar: string, validaciones: string[] }[] }} */
export const CHECKIN_AYUDA_PATRONES = {
  titulo: "Qué cargar en cada pestaña",
  patrones: [
    {
      id: "A",
      nombre: "LAO disponibles (patrón A)",
      queCargar:
        "Una fila por año de origen menor que A, con días disponibles enteros (saldo histórico informado). No cargues años ≥ A: desde A el cupo lo acredita el motor por antigüedad.",
      validaciones: [
        "Años enteros, sin repetir el mismo año",
        "Días enteros ≥ 0",
        "Cada año debe ser estrictamente menor que A",
      ],
    },
    {
      id: "B",
      nombre: "Ciclos anuales (patrón B)",
      queCargar:
        "Por cada artículo vigente con patrón B: días ya consumidos en el ciclo cuyo año es A (solo lectura en pantalla). El sistema calcula el saldo inicial según el cupo del configurador.",
      validaciones: [
        "Días consumidos: entero ≥ 0",
        "No puede superar el cupo del artículo",
        "Varios artículos se guardan en un solo envío (atómico)",
      ],
    },
    {
      id: "C",
      nombre: "Cuenta continua (patrón C)",
      queCargar: "Saldo actual por artículo (entero). Campo vacío = no informado / 0. Puede ser negativo si el legajo lo requiere.",
      validaciones: [
        "Saldo entero (sin decimales)",
        "Guardado atómico de todos los artículos informados en la pestaña",
      ],
    },
  ],
  notaAnioA: CHECKIN_COPY_ANIO_A,
};

/** @type {{ titulo: string, bloques: { titulo: string, items: string[] }[] }} */
export const CHECKIN_AYUDA_VALIDACIONES = {
  titulo: "Validaciones, modos y mensajes frecuentes",
  bloques: [
    {
      titulo: "Check-in nuevo vs rectificación",
      items: [
        "Nuevo: primera carga (o recarga explícita con casilla en banner). Exige HLC confirmadas. Permite cierre global.",
        "Rectificación: corrige solo las bolsas que guardés en esta sesión. No exige HLC de nuevo. No vuelve a abrir el cierre global.",
        "Si LAO ya tiene días consumidos en portal y guardás como nuevo, el sistema pedirá rectificación.",
      ],
    },
    {
      titulo: "Precarga automática",
      items: [
        "Al elegir agente y año A, el sistema lee bolsas existentes y rellena filas LAO / B / C.",
        "El aviso «Saldos precargados…» aparece una sola vez por agente y año A.",
      ],
    },
    {
      titulo: "Cierre global (modal)",
      items: [
        "Paso 1: resumen de lo informado en esta sesión.",
        "Paso 2: advertencias (p. ej. sin LAO, sin B/C, HLC no marcadas). Debés marcar cada casilla para continuar.",
        "Paso 3: confirmación final. El cierre es administrativo: no garantiza que todas las bolsas del hospital estén cargadas.",
      ],
    },
    {
      titulo: "Errores habituales",
      items: [
        "Sin permiso RRHH: cerrá sesión y verificá claims (dev:set-rrhh-claims en entornos de prueba).",
        "Check-in global cerrado: elegí Rectificación o autorizá recarga en el banner amarillo.",
        "Artículos con aviso en lista B/C: revisá configuración del artículo (patrón o metadatos).",
      ],
    },
    {
      titulo: "Validación en servidor",
      items: [
        "Check-in nuevo exige al menos una HLC operativa vigente (validado en servidor).",
        "Los guardados parciales y el cierre registran anio_corte_portal_a en la persona.",
      ],
    },
  ],
};
