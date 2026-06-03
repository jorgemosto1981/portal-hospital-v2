/** Opciones paso 1 — F-UX gestión turno del día (handoff §7). */

/** @typedef {'cobertura_parcial' | 'reemplazo' | 'adicional'} GestionTurnoFlujoId */

export const GESTION_TURNO_OPCIONES = [
  {
    id: /** @type {GestionTurnoFlujoId} */ ("cobertura_parcial"),
    letra: "A",
    titulo: "Intercambio de guardia",
    subtitulo: "Dos agentes; carga equivalente; pueden ser días distintos",
  },
  {
    id: /** @type {GestionTurnoFlujoId} */ ("reemplazo"),
    letra: "B",
    titulo: "Cambio de turno propio",
    subtitulo: "Traslado entre días; no pisa lo ya en destino; origen queda franco",
  },
  {
    id: /** @type {GestionTurnoFlujoId} */ ("adicional"),
    letra: "C",
    titulo: "Horas adicionales",
    subtitulo: "Agrega turno extra; RRHH valida → jefe superior autoriza",
  },
];

/** Preguntas guía para elegir flujo (matriz §7 handoff). */
export const GESTION_TURNO_AYUDA_MATRIZ = [
  {
    pregunta:
      "¿Dos agentes, mismo mes y grupo, intercambian carga equivalente (turno + fichada esperada en ambos días)?",
    flujo: "A",
  },
  {
    pregunta: "¿Un agente traslada turno(s) a otro día sin pisar segmentos en destino?",
    flujo: "B",
  },
  {
    pregunta: "¿Agregar turno extra? (RRHH valida fichadas; jefe superior autoriza después)",
    flujo: "C",
  },
];
