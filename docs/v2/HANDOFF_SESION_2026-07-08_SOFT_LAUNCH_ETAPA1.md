# Handoff — Soft Launch Etapa 1 / CAMBIO-DIA (pausa 2026-07-08)

> **Continúa en:** [`HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md`](./HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md) (UX Mis solicitudes/acuse, CAMBIO-DIA, rules fix, calendario consulta).

**Estado:** implementación Soft Launch **pausada** en este punto · continuar en próxima sesión desde otra PC  
**Commit de pausa:** Soft Launch UI (TC, Mis solicitudes, ventana ±10 días) + docs/handoff + IDs prod  
**Repo alineado post-push:** `master` = `develop` = `origin/*`  
**Prod Firebase:** `portal-hospital-v2` · Hosting https://portal-hospital-v2.web.app  

Relacionados: [`CHECKLIST_UAT_ETAPA1_V2.md`](./CHECKLIST_UAT_ETAPA1_V2.md) · [`CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md`](./CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md) · [`ETAPA1_GO_LIVE_V2.md`](./ETAPA1_GO_LIVE_V2.md) · seeds [`seeds/cambio_dia/`](./seeds/cambio_dia/)

---

## 1. Dónde quedamos (punto de continuación)

### Hecho en código + desplegado (prod)

| Pieza | Detalle |
|-------|---------|
| CAMBIO-DIA seed | Apply OK · IDs en [`seeds/cambio_dia/applied-ids.json`](./seeds/cambio_dia/applied-ids.json) |
| Wizard dedicado | `TicketeraCambioDia` · labels Soft Launch · justificativo obligatorio |
| Toma de conocimiento | Checkbox obligatorio; persistido en `sol_*` (`toma_conocimiento_agente` / `_texto`) |
| Ventana fechas | **±10 días corridos** entre ausencia inicial y prestación destino (UI min/max + warning + validación server) |
| Mis solicitudes | Panel en hub ticketera · lectura Firestore del titular · estados legibles |
| Aprobación jefe → B-BATCH | `aplicarCambioDiaTrasAprobacion` · fallo → `cfg_esa_aprobada_pendiente_aplicacion` |
| Allowlist runtime | `cfg_etapa1/runtime` |

### IDs operativos prod (no reinventar)

| Recurso | ID |
|---------|-----|
| Artículo CAMBIO-DIA | `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H` |
| Versión publicada | `ver_01KX0Z07N70GZKBKF1P27C78SY` |
| GDT piloto Soft Launch | `gdt_01KX107ZZTPKF12A1ED2XVKNMM` (*Personal MediaCarga Etapa 1*) |
| Código técnico (ABM) | `CAMBIO-DIA` / grilla `C-DIA` |
| Título UI | **Cambio de Día de Asistencia** |

### `cfg_etapa1/runtime` (prod — última config conocida)

- `etapa1_habilitada`: **true**
- `articulo_ids_etapa1`: 64-A, 64-B, 63.j + `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H`
- `gdt_ids_etapa1`: `[gdt_01KX107ZZTPKF12A1ED2XVKNMM]`
- Superficies LAO / LM / jefe GSO: **false**

---

## 2. Qué NO cerramos (backlog próxima sesión)

1. **UAT Soft Launch en vivo** (checklist): agente (64-A + CAMBIO-DIA) → jefe bandeja → B-BATCH en grilla del GDT ancla; rechazo sin mutar día.
2. **Altas RRHH** restantes: 5–10 agentes, 1–2 jefes, jerarquías, saldos 64-A/B.
3. **Elegibilidad celda RDA** (origen laborable / destino franco) — contrato lo pide; hoy validación fuerte es fechas/preaviso/ventana/motivo/TC; capa grilla teórica puede reforzarse.
4. **Go/No-Go oleada** 70–80 usuarios tras Soft Launch (umbral ≤2 remediaciones `pendiente_aplicacion`).

---

## 3. Cómo retomar en otra PC

```bash
git clone https://github.com/jorgemosto1981/portal-hospital-v2.git
# o en clone existente:
git fetch origin
git checkout master
git pull origin master
# arenero:
git checkout develop
git pull origin develop
```

Credenciales: `.env.v2.local` **no va en git** (ADC / `GOOGLE_APPLICATION_CREDENTIALS`). Replicar en la otra máquina.

Seeds / flags (solo si hace falta reaplicar, no duplicar CAMBIO-DIA sin `--reapply`):

```bash
# dry-run
npm run seed:cambio-dia:dry-run
# cfg etapa1
ALLOW_FIRESTORE_SEED_V2=true npm run seed:cfg-etapa1
```

Deploy (PowerShell: comillas en `--only` por las comas):

```bash
npm run build:web
firebase deploy --only "firestore:rules,hosting" --project portal-hospital-v2
npm run firebase:deploy:functions -- --only functions
```

---

## 4. Archivos clave Soft Launch / CAMBIO-DIA

| Ámbito | Path |
|--------|------|
| Wizard | `web/src/pages/TicketeraCambioDia.jsx` |
| Hook | `web/src/features/solicitudes/useSolicitudCambioDiaAlta.js` |
| UI helpers | `web/src/features/solicitudes/cambioDiaUi.js` |
| Mis solicitudes | `web/src/features/solicitudes/MisSolicitudesPanel.jsx` |
| Hub | `web/src/pages/TicketeraHub.jsx` |
| Core validación | `functions/modules/shared/cambioDiaSolicitudCore.js` |
| Post-aprobación B-BATCH | `functions/modules/shared/cambioDiaAplicarTrasAprobacion.js` |
| Bandeja jefe hook | `functions/modules/shared/solicitudBandejaJefeCore.js` |
| Trigger alta | `functions/triggers/solicitudArticuloPatronBOnCreate.js` |
| Rules create | `firebase-v2/firestore.rules` (`keysCambioDia` + TC) |
| Seed | `scripts/seed-v2/apply-cambio-dia.mjs` · `seed-cfg-etapa1-runtime.mjs` |

---

## 5. Contrato de negocio vigente (resumen)

- Preaviso interno: **2 días** (ABM).
- Ventana origen↔destino: **máx. 10 días corridos**.
- No retroactivo.
- Sin cupo / sin saldo.
- Requiere jefe; exceptional/sanitario — no motivos particulares (texto TC).
- Storage fechas: `YYYY-MM-DD`; UI hint: `DD-MM-YYYY`.
- Aplicación: B-BATCH en GDT de la solicitud; rechazo → sin cambio de asistencia.

---

**Pausa formal Soft Launch / CAMBIO-DIA · 2026-07-08** — retomar UAT + altas RRHH en la próxima sesión.
