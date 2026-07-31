# Handoff — Circuito Art. 64 en prod + bloqueo 429

**Fecha pausa:** 2026-07-30 ~11:20 ART  
**Rama local:** `develop` @ `2183088` (cambios Art. 64 **sin commit**)  
**Continuar:** 2026-07-31

---

## Objetivo de la sesión

Promover a **prod** el circuito completo Art. 64 (familia config-driven, ½ carga, saldos, jefe, acuse) y probarlo con cfg activa (cupo, retro, etc.).

---

## Hecho (queda listo)

### Firestore prod (`portal-hospital-v2`)

Pares `familia_64_par_articulo_id` seteados (script `scripts/seed-v2/patch-familia64-pares-prod.mjs`):

| Artículo | ID | Par | Cupo | Retro | Escalafón |
|----------|-----|-----|------|-------|-----------|
| 64-A | `art_01KRNK10V10CH7W5M2W6V558GS` | ↔ 64-B | 6 | true | ADMIN |
| 64-B | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` | ↔ 64-A | 6 | true | ADMIN |
| 64-A ½ | `art_01KTTZZ6841BHNTR479X74M67S` | ↔ 64-B ½ | 3 | true | PROF |
| 64-B ½ | `art_01KYSF5SSNM8PQERBK0GB9HREW` | ↔ 64-A ½ | 3 | true | PROF |

También: 64-B `modo_resolucion_jefe=autorizacion` (antes vacío).

**No se tocaron** cupos/frecuencia/evento/retro de las versiones publicadas (cfg RRHH intacta).

### Hosting prod

- Build: `npm run build:web`
- Deploy OK → https://portal-hospital-v2.web.app

### Functions prod (parcial)

Deploy selectivo Art. 64 (**ACTIVE** al momento del deploy ~13:54 UTC):

- `obtenerResumenSaldoFamilia64Agente` *(nueva)*
- `obtenerContextoAcuseSinGoceAgente` *(nueva)*
- `registrarAcuseSinGoceAgente` *(nueva)*
- `listarArticulosIngresoAgente` / `listarArticulosIngresoPorRol`
- `previsualizarSolicitudPatronB`
- `resolverDecisionJefeSolicitud`
- `onSolicitudArticuloPatronBOnCreate`
- `listarSolicitudesBandejaJefe`
- `reprocesarMdcSolicitudPatronB`

**Nota:** un `firebase deploy --only functions` full aborta porque en remoto existe `listarColeccionesCfgBatch` y **no** está en el código local. Usar `--only functions:nombre,...` o decidir borrar/reincorporar esa fn.

### Billing

| Proyecto | Cuenta |
|----------|--------|
| prod | `017AB6-66F9FD-E683FD` (misma que -dev; se relinkeó el 2026-07-30) |
| -dev | `017AB6-66F9FD-E683FD` |

Cuenta anterior de prod `016F8A-B8B597-C5A048` estuvo **cerrada** y provocó el primer bloqueo de upload (403 billing).

### Código local pendiente de commit (Art. 64)

- Nuevo: `functions/modules/shared/familia64Config.js`, tests, scripts seed/sync/patch
- Modificados: motor Patrón B, listar ingreso, bandeja jefe, resumen saldo, UI ticketera/saldo/jefe, schema, `functions/index.js` (re-exports)

---

## Bloqueo al pausar — HTTP 429 “Rate exceeded”

### Síntoma en browser

Firefox reporta **CORS Missing Allow Origin**, pero el status real es **429**. Las respuestas 429 de GFE no traen CORS → el navegador lo disfraza.

Cookies `_ga*` = ruido analytics; ignorar.

### Alcance

- Afecta callables de **prod** (login incluido: `resolverEmailLoginDni`).
- **-dev responde bien** (OPTIONS 204).
- También falla `gcloud functions call` → no es solo IP del browser.

### Acciones ya intentadas

1. Relink billing prod → `017AB6…` (OK; alivio parcial breve).
2. Cooldowns 1–3 min (insuficiente mientras se sigue probando).
3. Annotation noop en Cloud Run login.
4. **Delete + redeploy** de `resolverEmailLoginDni` → brevemente 403 (sin `allUsers` invoker); tras restaurar invoker público volvió 429.

### Hipótesis

Throttle / cuarentena de Cloud Run–GFE en el proyecto prod tras cierre/reapertura de billing + ráfaga de retries. No es un bug de CORS ni del circuito 64 en sí.

---

## Mañana — checklist de arranque

1. **No martillar refresh** en prod. Una sola prueba de login.
2. Probar OPTIONS (una vez):
   ```powershell
   Invoke-WebRequest -Method OPTIONS `
     -Uri "https://southamerica-east1-portal-hospital-v2.cloudfunctions.net/resolverEmailLoginDni" `
     -Headers @{ Origin="https://portal-hospital-v2.web.app"; "Access-Control-Request-Method"="POST" }
   ```
   - Esperado sano: **204** + `Access-Control-Allow-Origin`
   - Si sigue **429**: esperar más o ticket Google Cloud Support (billing/quotas Cloud Run southamerica-east1).
3. Si login OK → smoke Art. 64:
   - Agente ADMIN: chip unificado **64**, saldos A/B
   - Alta con goce / redirección sin goce si cupo mes
   - Jefe autorizar con/sin goce o rechazar
   - PROF ½ carga: cupo 3
   - Retroactividad según cfg (`true`)
   - RRHH + acuse sin goce si aplica
4. Si `resolverEmailLoginDni` quedó sin invoker tras algún redeploy:
   ```powershell
   gcloud run services add-iam-policy-binding resolveremaillogindni `
     --project=portal-hospital-v2 --region=southamerica-east1 `
     --member="allUsers" --role="roles/run.invoker"
   ```
5. Commit pendiente del código Art. 64 en `develop` (solo si se pide).
6. Evitar `firebase deploy --only functions` full sin resolver `listarColeccionesCfgBatch`.

### URLs

- Prod: https://portal-hospital-v2.web.app  
- -dev (referencia sana): proyecto `portal-hospital-v2-dev`

### Scripts útiles

- `scripts/seed-v2/patch-familia64-pares-prod.mjs` — pares prod (ya corrido)
- `scripts/seed-v2/sync-familia64-pares-dev.mjs` — sync -dev
- `scripts/seed-v2/seed-saldo-familia64-dev.mjs` — saldos prueba -dev

---

## Estado resumido

| Capa | Estado |
|------|--------|
| Cfg Firestore familia 64 prod | Listo |
| Hosting prod | Desplegado |
| Functions Art. 64 prod | Desplegadas; runtime bloqueado por 429 |
| Login prod | Bloqueado por 429 en `resolverEmailLoginDni` |
| Código repo | Cambios locales sin commit |
| Prueba funcional circuito 64 en prod | **Pendiente** (espera fin del 429) |
