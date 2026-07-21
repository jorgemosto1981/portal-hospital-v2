/** Ayuda contextual del hub «Alta nuevo usuario» (copy reutilizado / consolidado). */

export const AYUDA_IDENTIDAD = {
  titulo: "Paso 1 — Identidad",
  parrafos: [
    "Creá la cáscara con DNI, nombre y apellido. El sistema genera persona + cuenta pendiente de registro y deja la DDJJ en no iniciada.",
    "El correo y el PIN los elige el agente en su primer acceso. No los cargues acá.",
  ],
};

export const AYUDA_TRACKER = {
  titulo: "Paso 2 y 3 — Laboral y check-in",
  parrafos: [
    "Orden recomendado: identidad → HLc/HLg en datos laborales → check-in de saldos con cierre global.",
    "Aunque el agente podría registrarse apenas existe la cáscara, RRHH considera el alta lista solo con los tres hitos en verde.",
  ],
};

export const AYUDA_AVISO = {
  titulo: "Aviso al agente",
  parrafos: [
    "Cuando identidad, laboral y check-in estén listos, copiá el mensaje y envialo al agente.",
    "El enlace oficial de primer acceso es /login?alta=1 (DNI sin puntos + correo + PIN numérico de 6 dígitos).",
  ],
};

/**
 * @param {string} origin
 * @param {string} [dni]
 */
export function buildMensajePrimerAccesoAgente(origin, dni = "") {
  const base = String(origin || "").replace(/\/$/, "");
  const url = `${base}/login?alta=1`;
  const dniLine = dni
    ? ` Tu DNI cargado en el sistema es ${dni} (ingresalo sin puntos).`
    : " Escribí tu DNI sin puntos.";
  return (
    `Tu alta en el Portal Hospitalario ya está preparada. Ingresá a ${url}, elegí Crear cuenta,` +
    `${dniLine} tu correo electrónico y un PIN numérico de 6 dígitos.` +
    ` Después completá los datos que te pide la pantalla. No compartas tu PIN.`
  );
}
