/**
 * Contenido de ayuda contextual — Glosario + Manuales de usuario.
 *
 * Estructura: cada ruta del portal mapea a una sección de ayuda con:
 *   - titulo: nombre de la sección
 *   - manual: pasos/instrucciones para el usuario
 *   - glosario: términos relevantes para esa pantalla
 *
 * El componente HelpDrawer usa la ruta actual para mostrar la sección correcta.
 */

export const GLOSARIO_COMPLETO = [
  {
    termino: "Turno compuesto con «+»",
    definicion:
      "En regímenes planificados, un id como M+T descompone la jornada en tramos M y T (horarios de la paleta). Si encadenan sin hueco, las fichadas esperadas siguen siendo 2; la descomposición habilita cobertura parcial por tramo. Tras cambiar ids, rematerialice el mes del grupo.",
  },
  {
    termino: "Régimen horario",
    definicion:
      "Molde o plantilla que define las reglas de horario de un agente: días laborables, turnos, horas efectivas, tolerancias y descansos. Se configura una vez y se asigna a múltiples personas.",
  },
  {
    termino: "Patrón Fijo",
    definicion:
      "Régimen donde los días y horarios son siempre iguales semana a semana (ej. Lunes a Viernes de 07:00 a 14:00). Típico de administrativos y consultorios.",
  },
  {
    termino: "Patrón Rotativo",
    definicion:
      "Régimen con un ciclo que se repite cada N días, independiente de la semana. Se calcula con la fecha ancla y aritmética modular (ej. 2 días trabajo + 2 franco = ciclo de 4).",
  },
  {
    termino: "Patrón Planificado",
    definicion:
      "Régimen donde el jefe arma manualmente la grilla mes a mes, asignando turno por turno y agente por agente. Típico de enfermería con turnos M/T/N.",
  },
  {
    termino: "Fecha ancla",
    definicion:
      "Fecha de referencia (día 0) desde la que se calcula la posición en el ciclo rotativo. Si cambia, todo el patrón se desplaza. Se define en el grupo laboral (HLg).",
  },
  {
    termino: "Plan de turnos",
    definicion:
      "Documento que formaliza la asignación de turnos de un grupo de trabajo. Puede ser perpetuo (fijo/rotativo, sin fecha fin) o mensual (planificado, grilla día×agente).",
  },
  {
    termino: "Plan perpetuo",
    definicion:
      "Plan de vigencia continua para regímenes fijos o rotativos. Se cierra solo cuando hay un cambio de régimen o reorganización del grupo.",
  },
  {
    termino: "Plan mensual",
    definicion:
      "Plan válido para un mes calendario específico (ej. 2026-06). El jefe arma la grilla día a día con los turnos disponibles del catálogo del régimen.",
  },
  {
    termino: "Estados del plan",
    definicion:
      "Circuito habitual: BORRADOR → ENVIADO (superior) → HABILITADO (teoría operativa del mes). EN_REVISION: RRHH devolvió el plan al jefe para corrección. CERRADO: perpetuo finalizado o plan histórico fuera de uso. MERGEADO: solo planes de incorporación ya fusionados al operativo (auditoría; no reemplaza al habilitado).",
  },
  {
    termino: "Plan operativo (mensual)",
    definicion:
      "El plan principal habilitado del mes y grupo: es la foto oficial que usa la grilla de licencias (GSO) para quienes ya están planificados ahí. En la pantalla de turnos del servicio se muestra en tarjeta verde y, si está habilitado, es solo lectura para el jefe.",
  },
  {
    termino: "Plan Paralelo de Incorporación",
    definicion:
      "Documento hijo (plt_inc) para sumar agentes nuevos al mes sin reabrir ni editar el plan operativo habilitado. Solo incluye filas de personal que aún no figuraba en ese turno mensual. Estados: BORRADOR o EN_REVISION (editable), ENVIADO (en aprobación), MERGEADO (ya unido al operativo).",
  },
  {
    termino: "Pendiente de incorporación",
    definicion:
      "Situación de un agente con HLg vigente en el grupo pero cuyos turnos del mes se están armando en un plan paralelo de incorporación, todavía no mergeado. No es un error ni un «fantasma» de plan: es el trámite normal hasta que RRHH aprueba la incorporación.",
  },
  {
    termino: "Inmutabilidad de régimen (HLg)",
    definicion:
      "Una vez creado el historial laboral en grupo (HLg), no se cambia el régimen horario ni el grupo de trabajo editando ese registro: hay que cerrar o anular el HLg y abrir uno nuevo. Evita desalinear turnos ya planificados o materializados.",
  },
  {
    termino: "Cierre de HLg vs Anulación",
    definicion:
      "Cierre (deshabilitar): el agente deja de pertenecer al grupo desde una fecha de corte; el sistema ajusta planes y teoría a partir de ese momento. Anulación: revierte un alta errónea; elimina al agente de planes afectados y marca el HLg como anulado. Ambos limpian turnos futuros vinculados; las licencias ya tramitadas se conservan según reglas de grilla.",
  },
  {
    termino: "Plan fantasma (histórico)",
    definicion:
      "Plan mensual legado que ya no corresponde al slot operativo del mes (remediado a CERRADO o eliminado). No confundir con un plan de incorporación en curso ni con un agente pendiente de incorporación.",
  },
  {
    termino: "Override (Reemplazo)",
    definicion:
      "Cambio puntual que sustituye el turno teórico de un día. Ejemplo: un agente que tenía turno mañana pasa a franco. El override reemplaza completamente la capa teórica.",
  },
  {
    termino: "Override (Adicional)",
    definicion:
      "Cambio puntual que se suma al turno teórico. Ejemplo: doble guardia de urgencia. El agente cumple su turno normal y además cubre otro horario. Las horas se acumulan.",
  },
  {
    termino: "Capa teórica",
    definicion:
      "Lo que debería pasar según el régimen y el plan: turno asignado, horarios de ingreso/egreso, horas efectivas. Es la base contra la que se comparan fichadas y licencias.",
  },
  {
    termino: "Fichada",
    definicion:
      "Registro de ingreso/egreso real del agente (futuro: por reloj biométrico o registro manual). Se compara con la capa teórica para detectar divergencias.",
  },
  {
    termino: "Divergencia",
    definicion:
      "Diferencia entre la capa teórica y la realidad (fichadas). Puede ser llegada tarde, salida temprana, ausencia o turno extendido. Genera alertas para RRHH.",
  },
  {
    termino: "Divergencia fichada y licencia (GSO)",
    definicion:
      "Inconsistencia detectada en la grilla: el agente tiene licencia aprobada o jornada teórica que no cuadra con las marcas del reloj (presente sin turno esperado, o ausente con jornada laborable). RRHH revisa marcas crudas y la solicitud antes de liquidar.",
  },
  {
    termino: "Fichada impar (reloj)",
    definicion:
      "El hardware registró marcas incompletas para el día (por ejemplo entrada sin egreso, o menos marcas que las fichadas esperadas del turno). No implica sanción automática: RRHH contrasta con teoría y justifica o regulariza.",
  },
  {
    termino: "Desalineación teoría post-licencia",
    definicion:
      "La jornada teórica vigente en la celda difiere de la referencia que tenía la licencia al aprobarse (cambio de plan, override o materialización tardía). Requiere revisión de solicitud, ajuste de turno o corrección de plan.",
  },
  {
    termino: "Franco",
    definicion:
      "Día en que el agente no tiene turno asignado. Puede ser fijo (sábado/domingo en administrativos) o rotativo (según el ciclo o la grilla mensual).",
  },
  {
    termino: "Turno (M/T/N/G)",
    definicion:
      "Bloque horario del catálogo del régimen: M (Mañana), T (Tarde), N (Noche), G (Guardia). Cada turno tiene ingreso, egreso, horas efectivas y flag nocturno.",
  },
  {
    termino: "HLg (Historial laboral grupo)",
    definicion:
      "Registro que vincula una persona con un grupo de trabajo, un cargo y un régimen horario. Tiene fecha de inicio/fin y es donde se asigna la fecha ancla.",
  },
  {
    termino: "GSO (Grilla de Supervisión Operativa)",
    definicion:
      "Pantalla donde jefes y RRHH visualizan el estado operativo del equipo: datos laborales, asistencia, warnings y acceso a cambios de turno (overrides).",
  },
  {
    termino: "Override fantasma",
    definicion:
      "Override manual que queda huérfano tras una re-planificación. Al habilitar un nuevo plan, el sistema detecta estos overrides y ofrece invalidarlos automáticamente.",
  },
  {
    termino: "Calendario institucional",
    definicion:
      "Catálogo de feriados, asuetos y días no laborables del hospital. Si un régimen tiene 'impacta_calendario_institucional: true', el motor anula el turno en esas fechas.",
  },
  {
    termino: "Cobertura Parcial (Tramos)",
    definicion:
      "Permite reasignar solo una parte de la jornada de un agente a otro compañero (por ejemplo, cubrir solo la tarde de una guardia extensa). El sistema ajusta automáticamente horas y expectativas del reloj para ambas personas.",
  },
  {
    termino: "Turnos Compuestos",
    definicion:
      "Son jornadas largas formadas por varios tramos consecutivos (Mañana, Tarde, Noche). Si se cumplen de corrido, se consideran una sola continuidad para el control de fichadas.",
  },
  {
    termino: "Cambios Pendientes (Borrador)",
    definicion:
      "Al editar la grilla, tus cambios quedan guardados como borrador en el navegador. Para confirmar y registrar todo en el sistema, debes presionar \"Aplicar cambios\". Si cierras por accidente, podrás recuperar el borrador al volver.",
  },
  {
    termino: "Gestionar turno del día (A/B/C)",
    definicion:
      "Desde el detalle de una celda, abrís el asistente para registrar cambios operativos del mes: A) Intercambio de guardia entre dos agentes; B) Cambio de turno propio (traslado entre días); C) Horas adicionales (turno extra declarado, trámite RRHH → jefe superior). Si el día no tiene turno calculado, solo se ofrece C.",
  },
  {
    termino: "Intercambio de guardia (Flujo A)",
    definicion:
      "Swap bilateral entre dos agentes del mismo cargo y mes: cada uno cede tramos equivalentes en días que pueden ser distintos (ej. XX 05/06 cede N ↔ YY 12/06 cede M). Requiere turno calculado en ambos días.",
  },
  {
    termino: "Cambio de turno propio (Flujo B)",
    definicion:
      "Un agente traslada segmentos de un día origen a un día destino sin pisar lo ya presente en destino. El origen queda franco (total o parcial). Requiere turno calculado en origen y destino.",
  },
  {
    termino: "Horas adicionales (Flujo C)",
    definicion:
      "Declaración de un turno extra + motivo. No se tipean horas: RRHH valida fichadas reales y luego el jefe superior autoriza. Aplica en franco, feriado, no laborable o con turno preasignado; no exige calcular el día antes.",
  },
  {
    termino: "Protección de Datos (Grilla Desactualizada)",
    definicion:
      "Si otra persona modifica el mismo período mientras preparas cambios, el sistema pausa el guardado para evitar sobrescribir información. Solo necesitas refrescar la grilla y volver a aplicar tus pendientes.",
  },
];

const MANUAL_GRILLA_OPERATIVA = {
  titulo: "Grilla operativa (licencias y turnos)",
  rol: "Jefe / RRHH",
  pasos: [
    {
      titulo: "Leer la grilla del mes",
      contenido:
        "Elegí período, vista (titular, equipo o sector) y grupo. Cada celda muestra turno teórico, licencias y feriados. Tocá una celda para ver el detalle del día.",
    },
    {
      titulo: "Gestionar turno de este día",
      contenido:
        "En el detalle del día, «Gestionar turno de este día» abre el asistente A/B/C. Con turno calculado: Intercambio (A), Traslado propio (B) u Horas adicionales (C). Sin turno calculado (franco, feriado, etc.): solo C.",
    },
    {
      titulo: "Flujo A — Intercambio de guardia",
      contenido:
        "Dos agentes del mismo cargo intercambian tramos de igual carga en días del mismo mes (pueden ser fechas distintas). Ambos días deben tener turno calculado.",
    },
    {
      titulo: "Flujo B — Cambio de turno propio",
      contenido:
        "Trasladá segmentos de un día a otro del mismo mes. El destino suma sin pisar tramos existentes; el origen queda franco auditado.",
    },
    {
      titulo: "Flujo C — Horas adicionales",
      contenido:
        "Declará turno extra del régimen + motivo. RRHH validará fichadas; el jefe superior autoriza después. Las horas no se cargan en este paso.",
    },
    {
      titulo: "Cola de cambios y Aplicar",
      contenido:
        "Cada registro va al borrador local (outbox). Revisá la lista con etiquetas legibles y presioná «Aplicar cambios» para enviar el lote al servidor.",
    },
  ],
  glosarioRelevante: [
    "GSO (Grilla de Supervisión Operativa)",
    "Gestionar turno del día (A/B/C)",
    "Intercambio de guardia (Flujo A)",
    "Cambio de turno propio (Flujo B)",
    "Horas adicionales (Flujo C)",
    "Cobertura Parcial (Tramos)",
    "Cambios Pendientes (Borrador)",
    "Capa teórica",
    "Divergencia fichada y licencia (GSO)",
    "Fichada impar (reloj)",
    "Desalineación teoría post-licencia",
  ],
};

export const MANUALES_POR_RUTA = {
  "/portal/grilla": MANUAL_GRILLA_OPERATIVA,

  "/portal/rrhh/grilla-operativa": MANUAL_GRILLA_OPERATIVA,
  "/portal/jefe/grilla-operativa": MANUAL_GRILLA_OPERATIVA,

  "/portal/rrhh/regimenes-horarios": {
    titulo: "Catálogo de Regímenes Horarios",
    rol: "RRHH",
    pasos: [
      {
        titulo: "Crear un nuevo régimen",
        contenido:
          "Haga clic en «Nuevo régimen». Seleccione el tipo de patrón (Fijo, Rotativo o Planificado). Complete los campos obligatorios: nombre, código, carga horaria semanal.",
      },
      {
        titulo: "Configurar turnos (Fijo)",
        contenido:
          "Para cada día de la semana, defina si es laborable o franco. En días laborables, ingrese horario de ingreso, egreso y horas efectivas. Puede agregar banda flexible y tolerancias.",
      },
      {
        titulo: "Configurar ciclo (Rotativo)",
        contenido:
          "Defina el total de posiciones del ciclo (ej. 4 para un 2×2). Para cada posición, indique si es día de trabajo o franco, y el turno asociado. El ciclo se repetirá infinitamente desde la fecha ancla.",
      },
      {
        titulo: "Configurar paleta (Planificado)",
        contenido:
          "Defina los turnos base (M, T, N) con ingreso/egreso. Para jornadas compuestas use ids con «+» (M+T, T+N, M+T+N): el motor descompone tramos y permite cobertura parcial. Evite ids atómicos MT/TN si necesita ceder un tramo. Tras cambios, rematerialice la grilla del grupo.",
      },
      {
        titulo: "Asignar régimen a un agente",
        contenido:
          "Desde la pantalla de Datos Laborales, abra el registro HLg del agente. En el campo «Régimen horario» seleccione el régimen creado. Si es rotativo, defina también la «Fecha ancla».",
      },
      {
        titulo: "Editar o desactivar",
        contenido:
          "Use el botón «Editar» en la tabla para modificar un régimen existente. Para desactivarlo (sin eliminar), cambie el campo «activo» a falso. Los agentes que lo tenían asignado mantendrán el histórico.",
      },
    ],
    glosarioRelevante: [
      "Régimen horario",
      "Patrón Planificado",
      "Turno compuesto con «+»",
      "Patrón Fijo",
      "Patrón Rotativo",
      "Patrón Planificado",
      "Fecha ancla",
      "Turno (M/T/N/G)",
      "HLg (Historial laboral grupo)",
    ],
  },

  "/portal/rrhh/planes-turno": {
    titulo: "Planificación de Turnos del Servicio",
    rol: "RRHH",
    pasos: [
      {
        titulo: "Foco sector y mes",
        contenido:
          "Elegí un grupo de trabajo del catálogo institucional y el período. El foco queda en la URL para compartir o refrescar.",
      },
      {
        titulo: "Permisos institucionales",
        contenido:
          "Desde esta ruta RRHH aplican las reglas de auditoría central (G3) y la bandeja masiva de aprobación cuando corresponda.",
      },
    ],
    terminos: ["Plan mensual", "GDT", "Habilitado", "BORRADOR"],
  },

  "/portal/jefe/planes-turno": {
    titulo: "Planificación de Turnos del Servicio",
    rol: "Jefe de servicio",
    pasos: [
      {
        titulo: "Elegir grupo y mes",
        contenido:
          "Seleccioná el grupo de trabajo y el período (mes). Las tarjetas de la fila superior resumen el estado del turno de cada grupo para ese mes.",
      },
      {
        titulo: "Dos tarjetas: operativo e incorporación",
        contenido:
          "Si el mes ya tiene plan habilitado, la tarjeta verde «Plan operativo» es la foto oficial (solo lectura). Si hay agentes nuevos, puede aparecer además la tarjeta violeta «Incorporación» para armar solo sus turnos, sin tocar al resto del equipo.",
      },
      {
        titulo: "Plan mensual nuevo (sin habilitado previo)",
        contenido:
          "Creá el plan completo del servicio: agregá agentes y pintá la grilla (M/T/N/G/F). Guardá borrador, enviá y seguí el circuito hasta que RRHH habilite.",
      },
      {
        titulo: "Incorporar agente(s) nuevos",
        contenido:
          "Con plan operativo habilitado, si el sistema avisa «Requiere plan individual», usá «Incorporar agente(s)». Editá únicamente las filas de los nuevos en «Editar incorporación». Enviá o reenviá desde la tarjeta violeta (BORRADOR / EN_REVISION). Tras la aprobación de RRHH verás MERGEADO y el operativo sumará a esas personas.",
      },
      {
        titulo: "Solo lectura en grilla",
        contenido:
          "Régimen fijo o rotativo sin filas planificadas: la grilla del mes se deriva del patrón (no se pinta a mano). Plan operativo habilitado: abrís «Ver plan operativo» en modo consulta. La incorporación en curso siempre marca las filas editables.",
      },
      {
        titulo: "Circuito de aprobación",
        contenido:
          "Enviado → superior → RRHH habilita (plan completo) o aprueba incorporación (merge al operativo). Si RRHH revierte, el estado pasa a EN_REVISION: corregís y reenviás.",
      },
      {
        titulo: "Cambios del mes en operación",
        contenido:
          "Para urgencias puntuales (intercambio, traslado, horas adicionales) usá la grilla operativa (GSO), no reabras el plan habilitado salvo remediación acordada con RRHH.",
      },
    ],
    glosarioRelevante: [
      "Plan de turnos",
      "Plan mensual",
      "Plan operativo (mensual)",
      "Plan Paralelo de Incorporación",
      "Pendiente de incorporación",
      "Estados del plan",
      "Plan fantasma (histórico)",
      "Franco",
      "Patrón Planificado",
      "HLg (Historial laboral grupo)",
    ],
  },

  "/portal/rrhh/bandeja-turnos": {
    titulo: "Bandeja de turnos (RRHH)",
    rol: "RRHH",
    pasos: [
      {
        titulo: "Planes completos vs incorporación",
        contenido:
          "Los ítems de plan mensual habitual siguen el flujo revertir / habilitar. Los marcados como «Incorporación» son planes paralelos: al aprobar, el sistema fusiona solo los agentes nuevos al plan operativo habilitado del mismo mes y grupo.",
      },
      {
        titulo: "Qué no cambia al mergear",
        contenido:
          "Las filas ya habilitadas del operativo no se reescriben. El documento de incorporación queda en estado MERGEADO para auditoría.",
      },
      {
        titulo: "HLg: cierre y anulación",
        contenido:
          "Deshabilitar HLg corta la pertenencia al grupo desde una fecha. Anular un alta errónea limpia turnos en planes vinculados. Si una operación falla con mensaje de «demasiados planes afectados», registrá el caso y contactá soporte técnico central — no reintentes en cadena.",
      },
    ],
    glosarioRelevante: [
      "Plan Paralelo de Incorporación",
      "Plan operativo (mensual)",
      "Estados del plan",
      "Cierre de HLg vs Anulación",
      "Inmutabilidad de régimen (HLg)",
      "HLg (Historial laboral grupo)",
    ],
  },
};

/**
 * Resuelve la sección de ayuda más relevante según la ruta actual.
 * @param {string} pathname
 * @returns {{ manual: object | null, glosarioFiltrado: object[] }}
 */
export function resolverAyudaContextual(pathname) {
  let manualKey = null;
  const rutas = Object.keys(MANUALES_POR_RUTA).sort((a, b) => b.length - a.length);

  for (const ruta of rutas) {
    if (pathname.startsWith(ruta)) {
      manualKey = ruta;
      break;
    }
  }

  const manual = manualKey ? MANUALES_POR_RUTA[manualKey] : null;

  if (!manual) {
    return { manual: null, glosarioFiltrado: GLOSARIO_COMPLETO };
  }

  const relevantes = new Set(manual.glosarioRelevante || []);
  const glosarioFiltrado = GLOSARIO_COMPLETO.filter((g) => relevantes.has(g.termino));

  return { manual, glosarioFiltrado };
}
