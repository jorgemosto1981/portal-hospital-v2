# Guía Etapa 1 — dónde estamos y por dónde seguimos

**Fecha foto:** 2026-07-14 (actualizada post-deploy `6dee722`)  
**Objetivo del plan:** habilitar la web piloto para un cupo controlado (~5–10 Soft Launch → ~70–80 oleada) **y** seguir desarrollando el resto de V2 en paralelo, encendiendo novedades con flags.

**Documentos de contrato (no sustituye; resume):**  
[`ETAPA1_GIT_Y_ENTORNOS_V2`](./ETAPA1_GIT_Y_ENTORNOS_V2.md) · [`ETAPA1_POLITICA_DEPLOY_V2`](./ETAPA1_POLITICA_DEPLOY_V2.md) · [`ETAPA1_GO_LIVE_V2`](./ETAPA1_GO_LIVE_V2.md) · [`ACTA_RRHH_ETAPA1_VIDA_REAL_V2`](./ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md) · [`CHECKLIST_UAT_ETAPA1_V2`](./CHECKLIST_UAT_ETAPA1_V2.md) · [`ETAPA1_FIREBASE_DEV_SETUP_V2`](./ETAPA1_FIREBASE_DEV_SETUP_V2.md)

**Pausa / retoma:** [`HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md`](./HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md) · detalle oleada [`HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md`](./HANDOFF_SESION_2026-07-14_SOFT_LAUNCH_UX_RULES_CALENDARIO.md)

---

## 1. Veredicto: ¿vamos cumpliendo el plan?

**Sí en arquitectura, candados y deploy Soft Launch UX; Soft Launch de negocio (UAT + altas) pendiente.**

| Eje del plan | Estado | Notas |
|--------------|--------|--------|
| Docs UAT / Deploy / Acta / Go-Live / Git | ✅ | Persistidos y aceptados 2026-07-08 |
| Tag inmutable `v0.9.0-base` | ✅ | `d58b73a` ← commit `f6ac0cc` (antes de commits Etapa 1) |
| Rama `master` = prod estable Etapa 1 | ✅ | `6dee722` (Soft Launch UX + acuse + calendario) |
| Rama `develop` arenero | ✅ | Igual a `master` / `origin/*` @ `6dee722` |
| Candados `cfg_etapa1/runtime` + filtro catálogo | ✅ | Prod; LAO/LM/GSO jefe **off** |
| CAMBIO-DIA + B-BATCH + UX + rules | ✅ en prod | UAT vivo pendiente |
| Soft Launch 5–10 (Día D) | ⏳ | Hosting listo; faltan UAT firmado + altas RRHH |
| Oleada ~70–80 | ⏳ | Solo tras Go Soft Launch |
| Firebase `portal-hospital-v2-dev` | ⚠️ creado | Sin Firestore/Auth/app Web operativos |
| Desarrollo paralelo features grandes en-dev | ⏳ | Próxima prioridad técnica (Vía B) |

### Orden ejecutivo (`ETAPA1_GIT_Y_ENTORNOS` §4)

| Paso | Qué | Estado |
|------|-----|--------|
| 0 | Docs + tag `v0.9.0-base` + rama `develop` | ✅ |
| 1 | Crear `portal-hospital-v2-dev` | ✅ proyecto · ❌ setup APIs/app |
| 2 | `cfg_etapa1` / feature flags | ✅ prod |
| 3 | Candados allowlist / catálogo / hide superficies | ✅ |
| 4 | CAMBIO-DIA + B-BATCH | ✅ prod · ⏳ UAT |
| 5 | GDT nuevos + Soft Launch 5–10 | ⏳ negocio (altas + UAT) |

---

## 2. Foto Git / Firebase (corroborado 2026-07-14)

| Recurso | Valor |
|---------|--------|
| `origin/master` | `6dee722` Soft Launch UX + deploy |
| `origin/develop` | **mismo** `6dee722` |
| Tag `v0.9.0-base` | `d58b73a` → `f6ac0cc` (baseline pre-Etapa1) |
| Working tree | Solo `scripts/_tmp-*` untracked |
| Prod Firebase | `portal-hospital-v2` · https://portal-hospital-v2.web.app |
| Dev Firebase | `portal-hospital-v2-dev` · alias `dev` · **sin app Web · Firestore API no habilitada** |
| Rules CAMBIO-DIA | **En prod** |
| Hosting Soft Launch UX | **En prod** (`6dee722`) |

### Convención de trabajo (reafirmar)

```text
master   →  solo lo que va (o ya va) a prod piloto Etapa 1
develop  →  arenero paralelo (features apagadas o solo-dev)
feature/* →  desde develop (o hotfix corto desde master)
```

Si en esta PC no ves `develop`:

```powershell
git fetch origin
git checkout -b develop origin/develop
```

---

## 3. Dos vías en paralelo (el modelo objetivo)

```mermaid
flowchart LR
  subgraph piloto [Prod piloto Etapa 1]
    A[Allowlist GDT + arts] --> B[Soft Launch 5-10]
    B --> C{Go Soft Launch?}
    C -->|si| D[Oleada hasta 70-80]
    C -->|no| E[Remediar / fix master]
  end
  subgraph paralelo [Desarrollo paralelo]
    F[develop + portal-hospital-v2-dev] --> G[Feature con flag OFF]
    G --> H[Merge a master apagada]
    H --> I[Encender flag en cfg tras UAT]
  end
  piloto -. no bloquea .- paralelo
```

| Vía | Proyecto | Rama | Qué entra |
|-----|----------|------|-----------|
| **A — Cupo usuarios** | `portal-hospital-v2` | `master` | Fixes/UX Etapa 1, rules/functions del circuito, datos RRHH piloto |
| **B — Resto V2** | `portal-hospital-v2-dev` (cuando esté listo) | `develop` / `feature/*` | LAO, médicas, GSO jefes, experimentos; a prod solo **apagados** hasta acta |

Hasta que-dev esté usable: en prod **solo** entregas Etapa 1 (moratoria).

---

## 4. Ruta inmediata (ordenado)

### Hecho — paquete local cerrado (2026-07-14)

1. ~~Commit oleada~~ → `6dee722`  
2. ~~Smoke~~ (acordado verde)  
3. ~~Deploy functions acuse + hosting~~ → https://portal-hospital-v2.web.app  
4. ~~`master` / `develop` alineados en `origin`~~  

### Ahora — Soft Launch (cupo real / negocio)

5. Completar **UAT** [`CHECKLIST_UAT_ETAPA1_V2`](./CHECKLIST_UAT_ETAPA1_V2.md) en vivo (o smoke firmado).  
6. RRHH: altas restantes (5–10 agentes, 1–2 jefes), HLg/HLc, check-in 64, jerarquías.  
7. Día D Soft Launch → revisión 48–72 h → **Go/No-Go oleada**.  
8. Oleada por tandas hasta ~70–80 (siempre vía GDT en `gdt_ids_etapa1`).

### En paralelo (próxima sesión técnica) — habilitar-dev

9. Consola `portal-hospital-v2-dev`: Firestore + Auth + Storage + Blaze + app Web.  
10. `.env.v2.dev.local` + script Vite `dev:web` apuntando a-dev.  
11. `firebase use dev` → deploy rules/indexes (+ functions).  
12. Seed mínimo `cfg_etapa1` + datos de prueba.  
13. Features grandes solo contra-dev; a `master` con flags **false**.

Checklist detallada-dev: [`ETAPA1_FIREBASE_DEV_SETUP_V2`](./ETAPA1_FIREBASE_DEV_SETUP_V2.md).

---

## 5. Superficie Etapa 1 (qué está “habilitable”)

| Trámite / rol | Estado producto |
|---------------|-----------------|
| 64-A / 64-B / 63.j | En catálogo Etapa 1 |
| CAMBIO-DIA | Seed + wizard + B-BATCH; UAT vivo pendiente |
| Agente: Mis solicitudes + acuse rechazo | Código local / hosting pendiente |
| Agente: Calendario institucional consulta | Código local / hosting pendiente |
| Jefe: solo bandeja | Política: sin GSO |
| LAO / LM / GSO jefe | **Off** por flag / menú |

**GDT piloto:** `gdt_01KX107ZZTPKF12A1ED2XVKNMM`  
**CAMBIO-DIA:** `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H` / `ver_01KX0Z07N70GZKBKF1P27C78SY`

---

## 6. Cómo encender novedades sin romper el cupo

1. Desarrollar en **dev** (cuando exista) o, si es solo UI/flag, en `feature/*`.  
2. Merge a `master` con la novedad **apagada** (`cfg_etapa1/runtime`).  
3. Deploy hosting/functions si hace falta.  
4. Encender flag / agregar `articulo_id` / `gdt_id` **solo** tras UAT del módulo.  
5. Rollback preferido = flag `false` (segundos), no borrar datos de usuarios.

---

## 7. Definición de “objetivo alcanzado” (corto)

Está **cumplido el objetivo del plan** cuando:

1. Soft Launch (o oleada) opera en prod con allowlist real y checklist/smoke verde.  
2. `portal-hospital-v2-dev` sirve para desarrollar el resto sin tocar datos piloto.  
3. Cada novedad llega a la web piloto **apagada** y se habilita por cfg/acta, no por “deploy de todo”.

Hoy: **(1) casi listo en código, pendiente UAT+hosting+altas · (2) proyecto creado, setup incompleto · (3) modelo de flags ya en uso.**

---

**Puntero único de estado · 2026-07-14** — retomar: commit/hosting → UAT Soft Launch · en paralelo setup-dev.
