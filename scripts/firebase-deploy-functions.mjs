/**
 * Deploy de Cloud Functions con FUNCTIONS_DISCOVERY_TIMEOUT ampliado.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.FUNCTIONS_DISCOVERY_TIMEOUT) {
  process.env.FUNCTIONS_DISCOVERY_TIMEOUT = "60";
}

const r = spawnSync(
  "npx",
  ["firebase", "deploy", "--project", "portal-hospital-v2", "--only", "functions"],
  {
    stdio: "inherit",
    cwd: repoRoot,
    env: process.env,
    shell: true,
  },
);

process.exit(r.status === null ? 1 : r.status);
