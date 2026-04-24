/**
 * 🪵 Sistema de Logging Centralizado
 * 
 * Proporciona un sistema de logging unificado con niveles de severidad,
 * capacidad de filtrar en desarrollo/producción, y formato consistente.
 * 
 * Niveles disponibles:
 * - DEBUG: Información detallada para desarrollo (solo en desarrollo)
 * - INFO: Información general del flujo de la aplicación
 * - WARN: Advertencias que no impiden el funcionamiento
 * - ERROR: Errores que afectan el funcionamiento
 * 
 * @module logger
 */

/**
 * Determina si estamos en modo desarrollo
 * @type {boolean}
 */
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Configuración del logger
 */
const config = {
  enabled: isDevelopment, // Por defecto, solo en desarrollo
  level: isDevelopment ? 'DEBUG' : 'WARN', // Nivel mínimo en producción
  showTimestamp: true,
  showContext: true,
  colors: isDevelopment, // Colores solo en desarrollo
};

/**
 * Niveles de log con su prioridad
 */
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Nombres de niveles para mostrar
 */
const LEVEL_NAMES = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Colores para consola (solo en desarrollo)
 */
const COLORS = {
  DEBUG: 'color: #6b7280; font-weight: normal;', // Gris
  INFO: 'color: #3b82f6; font-weight: normal;', // Azul
  WARN: 'color: #f59e0b; font-weight: bold;', // Amarillo
  ERROR: 'color: #ef4444; font-weight: bold;', // Rojo
  RESET: 'color: inherit; font-weight: normal;',
};

/**
 * Verifica si un nivel debe ser mostrado según la configuración
 * @param {string} level - Nivel a verificar
 * @returns {boolean}
 */
function shouldLog(level) {
  if (!config.enabled) return false;
  const currentLevel = LEVELS[config.level] ?? LEVELS.INFO;
  const messageLevel = LEVELS[level] ?? LEVELS.INFO;
  return messageLevel >= currentLevel;
}

/**
 * Formatea el timestamp actual
 * @returns {string}
 */
function formatTimestamp() {
  if (!config.showTimestamp) return '';
  const now = new Date();
  return now.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Formatea el contexto del log
 * @param {string} context - Contexto (nombre del componente/función)
 * @returns {string}
 */
function formatContext(context) {
  if (!config.showContext || !context) return '';
  return `[${context}]`;
}

/**
 * Formatea el mensaje completo
 * @param {string} level - Nivel del log
 * @param {string} context - Contexto
 * @param {string} message - Mensaje
 * @returns {string}
 */
function formatMessage(level, context, message) {
  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);
  const levelStr = LEVEL_NAMES[level] || level;
  const parts = [timestamp, contextStr, levelStr, message].filter(Boolean);
  return parts.join(' ');
}

/**
 * Logger principal
 */
const logger = {
  debug(message, ...args) {
    if (!shouldLog('DEBUG')) return;
    const formatted = formatMessage('DEBUG', null, message);
    if (config.colors) {
      console.debug(`%c${formatted}`, COLORS.DEBUG, ...args);
    } else {
      console.info(formatted, ...args);
    }
  },
  info(message, ...args) {
    if (!shouldLog('INFO')) return;
    const formatted = formatMessage('INFO', null, message);
    if (config.colors) {
      console.info(`%c${formatted}`, COLORS.INFO, ...args);
    } else {
      console.info(formatted, ...args);
    }
  },
  warn(message, ...args) {
    if (!shouldLog('WARN')) return;
    const formatted = formatMessage('WARN', null, message);
    if (config.colors) {
      console.warn(`%c${formatted}`, COLORS.WARN, ...args);
    } else {
      console.warn(formatted, ...args);
    }
  },
  error(message, ...args) {
    if (!shouldLog('ERROR')) return;
    const formatted = formatMessage('ERROR', null, message);
    if (config.colors) {
      console.error(`%c${formatted}`, COLORS.ERROR, ...args);
    } else {
      console.error(formatted, ...args);
    }
  },
};

/**
 * Crea un logger con contexto específico
 * @param {string} context - Contexto del logger
 * @returns {Object} Logger con métodos debug, info, warn, error
 */
export function createLogger(context) {
  return {
    debug: (message, ...args) => {
      if (!shouldLog('DEBUG')) return;
      const formatted = formatMessage('DEBUG', context, message);
      if (config.colors) {
        console.debug(`%c${formatted}`, COLORS.DEBUG, ...args);
      } else {
        console.info(formatted, ...args);
      }
    },
    info: (message, ...args) => {
      if (!shouldLog('INFO')) return;
      const formatted = formatMessage('INFO', context, message);
      if (config.colors) {
        console.info(`%c${formatted}`, COLORS.INFO, ...args);
      } else {
        console.info(formatted, ...args);
      }
    },
    warn: (message, ...args) => logger.warn(context, message, ...args),
    error: (message, ...args) => logger.error(context, message, ...args),
  };
}

export default logger;
