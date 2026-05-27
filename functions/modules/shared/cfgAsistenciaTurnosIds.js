/** IDs cfg asistencia — SSoT scripts/seed-v2/seed-ids-asistencia-turnos.v2.json */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const seedIds = JSON.parse(readFileSync(join(__dirname, "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json"), "utf8"));
export const CFG_EPL_LIQUIDADO_CERRADO = seedIds.cfg_estado_periodo_liquidacion.LIQUIDADO_CERRADO;
export const CFG_TOV_COBERTURA_PARCIAL = seedIds.cfg_tipo_override_turno.COBERTURA_PARCIAL;
export default seedIds;