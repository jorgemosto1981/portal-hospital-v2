const STORAGE_KEY = "ph2_lastPersonaId";

export function setLastPersonaIdForDemo(personaId) {
  try {
    localStorage.setItem(STORAGE_KEY, personaId);
  } catch {
    /* ignore */
  }
}

export function getLastPersonaIdForDemo() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearLastPersonaIdForDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
