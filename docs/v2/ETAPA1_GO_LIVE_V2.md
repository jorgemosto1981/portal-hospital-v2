# ETAPA1_GO_LIVE_V2 — Runbook técnico

**Audiencia:** desarrollo / ops.  
**No sustituye** UAT, Política deploy ni Acta RRHH — las indexa.  
**Prod piloto:** proyecto `portal-hospital-v2` · https://portal-hospital-v2.web.app

## 0. Estado 2026-07-21 — candados Etapa 1 retirados del runtime

El catálogo agente y las superficies UI **ya no** leen `articulo_ids_etapa1` / `lao_habilitada` / `licencias_medicas_habilitadas` / `jefe_gso_habilitado` como puertas de visibilidad.

**Gobierno vigente:**

1. `circuito_ingreso_ids` en la versión publicada del artículo (quién puede crear).
2. Elegibilidad laboral del titular.
3. Menús por rol (`menuTemporalmenteOculto` p. ej. Grilla/Turnos jefe).

El documento `cfg_etapa1/runtime` puede permanecer inerte por compatibilidad; no es SSoT operativa.

---

## 0b. Punteros

| Doc | Ruta (al persistir) |
|-----|---------------------|
| Checklist UAT | `docs/v2/CHECKLIST_UAT_ETAPA1_V2.md` |
| Política deploy | `docs/v2/ETAPA1_POLITICA_DEPLOY_V2.md` |
| Acta RRHH | `docs/v2/ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md` |
| Arts. básicos (IDs) | `docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md` |
| 63.j applied IDs | `docs/v2/seeds/oleada_63_p2/applied-ids.json` |
| Constantes front 64 | `web/src/constants/solicitudesArticuloV2.js` |

## 1. Decisión de aislamiento (población)

| Cohort | Tratamiento |
|--------|-------------|
| **Agente** | Arts con `CFG_USUARIO` en `circuito_ingreso_ids` + elegibilidad |
| **RRHH** | Arts con `CFG_RRHH` (arenero: LM, LAO, 77-0, etc.) vía Nueva solicitud |
| **Jefe** | Bandeja autorización; Grilla/Turnos temporalmente fuera del menú |
| **GDT** | Sin allowlist; basta HLc vigente en GDT activo (si aplica al alta laboral) |

## 2. Runtime cfg — histórico Soft Launch

> **Deprecated.** Ver §0. El texto siguiente queda como archivo histórico del soft launch.

Documento legacy: `cfg_etapa1/runtime`

```text
cfg_etapa1 / runtime
  etapa1_habilitada: true          // legacy
  gdt_ids_etapa1: []               // DEPRECATED
  articulo_ids_etapa1: [...]       // DEPRECATED — no filtra listado agente
  persona_ids_ops_bypass: ["per_…"]
  jefe_gso_habilitado: false       // DEPRECATED — menú jefe usa menuTemporalmenteOculto
```

**Regla de pertenencia vigente (server listado agente):**

1. Versión publicada Patrón B/C.  
2. `hlc.rol_id ∈ circuito_ingreso_ids` (vía elegibilidad).  
3. Filtros laborales (escalafón, etc.).

Claims Auth opcionales solo como cache/UX; **la autorización real es server + cfg del artículo**.

## 3. Filtro de catálogo (artículos habilitados)

### 3.1 IDs conocidos (prod piloto actual)

| Código | `articulo_id` | `version_id` (ref) |
|--------|---------------|-------------------|
| **64-A** | `art_01KRNK10V10CH7W5M2W6V558GS` | `ver_01KRNKNBXNBFC9HZN7CZJGPRDH` |
| **64-B** | `art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ` | `ver_01KRYEX13QN7VBPMFQFES1QHB4` |
| **63-J** | `art_01KVWVW9Z50VR6T1BC6J0R3YQ8` | `ver_01KVWVW9Z51122AXS78E82NHFP` |
| **CAMBIO-DIA** | `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H` | `ver_01KX0Z07N70GZKBKF1P27C78SY` — seed Soft Launch 2026-07-08 |

### 3.2 Excluidos explícitos (aunque existan en Firestore)

- LAO `art_01KRNYDN5WR7RER7MWXRZ817E7` (y todas sus versiones).  
- 68-B, oleada 63 que no sea 63-J (63-C/D/I/K), arts. médicos P4, etc.

**Enforcement:** listado/preview/create validan `articulo_id ∈ articulo_ids_etapa1` **en Functions**. La UI solo refleja el mismo set (no es la barrera).

## 4. Superficies a bloquear (feature off)

| Superficie | Quién | Cómo (instrucción dev) |
|------------|-------|------------------------|
| Menús / rutas **LAO** | Agente, Jefe | Ocultar entradas menú; guard de ruta; callable LAO no usados por cohorte (no hace falta borrar código) |
| **Licencias médicas** / bandeja auditor / junta | Agente, Jefe | Idem; no publicar en catálogo Etapa 1 |
| **GSO / gestión turno / Flujo A·B·C** | **Jefe** | Capabilities off (`grilla.asistencia.*`); ocultar rutas grilla; deep-link → 403/redirect. `jefe_gso_habilitado: false` |
| GSO | **RRHH** | **Permitido** (remediación + operación temporal) |
| Configurador artículos avanzado | no-master | Sin cambio de rol; fuera del piloto usuario final |

## 5. Checklist ops Día D (dev + RRHH)

1. `etapa1_habilitada: true`. GDT activos con HLc vigente operan sin lista manual.  
2. Soft Launch: 5–10 personas nuevas con cuenta, HLg, jefe, check-in 64.  
3. `articulo_ids_etapa1` incluye 64-A/B, 63-J, CAMBIO-DIA (si ya existe).  
4. Smoke gate según Política deploy / UAT.  
5. Canal soporte del Acta activo.  
6. Confirmar que personas **sin** GDT activo / sin HLc no pasan el filtro Etapa 1.

## 6. Después del Día D

- Apertura de población = GDT `activo: true` + HLc (sin tocar `gdt_ids_etapa1`).  
- Desarrollo no-Etapa1 → `portal-hospital-v2-dev` (Política deploy).  
- Abrir GSO a jefes = **nueva acta**, no un flag casual en prod.

---


---

**Estado:** aceptado · 2026-07-08
