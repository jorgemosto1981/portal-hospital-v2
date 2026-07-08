# ETAPA1_GIT_Y_ENTORNOS_V2 — Git, entornos y feature flags

**Estado:** aceptada · 2026-07-08  
**Objetivo:** foto del código actual, desarrollo cómodo en paralelo, y promoción progresiva a "real" (LAO, artículos, turnos, grillas) sin romper Etapa 1.

**Convención de ramas en este repo:** producción = `master` (equivale a `main` del plan). Arenero = `develop`.

## 1. Foto y protección de producción

- **Tag inmutable:** `v0.9.0-base` sobre el commit previo a candados Etapa 1.
- **Rama prod:** `master` — solo código que pasó Checklist UAT / smoke Etapa 1 (o hotfix).
- **Hotfix Etapa 1:** branch corto desde `master` → UAT mínimo → merge a `master` → deploy prod.
- **Nadie** desarrolla features nuevas directo en `master`.

## 2. Arenero de desarrollo

- **Rama:** `develop` (+ `feature/*` desde `develop`).
- **Firebase:** `portal-hospital-v2-dev` — seeds agresivos, resets, experimentos OK.
- Local `dev:web` / Functions apuntan a **dev**, nunca a prod piloto por defecto.

## 3. Promoción progresiva (feature flags)

Flujo típico (ej. LAO, GSO jefes, nuevo art.):

1. Terminar en `develop` + Firebase-dev.
2. Merge a `master` (código apagado): flags en prod `lao_habilitada: false` / art. no en `articulo_ids_etapa1` / `jefe_gso_habilitado: false`.
3. Encender por cfg Firestore (+ Acta/UAT del módulo si aplica) — sin redeploy riesgoso.
4. Rollback = flag `false` en segundos (preferido a revert de código / borrar datos).

Documento runtime: colección `cfg_etapa1` / doc `runtime` (ver Go-Live y seed).

Flags mínimos:

- `etapa1_habilitada`, `gdt_ids_etapa1`, `articulo_ids_etapa1`, `persona_ids_ops_bypass`
- `jefe_gso_habilitado` (false en Etapa 1)
- Futuros: `lao_habilitada`, `licencias_medicas_habilitadas`, etc.

## 4. Orden ejecutivo

| Paso | Qué | Quién |
|------|-----|-------|
| 0 | Persistir MD en `docs/v2/` + tag `v0.9.0-base` + rama `develop` | Ops/Dev |
| 1 | Crear `portal-hospital-v2-dev` | Ops/Dev |
| 2 | Documento cfg / feature flags en Firestore | Dev |
| 3 | Candados (allowlist, catálogo, hide superficies) | Dev |
| 4 | CAMBIO-DIA + B-BATCH | Dev |
| 5 | GDT nuevos + Soft Launch 5–10 | RRHH (+Dev soporte) |

## 5. Documentos persistidos

- [`CHECKLIST_UAT_ETAPA1_V2.md`](./CHECKLIST_UAT_ETAPA1_V2.md)
- [`ETAPA1_POLITICA_DEPLOY_V2.md`](./ETAPA1_POLITICA_DEPLOY_V2.md)
- [`ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md`](./ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md)
- [`ETAPA1_GO_LIVE_V2.md`](./ETAPA1_GO_LIVE_V2.md)
- [`ETAPA1_GIT_Y_ENTORNOS_V2.md`](./ETAPA1_GIT_Y_ENTORNOS_V2.md) (este)
