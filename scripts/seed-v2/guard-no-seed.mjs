/**
 * Política del proyecto V2: no escribir datos de semilla/mock en Firestore por defecto.
 * Activación explícita solo para mantenimiento excepcional (entorno aislado, restauración de catálogo).
 *
 * En el shell antes del comando:
 *   ALLOW_FIRESTORE_SEED_V2=true
 *
 * @param {string} scriptLabel - nombre del script (log)
 */
export function assertFirestoreSeedAllowed(scriptLabel) {
  const raw = String(process.env.ALLOW_FIRESTORE_SEED_V2 || "").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return;

  console.error(
    `[${scriptLabel}] Escritura de semilla en Firestore BLOQUEADA por política del proyecto.\n` +
      "No se usan mocks ni volcados automáticos a la BD: datos reales y conexión directa.\n" +
      "Solo si tenés autorización y entendés que el script puede recrear documentos de catálogo:\n" +
      "  ALLOW_FIRESTORE_SEED_V2=true npm run <script>",
  );
  process.exit(1);
}
