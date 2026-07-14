# ETAPA1_GO_LIVE_V2 — Runbook técnico

**Audiencia:** desarrollo / ops.  
**No sustituye** UAT, Política deploy ni Acta RRHH — las indexa.  
**Prod piloto:** proyecto `portal-hospital-v2` · https://portal-hospital-v2.web.app

## 0. Punteros

| Doc | Ruta (al persistir) |
|-----|---------------------|
| Checklist UAT | `docs/v2/CHECKLIST_UAT_ETAPA1_V2.md` |
| Política deploy | `docs/v2/ETAPA1_POLITICA_DEPLOY_V2.md` |
| Acta RRHH | `docs/v2/ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md` |
| Arts. básicos (IDs) | `docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md` |
| 63.j applied IDs | `docs/v2/seeds/oleada_63_p2/applied-ids.json` |
| Constantes front 64 | `web/src/constants/solicitudesArticuloV2.js` |

## 1. Decisión de aislamiento (población)

| Cohort | Tratamiento Día D |
|--------|-------------------|
| **GDT nuevos + personas nuevas** | Allowlist Etapa 1 (conejillos) |
| **GDT/personas ya existentes** | Siguen en Firestore/Auth; **fuera** de `gdt_ids_etapa1` → sin circuito Etapa 1 (menú vacío / rechazo callable) |
| **Cuentas RRHH / técnicas** | Bypass allowlist vía flag `roles` o lista `persona_ids_ops_etapa1` |

## 2. Allowlist — dónde y cómo

**Elegido:** documento de configuración en Firestore (editable sin redeploy de lógica dura), leído por Functions en toda alta/listado/preview.

Propuesta de forma (nombre final al implementar):

```text
cfg_parametros_sistema /  (o doc dedicado cfg_etapa1_v2)
  etapa1_habilitada: true
  gdt_ids_etapa1: ["gdt_…", "gdt_…"]          // GDT NUEVOS únicamente
  persona_ids_ops_bypass: ["per_…"]            // RRHH/tech
  articulo_ids_etapa1: ["art_…", ...]          // ver §3
  jefe_gso_habilitado: false                   // hard off Etapa 1
```

**Regla de pertenencia (server):**

1. Si `persona_id ∈ persona_ids_ops_bypass` → OK ops.  
2. Else: HLg/HLc **vigente** de la persona tiene `grupo_trabajo_id ∈ gdt_ids_etapa1`.  
3. Else → denegar operación Etapa 1 (login puede existir; ticketera/bandeja circuito vacía o error claro).

**No** usar array hardcodeado de 80 `persona_id` en el repo como fuente de verdad (Anexo A del acta es nómina humana; la verdad runtime es GDT + cargos).

Claims Auth opcionales (`piloto_etapa1`) solo como cache/UX; **la autorización real es server + cfg**.

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

1. `etapa1_habilitada: true` + `gdt_ids_etapa1` cargados con GDT **nuevos**.  
2. Soft Launch: 5–10 personas nuevas con cuenta, HLg, jefe, check-in 64.  
3. `articulo_ids_etapa1` incluye 64-A/B, 63-J, CAMBIO-DIA (si ya existe).  
4. Smoke gate según Política deploy / UAT.  
5. Canal soporte del Acta activo.  
6. Confirmar que personas de GDT **viejos** no pasan filtro Etapa 1.

## 6. Después del Día D

- Ampliación allowlist = agregar personas a GDT nuevos (o GDT nuevos a `gdt_ids_etapa1`), no “abrir todo el hospital”.  
- Desarrollo no-Etapa1 → `portal-hospital-v2-dev` (Política deploy).  
- Abrir GSO a jefes = **nueva acta**, no un flag casual en prod.

---


---

**Estado:** aceptado · 2026-07-08
