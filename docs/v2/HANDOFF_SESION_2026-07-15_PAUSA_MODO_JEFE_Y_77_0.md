# Handoff — 2026-07-15 Pausa (modo jefe + Art. 77-0)

**Estado:** **PAUSA formal** · no seguir código hasta retoma  
**Fecha:** 2026-07-15 (~12:00 ART)  
**Guía viva:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)  
**Contrato entorno:** [`ETAPA1_GIT_Y_ENTORNOS_V2.md`](./ETAPA1_GIT_Y_ENTORNOS_V2.md) · [`ETAPA1_POLITICA_DEPLOY_V2.md`](./ETAPA1_POLITICA_DEPLOY_V2.md)

Relacionados:  
[`RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md`](./RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md) ·  
[`RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md`](./RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md) ·  
[`HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md`](./HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md)

---

## 1. Resumen ejecutivo

| Tema | Estado al pausar |
|------|------------------|
| **Modo resolución jefe** (`autorizacion` vs `toma_conocimiento`) | ✅ Código en rama; commits locales |
| **Art. 77-0** (derivación al rechazar autorización) | 🟡 Código + seed-dev listos; **smoke E2E pendiente** |
| **Vite / Firebase** | Trabajar en **`:5174`** con `npm run dev:web:dev` (−dev) |
| **Soft Launch prod (Vía A)** | Sin cambio en esta sesión |

### Próxima sesión (acordado)

1. **Probar el flujo de cada tipo de solicitud** (63 TC, 64 autorización, rechazo → 77-0, Observado sin 77-0) y **pulir detalles** de UX/copy/casos borde.
2. **Pasar en limpio cómo trabajar prod vs_dev** sin errores: programar / publicar / dos BD / Vite / CLI Firebase — mapa mental operable (borrador en §6; documento vivo a consolidar en retoma).

---

## 2. Git (foto al pausar)

| Recurso | Valor |
|---------|--------|
| Rama | `feature/modo-resolucion-jefe-v2` |
| HEAD | `8f409a1` — `chore(ops): script para parchear modo resolucion jefe…` |
| Commits feature jefe | `d851b5c` feat modo resolución jefe · `8f409a1` script patch |
| Base reciente | `7544134` / `05dbeea` (wire Vite-dev) |
| Push a `origin` | ⚠ verificar en retoma si la feature ya está pusheada |
| Stash ajeno | `stash@{0}` — `wip: archivos sueltos e instructivos soft launch` (no tocar) |

### Working tree — **sin commit** (átomo 77-0 + extras)

**Modificados (WIP 77-0 / wire):**

- `functions/modules/shared/solicitudBandejaJefeCore.js` — rechazo → derivación 77-0
- `functions/modules/shared/solicitudArt770DerivacionCore.js` (**nuevo**, untracked copy path)
- `functions/modules/shared/acumuladoInasistenciasInjustificadas.js`
- `functions/modules/shared/solicitudEventosTicketConstants.js` — `ALERTA_77_0_UMBRAL_EXCEDIDO`
- `functions/modules/shared/registrarEventoTicket.js` / `bandejaAuditorSenalesCore.js` / `etapa1RuntimeConfig.js` (tocados si entraron en el átomo)
- `functions/onCall/solicitudes/resolverDecisionJefeSolicitud.js` — exige `confirma_injustificada`
- `web/src/features/solicitudes/BandejaJefeSolicitudDetalle.jsx` — ConfirmDialog + checkbox
- `web/src/pages/BandejaJefeSolicitudes.jsx`
- `web/src/schemas/articulo.schema.js`
- `src/firebaseConfig.v2.js` — app name con `projectId` (evitar mezclar prod/dev en el tab)
- `scripts/sync-shared-to-functions.mjs`
- Docs: `RFC_ART_77_0…`, `GUIA_POLITICA_DIA_VS_TRAMO…`, `README.md`

**Untracked relevantes:**

- `docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md`
- `docs/v2/seeds/art_77_0/` (+ `applied-ids.json`)
- `scripts/seed-v2/apply-art-77-0.mjs`, `buildArt770Version.mjs`, `bootstrap-dev-lokito-subordinado.mjs`
- `shared/utils/acumuladoInasistenciasInjustificadas.js` (+ test)
- `functions/modules/shared/solicitudArt770DerivacionCore.js` (si no está solo en modified)

**No commitear** los `scripts/_tmp-*` de git status global.

**Commit pendiente al cerrar átomo (después del smoke):**  
`feat(77-0): derivación inasistencia injustificada al rechazar autorización`

---

## 3. Firebase — datos-dev tocados en esta sesión

Proyecto: **`portal-hospital-v2-dev`**  
SA local: `C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json`  
Prod SA (solo lectura/copy puntual): `C:\DATOS\portal-hospital-v2-4885ffb02c61.json`

| Qué | ID / nota |
|-----|-----------|
| Art. 77-0 | `art_01KXK3HN7Z52Q0TKPM5EE6Y0M7` / `ver_01KXK3HN80GFD52WM4WWGGY1C5` |
| 64-A / 64-B | Copiados a-dev (versión en **subcolección** `cfg_articulos/{id}/versiones/…`) · `modo_resolucion_jefe: autorizacion` |
| Allowlist Etapa 1 | Incluye 64-A/B + 63s (+ CAMBIO-DIA si aplica); **77-0 no** en wizard agente |
| Lokito | `per_01KXK214PYGN9W38CZR4SMV3XW` · DNI `1234567` / PIN `123456` · HLc con `escalafon_id: CFG_ESC_02_ADMINISTRACION` |
| Mosto (jefe) | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` · DNI `28914247` / PIN `123456` · mismo GDT · escalafón parcheado |
| GDT piloto | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` |

### Bug de hoy (resuelto en-dev)

Lokito **solo veía 63**, no 64: el filtro de elegibilidad de 64 exige escalafón Administración y el HLc tenía `escalafon_id` vacío.  
Tras el patch, listado callable devolvió: `64-A, 64-B, 63-C, 63-I, 63-D, 63-J, 63-K`.

Functions-dev ya desplegadas en la oleada 77-0: al menos `resolverDecisionJefeSolicitud` + `listarSolicitudesBandejaJefe` (confirmar en retoma si falta redeploy tras edits locales).

---

## 4. Decisiones de producto vigentes

| # | Decisión |
|---|----------|
| 1 | 63 → jefe **toma de conocimiento** (Conforme / Observado). |
| 2 | 64 → jefe **autorización** (Aprobar / Rechazar + modalidad goce). |
| 3 | **77-0 solo al Rechazar** autorización (no al Observado de 63). |
| 4 | Rechazo 64 exige checkbox / `confirma_injustificada`. |
| 5 | Umbral EGAP → evento `ALERTA_77_0_UMBRAL_EXCEDIDO` (aviso RRHH; portal no inicia cesantía). |
| 6 | Alta directa RRHH de 77-0: diferido al siguiente átomo. |

---

## 5. Checklist de retoma (próxima sesión)

### A — Smoke y pulido de flujos (prioridad)

- [ ] `npm run dev:web:dev` → **http://localhost:5174/** (no `:5173` si apunta a prod)
- [ ] Lokito: listar y ver **64-A / 64-B** además de 63
- [ ] Alta 64 → bandeja Mosto → UI **Aprobar / Rechazar** (no Conforme/Observado)
- [ ] Rechazar con confirmación → nace `sol_*` **77-0** hija + MDC
- [ ] Alta 63 → UI **Conforme / Observado** → Observado **sin** 77-0
- [ ] Pulir detalles UX / mensajes / edge cases que salgan en la prueba
- [ ] Si OK: commit único `feat(77-0): …` (sin `_tmp-*`)

### B — Mapa prod vs_dev (pasar en limpio)

- [ ] Validar/ampliar §6 de este handoff (o doc dedicado corto) hasta que sea “cheat sheet” de 1 página
- [ ] Checklist mental: ¿estoy en Vite-dev o Vite-prod? ¿CLI `firebase use`? ¿qué SA? ¿deployeé Functions al proyecto correcto?

### C — Merge / promoción (más adelante, no hoy)

- [ ] Merge feature → `develop` tras smoke
- [ ] Promoción a prod solo con flags / allowlist + UAT (política Etapa 1)

---

## 6. Mapa mental — programar vs publicar vs dos BD

> Borrador para la próxima sesión. Objetivo: que deje de costar distinguir “dónde estoy”.

### Tres capas distintas

| Capa | Qué es | Dónde |
|------|--------|--------|
| **1. Código (Git)** | Lo que programás | Ramas: `feature/*` → `develop` (arenero) → `master` (prod estable) |
| **2. Runtime Firebase** | BD + Auth + Functions + Hosting | **Dos proyectos:** `portal-hospital-v2` (prod) y `portal-hospital-v2-dev` (−dev) |
| **3. Config de negocio** | Flags, allowlist GDT/arts, versiones de artículos | Docs Firestore `cfg_etapa1/runtime`, `cfg_articulos/…/versiones` **por proyecto** |

Programar ≠ publicar: podés tener código en la rama y **aún no** desplegado a Functions/Hosting de ningún Firebase.  
Publicar ≠ encender: en prod el código puede estar desplegado con **feature flag / allowlist apagada**.

### Comandos del día a día (esta PC)

| Intención | Comando / dato |
|-----------|----------------|
| UI contra **−dev** | `npm run dev:web:dev` → **http://localhost:5174/** · lee `.env.v2.dev.local` |
| UI contra **prod** (piloto) | `npm run dev:web` → suele ser `:5173` · lee `.env.v2.local` · **cuidado** |
| Deploy Functions/Rules a **−dev** | `firebase use_dev` → deploy → **`firebase use prod`** al terminar |
| Deploy a **prod** | Solo tras merge/`master` + política deploy · alias `prod` |
| Scripts Admin −dev | `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-….json"` + `FIREBASE_V2_PROJECT_ID=portal-hospital-v2-dev` |
| Scripts Admin prod | SA `C:\DATOS\portal-hospital-v2-4885ffb02c61.json` · **nunca seed agresivo** sin decisión explícita |

### Anti-errores ya vivídos

1. **Vite viejo en `:5173`** seguía en prod mientras creías estar en-dev → matar ese proceso; usar `:5174` + mode `v2-dev`.
2. **App Firebase mismo nombre** reutilizaba instancia → `src/firebaseConfig.v2.js` usa `portal-hospital-v2-${projectId}`.
3. **Artículos 64 sin escalafón** en HLc demo → no aparecen en listado aunque estén en allowlist.
4. Versiones de artículos viven en **`cfg_articulos/{artId}/versiones/{verId}`** (subcolección), no solo en colección flat.

### Diagrama corto

```text
  [programar]  feature/*  ──merge──►  develop  ──merge+UAT──►  master
                    │                      │                      │
                    ▼                      ▼                      ▼
              (opcional)              Firebase-dev           Firebase-prod
              deploy-dev              datos de prueba         Soft Launch
                    │                      │                      │
                    └──── flags/allowlist en CFG de ESA BD ───────┘
```

---

## 7. Cuentas demo (−dev)

| Rol | DNI | PIN | persona_id |
|-----|-----|-----|------------|
| Agente Lokito | `1234567` | `123456` | `per_01KXK214PYGN9W38CZR4SMV3XW` |
| Jefe Mosto | `28914247` | `123456` | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` |

---

## 8. Frase de continuación (copiar al reabrir chat)

> Retomar desde `docs/v2/HANDOFF_SESION_2026-07-15_PAUSA_MODO_JEFE_Y_77_0.md`: smoke E2E 63/64/77-0 en `:5174` (−dev), pulir detalles de cada solicitud, y pasar en limpio el mapa prod vs_dev (Git / dos BD / Vite / deploy). WIP 77-0 sin commit en rama `feature/modo-resolucion-jefe-v2`.
