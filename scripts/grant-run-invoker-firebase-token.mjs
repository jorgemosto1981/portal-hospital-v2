/**
 * Otorga roles/run.invoker a allUsers en servicios Cloud Run (callables Gen2)
 * usando el access_token de `firebase login` (configstore).
 *
 * Uso: node scripts/grant-run-invoker-firebase-token.mjs [serviceId ...]
 * Sin args: solo cerrarperiodoliquidacion y reabrirperiodoliquidacion.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "portal-hospital-v2";
const REGION = "southamerica-east1";
const DEFAULT_SERVICES = ["cerrarperiodoliquidacion", "reabrirperiodoliquidacion"];

function firebaseToolsPath() {
  return join(homedir(), ".config", "configstore", "firebase-tools.json");
}

function getAccessToken() {
  const cfg = JSON.parse(readFileSync(firebaseToolsPath(), "utf8"));
  const t = cfg.tokens;
  if (!t?.access_token) {
    throw new Error("Sin tokens. Ejecutá: npx firebase login");
  }
  if (t.expires_at && Date.now() > Number(t.expires_at) - 60_000) {
    throw new Error("Token Firebase expirado. Ejecutá: npx firebase login --reauth");
  }
  return t.access_token;
}

async function getIamPolicy(token, serviceId) {
  const name = `projects/${PROJECT}/locations/${REGION}/services/${serviceId}`;
  const url = `https://run.googleapis.com/v1/${name}:getIamPolicy`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`getIamPolicy ${serviceId} ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

async function setIamPolicy(token, serviceId, policy) {
  const name = `projects/${PROJECT}/locations/${REGION}/services/${serviceId}`;
  const url = `https://run.googleapis.com/v1/${name}:setIamPolicy`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ policy }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`setIamPolicy ${serviceId} ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

function ensurePublicInvoker(policy) {
  const bindings = Array.isArray(policy.bindings) ? [...policy.bindings] : [];
  let inv = bindings.find((b) => b.role === "roles/run.invoker");
  if (!inv) {
    inv = { role: "roles/run.invoker", members: [] };
    bindings.push(inv);
  }
  if (!inv.members.includes("allUsers")) {
    inv.members = [...inv.members, "allUsers"];
  }
  return { ...policy, bindings };
}

async function main() {
  const services = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SERVICES;
  const token = getAccessToken();

  for (const serviceId of services) {
    console.log(`→ ${serviceId}`);
    const policy = await getIamPolicy(token, serviceId);
    const next = ensurePublicInvoker(policy);
    await setIamPolicy(token, serviceId, next);
    console.log(`  OK invoker allUsers`);
  }
  console.log("\nListo. Probá de nuevo el OPTIONS/POST desde la grilla.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
