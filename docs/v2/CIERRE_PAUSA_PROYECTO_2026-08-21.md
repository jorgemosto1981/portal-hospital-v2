# CIERRE / PAUSA DE PROYECTO — Portal Hospital V2

**Fecha de pausa:** 2026-08-21  
**Estado:** **PAUSADO** — no hay trabajo activo en curso. El código útil está en remoto y desplegado.  
**Motivo:** se cierra el foco de desarrollo en este repositorio para comenzar un proyecto nuevo, totalmente distinto.  
**Rama ancla:** `develop` @ `642c9ba` (sincronizada con `origin/develop`)  
**Repo remoto:** https://github.com/jorgemosto1981/portal-hospital-v2.git  

> **Documento de entrada al volver.** Si alguien reabre el portal V2 en otra máquina o en otra sesión, leer **este archivo primero**. El detalle técnico de la última sesión productiva está en [`HANDOFF_SESION_2026-07-31_BANDEJAS_JEFE_Y_RRHH.md`](./HANDOFF_SESION_2026-07-31_BANDEJAS_JEFE_Y_RRHH.md).

---

## 1. Qué es este proyecto (contexto rápido)

Portal hospitalario **V2**: React/Vite (`web/`), Cloud Functions Gen2 (`functions/`), Firestore V2 (proyecto Firebase **separado** de la V1), contratos en `docs/v2/`.

| Entorno | Proyecto Firebase | Hosting |
|---------|-------------------|---------|
| Producción | `portal-hospital-v2` | https://portal-hospital-v2.web.app |
| Desarrollo | `portal-hospital-v2-dev` | https://portal-hospital-v2-dev.web.app |

**Regla dura:** V2 no lee/escribe datos ni Auth de V1. Ancla de negocio: `persona_id` (`per_<ULID>`). Listas de negocio vía `cfg_*`.

Índice de documentación: [`docs/v2/README.md`](./README.md).  
Reglas Cursor: `.cursor/rules/` (modo atómico mobile-first, feature-first, sin seeds recurrentes a Firestore salvo excepción explícita).

---

## 2. Estado al pausar (2026-08-21)

| Capa | Estado |
|------|--------|
| Git `develop` ↔ `origin/develop` | **Al día** en `642c9ba` |
| Hosting prod | Desplegado (última tanda 2026-07-31: bandejas jefe/RRHH + Art. 64) |
| Hosting -dev | Desplegado (misma tanda) |
| Functions selectivas (Art. 64 + bandejas) | Desplegadas en **prod y -dev** |
| Índices Firestore bandeja jefe | READY (prod y -dev) |
| Soft Launch / Etapa 1 | Soft launch acotado; no es “cerrado de producto”, pero **este repositorio queda en pausa de desarrollo** |
| Trabajo N3 / N2 (RFC escalabilidad) | **No empezado** (diseñado y priorizado; ver §5) |

### Único cambio local sin sincronizar

```
M docs/v2/seeds/p4_art1619/ART16_19_P44_SPECS.json
```

- **No** forma parte de la sesión de bandejas / Art. 64.  
- Viene de otra línea (P4 Art. 16/19).  
- **No está en el remoto.** Si se retoma Art. 16/19, decidir si se descarta o se committea aparte.  
- Al pausar (2026-08-21) se deja **intencionalmente sin commit**.

---

## 3. Qué quedó listo y desplegado (último hito productivo)

Sesión 2026-07-30 → 2026-07-31. Commits en `develop` (ya pusheados):

| Hash | Tema |
|------|------|
| `f2496f0` | Bandeja jefe: “Bandeja de Evaluación”, detalle sin datos técnicos, N1 + `orderBy(fecha_desde)` |
| `2c592b3` | Art. 64: modalidad desde cfg + saldo al jefe |
| `610d24e` / `bf5d365` / `71682a4` | Etiquetas neutras chip familia 64 (código, nombre, calificador) |
| `757ca04` | RFC: auditoría snapshots; N3 antes que N2 |
| `2803b59` | Bandeja RRHH: detalle legible, trazabilidad, motor lazy, filtros completos |
| `642c9ba` | Handoff detallado de esa sesión |

### Producto usable hoy

1. **Bandeja de Evaluación (jefe)** — `/portal/jefe/solicitudes`  
   - Autorizar / rechazar; Art. 64 elige modalidad desde el par cfg del agente; saldo bajo demanda; bloqueo si sin goce no alcanza.
2. **Circuito Art. 64** — chip unificado “64 / ASUNTOS PARTICULARES” hasta que el jefe define modalidad; pares ADMIN y ½ carga; check-in de bolsas requerido.
3. **Bandeja de revisión de solicitudes (RRHH)** — `/portal/rrhh/solicitudes-articulo`  
   - TC pendiente; filtros por catálogo completo (salvo borrador); trazabilidad cruce 64-A→64-B y vínculo 77-0; veredicto motor bajo demanda.

### Callables nuevos de esa tanda (IAM `allUsers` invoker verificado)

- `obtenerResumenSaldoFamilia64Jefe`
- `obtenerVeredictoMotorSolicitudRrhh`

Más el resto del circuito 64 ya listado en [`HANDOFF_ART64_PROD_2026-07-30.md`](./HANDOFF_ART64_PROD_2026-07-30.md).

### Incidente 429 (prod, 2026-07-30)

Fue cuarentena Cloud Run/GFE (billing + retries), **no** bug de CORS ni del circuito 64. Se levantó solo. Documentado en el handoff del 30-jul.

---

## 4. Mapa de documentación (dónde mirar cada cosa)

| Necesidad | Documento |
|-----------|-----------|
| **Este cierre / pausa** | Este archivo |
| Última sesión técnica (detalle) | [`HANDOFF_SESION_2026-07-31_BANDEJAS_JEFE_Y_RRHH.md`](./HANDOFF_SESION_2026-07-31_BANDEJAS_JEFE_Y_RRHH.md) |
| Promoción Art. 64 + 429 | [`HANDOFF_ART64_PROD_2026-07-30.md`](./HANDOFF_ART64_PROD_2026-07-30.md) |
| Escalabilidad bandeja jefe (N1/N2/N3) | [`RFC_BANDEJA_JEFE_ESCALABILIDAD_LECTURA_V2.md`](./RFC_BANDEJA_JEFE_ESCALABILIDAD_LECTURA_V2.md) |
| Soft Launch / Etapa 1 | [`HANDOFF_SESION_2026-07-08_SOFT_LAUNCH_ETAPA1.md`](./HANDOFF_SESION_2026-07-08_SOFT_LAUNCH_ETAPA1.md) · [`ETAPA1_GO_LIVE_V2.md`](./ETAPA1_GO_LIVE_V2.md) |
| Índice completo | [`README.md`](./README.md) |
| Schema front | `web/SCHEMA.md` |
| Continuidad / otra PC (histórico) | [`HANDOFF_CONTINUIDAD_2026-04-25.md`](./HANDOFF_CONTINUIDAD_2026-04-25.md) |

---

## 5. Backlog al reabrir (orden acordado)

### Prioritario (arquitectura)

1. **N3 — refrescar `autorizadores_elegibles_ids`** cuando cambia la jerarquía (HLg / grupos), **antes** de N2.  
   Motivo: sin N3, filtrar por snapshot (N2) deja invisibles trámites si un jefe gana permiso después del alta. Evidencia en prod: `autorizacion_rrhh_sustituta=true` con array vacío.
2. **N2 — query Firestore** `array-contains autorizadores_elegibles_ids` + cursores reales; retirar `SCAN_LIMIT`.  
   Luego N1 (memoización) pierde peso y se puede retirar.

### Conocido, no bloqueante

3. Test obsoleto `modoListadoArticulosIngreso` (espera `"mvp"`, whitelist vacía → `"catalogo"`). Suite ~598/599.
4. Deploy full `firebase deploy --only functions` **aborta**: remoto tiene `listarColeccionesCfgBatch` y el repo local no. Siempre desplegar **selectivo** `--only functions:nombre,...`.
5. `modalidad_goce_jefe` no viaja al ítem de bandeja RRHH (se infiere del artículo final + motivo).
6. Seed local sin commit: `ART16_19_P44_SPECS.json` (ver §2).
7. Soft Launch / UAT Etapa 1: backlog en handoff 2026-07-08 (independiente del hito bandejas).

### No hacer al reabrir “en caliente”

- No martillar callables en prod tras deploys masivos (riesgo 429).  
- No `firebase deploy --only functions` completo sin resolver `listarColeccionesCfgBatch`.  
- No seeds / scripts `seed:*` contra Firestore sin `ALLOW_FIRESTORE_SEED_V2=true` y acuerdo explícito.

---

## 6. Cómo reabrir el proyecto (otra PC o más adelante)

```bash
git clone https://github.com/jorgemosto1981/portal-hospital-v2.git
cd portal-hospital-v2
git checkout develop
git pull

npm install
npm install --prefix web
npm install --prefix functions

node scripts/sync-shared-to-functions.mjs
npm run dev:web:dev    # Vite → http://localhost:5173 contra -dev
```

Verificación mínima:

```bash
node --test functions/test/solicitudBandejaRrhhListar.test.js
npm run build:web
```

Deploy (recordatorio):

```bash
# Functions: SIEMPRE selectivo
npx firebase deploy --project portal-hospital-v2-dev --only functions:nombre1,functions:nombre2

# Hosting
npm run build:web:dev && npx firebase deploy --project portal-hospital-v2-dev --only hosting
npm run build:web     && npx firebase deploy --project portal-hospital-v2     --only hosting
```

Invoker público si un callable nuevo falla con CORS falso (403):

```bash
gcloud run services add-iam-policy-binding <nombre-en-minuscula-con-guiones> \
  --project=portal-hospital-v2 --region=southamerica-east1 \
  --member="allUsers" --role="roles/run.invoker"
```

Al reabrir: **primera tarea técnica recomendada = diseño/implementación de N3** (no N2 suelto).

---

## 7. Inventario técnico breve (rutas y piezas)

| Pieza | Ruta / archivo |
|-------|----------------|
| App Vite | `web/` |
| Callables | `functions/onCall/`, export `functions/index.js` |
| Shared sync | `shared/utils/` → `scripts/sync-shared-to-functions.mjs` → `functions/modules/shared/` |
| Rules / índices | `firebase-v2/firestore.rules`, `firebase-v2/firestore.indexes.json` |
| Bandeja jefe core | `functions/modules/shared/solicitudBandejaJefeCore.js` |
| Bandeja RRHH core | `functions/modules/shared/solicitudBandejaRrhhCore.js` |
| Familia 64 chip | `shared/utils/familia64Chip.js` |
| Trazabilidad resolución | `functions/modules/shared/solicitudTrazabilidadResolucion.js` |
| Audit snapshots | `scripts/seed-v2/auditar-snapshot-autorizadores.mjs` |

Menú (cuidado: **dos** ítems “Bandeja solic.”):

- Jefe → `/portal/jefe/solicitudes`  
- RRHH → `/portal/rrhh/solicitudes-articulo`  

---

## 8. Cierre operativo de esta pausa

- [x] Código de la última sesión commiteado y en `origin/develop`  
- [x] Hosting + functions relevantes en prod y -dev (2026-07-31)  
- [x] Handoff de sesión 2026-07-31  
- [x] Este documento de **pausa / cierre de foco** (2026-08-21)  
- [x] Índice `docs/v2/README.md` actualizado apuntando aquí  
- [ ] Trabajo nuevo en este repo: **no** — hasta decisión explícita de retomar  
- [ ] `ART16_19_P44_SPECS.json` local: **fuera de sync** (consciente)

**Próximo paso humano:** abrir el proyecto nuevo distinto. Este repositorio queda como archivo vivo + prod/dev operativos, sin desarrollo activo.

---

*Última actualización de este cierre: 2026-08-21.*
