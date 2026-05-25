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
      "Máquina de estados: BORRADOR (editable) → ENVIADO (en revisión) → AUTORIZADO_SUPERIOR → HABILITADO (activo, lo usa el motor). También CERRADO para perpetuos finalizados.",
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
];

export const MANUALES_POR_RUTA = {
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
          "Defina los turnos disponibles que el jefe podrá asignar (ej. M=Mañana 06-14, T=Tarde 14-22, N=Noche 22-06). Opcionalmente, configure reglas de planificación (máx. días trabajo, mín. francos).",
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
      "Patrón Fijo",
      "Patrón Rotativo",
      "Patrón Planificado",
      "Fecha ancla",
      "Turno (M/T/N/G)",
      "HLg (Historial laboral grupo)",
    ],
  },

  "/portal/jefe/planes-turno": {
    titulo: "Planificación de Turnos del Servicio",
    rol: "Jefe de servicio",
    pasos: [
      {
        titulo: "Seleccionar grupo y período",
        contenido:
          "Ingrese el ID del grupo de trabajo y seleccione el mes a planificar. Haga clic en «Buscar» para ver los planes existentes.",
      },
      {
        titulo: "Crear plan mensual (enfermería)",
        contenido:
          "Haga clic en «Nuevo plan». Agregue a cada agente del servicio con su persona_id, regimen_id y hlg_id. Use el sistema de pincel para pintar los turnos: seleccione M/T/N/G/F y haga clic en las celdas.",
      },
      {
        titulo: "Leer la grilla",
        contenido:
          "Cada celda muestra el turno asignado con colores: amarillo=Mañana, azul=Tarde, índigo=Noche, naranja=Guardia, gris=Franco. A la derecha se muestran contadores de días trabajados y francos.",
      },
      {
        titulo: "Guardar y enviar",
        contenido:
          "«Guardar borrador» persiste el plan sin enviarlo. Puede editarlo las veces que necesite. Cuando esté conforme, use «Enviar» para pasarlo al circuito de aprobación.",
      },
      {
        titulo: "Circuito de aprobación",
        contenido:
          "Tras enviar: su Superior lo aprueba (→ Autorizado), luego RRHH lo habilita (→ Habilitado). Si rechazan, vuelve a Borrador con observaciones. Puede corregir y reenviar.",
      },
      {
        titulo: "Registrar cambios operativos (overrides)",
        contenido:
          "Durante el mes, si necesita hacer un cambio puntual (cambio de guardia, cobertura de urgencia), use la GSO: busque al agente, haga clic en «Cambio» y registre el override con motivo obligatorio.",
      },
    ],
    glosarioRelevante: [
      "Plan de turnos",
      "Plan mensual",
      "Plan perpetuo",
      "Estados del plan",
      "Franco",
      "Override (Reemplazo)",
      "Override (Adicional)",
      "Override fantasma",
    ],
  },

  "/portal/grilla": {
    titulo: "Grilla de Supervisión Operativa (GSO)",
    rol: "Jefe / RRHH",
    pasos: [
      {
        titulo: "Consultar estado operativo",
        contenido:
          "Seleccione la fecha de corte y opcionalmente filtre por persona o grupo. La tabla muestra el estado laboral consolidado: persona, grupo, vigencia, carga horaria y warnings.",
      },
      {
        titulo: "Interpretar warnings",
        contenido:
          "SOLAPE_CARGO_GRUPO indica superposición de asignaciones. DESVIO_CARGA_NORMATIVA indica que las horas asignadas no coinciden con la carga del cargo. Use el filtro de warnings para aislar casos.",
      },
      {
        titulo: "Registrar cambio de turno",
        contenido:
          "Haga clic en «Cambio» en la fila del agente. Se abrirá un modal donde puede ver los overrides existentes del día y registrar uno nuevo. Seleccione tipo (Reemplazo o Adicional), horarios y motivo.",
      },
      {
        titulo: "Tipos de override",
        contenido:
          "Reemplazo: sustituye el turno teórico (ej. de Mañana a Franco). Adicional: suma horas al turno existente (ej. doble guardia). Ambos requieren motivo obligatorio y quedan registrados con auditoría completa.",
      },
      {
        titulo: "Exportar datos",
        contenido:
          "Use los botones «Exportar JSON» o «Exportar CSV» para descargar los datos filtrados. Útil para auditorías y reportes.",
      },
    ],
    glosarioRelevante: [
      "GSO (Grilla de Supervisión Operativa)",
      "Capa teórica",
      "Override (Reemplazo)",
      "Override (Adicional)",
      "Divergencia",
      "Fichada",
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

  for (const ruta of Object.keys(MANUALES_POR_RUTA)) {
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
