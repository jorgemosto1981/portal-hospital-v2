/**
 * Recorre un ZodObject (versión cfg_articulos) y devuelve rutas hoja con prefijo de bloque.
 * Arrays de objetos (p. ej. matriz_antiguedad_reglas) se reportan como una sola hoja.
 *
 * @param {import("zod").ZodTypeAny} schema
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function collectZodLeafPaths(schema, prefix = "") {
  const unwrapped = unwrap(schema);
  const typeName = unwrapped._def?.typeName;

  if (typeName === "ZodObject") {
    const shape = unwrapped._def.shape();
    const out = [];
    for (const [key, sub] of Object.entries(shape)) {
      const next = prefix ? `${prefix}.${key}` : key;
      out.push(...collectZodLeafPaths(sub, next));
    }
    return out;
  }

  if (typeName === "ZodArray") {
    return prefix ? [prefix] : [];
  }

  return prefix ? [prefix] : [];
}

/** @param {import("zod").ZodTypeAny} schema */
function unwrap(schema) {
  let cur = schema;
  for (;;) {
    const t = cur._def?.typeName;
    if (t === "ZodOptional" || t === "ZodNullable" || t === "ZodDefault" || t === "ZodEffects") {
      cur = cur._def.schema ?? cur._def.innerType;
      continue;
    }
    return cur;
  }
}
