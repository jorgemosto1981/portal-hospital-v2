# Spike de Contrato — Fase 2 · Módulo B (Pases de GDT)

**Estado:** borrador de spike · alineado a [`RFC_PLANTEL_Y_PASES_GDT_V2.md`](./RFC_PLANTEL_Y_PASES_GDT_V2.md) §4  
**Fecha:** 2026-07-24  
**Entorno:** `develop` + Firebase `portal-hospital-v2-dev`  
**Prerrequisito:** Módulo A ✅ (`obtenerPlantelPorGdt` · `listarArbolGdtPlantel` · UI plantel)

---

## 0. Objetivo del spike

Dejar por escrito, **antes de mutar HLg**, el contrato de:

1. Shape Firestore `sol_pases_gdt`
2. Semántica de fechas (cierre origen / apertura destino)
3. Transacción atómica y validaciones de jurisdicción
4. Contratos de callables
5. Toma de conocimiento (TC) reutilizando patrón Etapa 1
6. UX de formularios (texto explícito de ayuda en fecha)

**No incluye** implementación de código en este documento.

---

## 1. Semántica de fecha (decisión de spike)

| Concepto | Campo canónico | Significado operativo |
|----------|----------------|------------------------|
| Último día en el GDT origen | `fecha_efectiva` (`YYYY-MM-DD`) | **Último día de trabajo en este grupo** |
| Cierre HLg origen | `historial_laboral_grupos.fecha_fin` | Igual a `fecha_efectiva` (día inclusive en origen) |
| Alta HLg destino | `historial_laboral_grupos.fecha_inicio` | **`fecha_efectiva + 1 día`** (calendario institucional AR) |

> **UX obligatoria:** en `PaseInternoModal` / `SolicitudPaseExternoModal` (nombres tentativos), el control de fecha muestra label/ayuda:
>
> **\* Indicar último día de trabajo en este grupo**
>
> Evita ambigüedad sobre si la baja opera al iniciar o al finalizar esa fecha.

Alias interno de diseño (solo docs/UI): `fecha_fin_origen` ≡ `fecha_efectiva`. En Firestore y callables se persiste **`fecha_efectiva`**.

---

## 2. Shape `sol_pases_gdt`

**Id documento:** `spg_<ULID>`  
**Colección:** `sol_pases_gdt`

### 2.1 Campos (canónico = RFC §4.1 + refinamientos)

```json
{
  "agente_persona_id": "per_…",
  "hlg_origen_id": "hlg_…",
  "gdt_origen_id": "gdt_…",
  "gdt_destino_id": "gdt_… | null",
  "solicitante_persona_id": "per_…",
  "tipo_pase": "INTERNO | EXTERNO",
  "estado": "APROBADO_INTERNO | PENDIENTE_RRHH | APROBADO | RECHAZADO",
  "motivo": "string",
  "destino_sugerido_texto": "string | null",
  "fecha_efectiva": "YYYY-MM-DD",
  "hlg_destino_id": "hlg_… | null",
  "overrides_hlg": {
    "nivel_jerarquico": null,
    "regimen_horario_id": null,
    "regimen_fecha_ancla": null
  },
  "requiere_conocimiento_rrhh": true,
  "rrhh_toma_conocimiento_en": null,
  "rrhh_toma_conocimiento_por": null,
  "jefes_pendientes_conocimiento_ids": ["per_…"],
  "jefes_acuses": {
    "per_…": { "en": "Timestamp", "por": "per_…" }
  },
  "creado_en": "Timestamp",
  "actualizado_en": "Timestamp",
  "resuelto_en": "Timestamp | null",
  "resuelto_por": "per_… | null",
  "motivo_rechazo": "string | null"
}
```

### 2.2 Obligatoriedad por tipo

| Campo | INTERNO (`ejecutarPaseInternoGdt`) | EXTERNO solicitud | EXTERNO al aprobar RRHH |
|-------|------------------------------------|-------------------|-------------------------|
| `agente_persona_id` | ✅ | ✅ | ✅ (ya set) |
| `hlg_origen_id` | ✅ | ✅ | ✅ |
| `gdt_origen_id` | ✅ | ✅ | ✅ |
| `gdt_destino_id` | ✅ (jurisdicción jefe) | ❌ `null` | ✅ (árbol completo RRHH) |
| `fecha_efectiva` | ✅ | ✅ | ✅ (puede confirmar/ajustar RRHH — **decisión abierta §7**) |
| `motivo` | ✅ | ✅ | — |
| `destino_sugerido_texto` | — | ✅ (texto libre) | — |
| `overrides_hlg` | opcional (default herencia) | — | opcional RRHH |
| `estado` al persistir | `APROBADO_INTERNO` | `PENDIENTE_RRHH` | `APROBADO` / `RECHAZADO` |
| Mutación HLg | **Sí, misma tx** | **No** | **Sí en aprobar**; no en rechazar |

---

## 3. Transacción atómica (mutación HLg)

### 3.1 Regla de oro (sin cambio)

> Un cambio de GDT **no** actualiza `grupo_de_trabajo_id` en un HLg vigente.  
> Se **cierra** el HLg origen y se **abre** uno nuevo.

### 3.2 Pasos en una sola transacción / batch atómico

Orden sugerido (todo o nada):

1. **Releer** HLg origen: existe, `persona_id` = agente, `grupo_de_trabajo_id` = origen, vigente a `fecha_efectiva` (sin `fecha_fin` o `fecha_fin` > efectiva según helpers vigentes).
2. **Validar** no solapamiento: el nuevo HLg destino no deja dos HLg “principales” vigentes el mismo día para el mismo agente en dos GDT (MVP: un solo HLg de grupo activo por persona en la fecha de apertura — alinear a reglas actuales de vigencia).
3. **Update** HLg origen: `fecha_fin = fecha_efectiva`.
4. **Create** HLg destino (`hlg_<ULID>`):
   - `grupo_de_trabajo_id` = destino  
   - `fecha_inicio` = `fecha_efectiva + 1`  
   - `fecha_fin` = `null`  
   - hereda `dato_laboral_id`, vínculo HLc, `nivel_jerarquico`, `regimen_horario_id`, `regimen_fecha_ancla` (salvo overrides RRHH)
5. **Create/update** `sol_pases_gdt` con `hlg_destino_id`, estado final de ejecución, TC pendientes calculados.
6. **Fuera de tx (post-commit opcional):** invalidación de cachés / outbox grilla si el producto ya lo exige para cambios HLg (seguir patrón rematerialización existente; no inventar pipeline nuevo en MVP).

### 3.3 Validaciones de jurisdicción (reuso Fase 1b)

| Actor | Regla |
|-------|--------|
| Jefe · pase interno | `gdt_destino_id` ∈ subárbol de sus raíces HLg (`gdtEnSubarbolDeRaices` / misma lógica que `listarArbolGdtPlantel` + `assertLecturaPlantelJurisdiccion`) |
| Jefe · agente | Agente con HLg vigente en `gdt_origen` bajo jurisdicción del jefe (subordinación; detalle algoritmo en implementación, alineado a nivel jerárquico / burbujeo Etapa 1) |
| RRHH · aprobar externo | Cualquier `gdt_*` activo; overrides opcionales |

---

## 4. Contratos de callables

### 4.1 `ejecutarPaseInternoGdt`

**Input:**

```json
{
  "agente_persona_id": "per_…",
  "hlg_origen_id": "hlg_…",
  "gdt_destino_id": "gdt_…",
  "fecha_efectiva": "YYYY-MM-DD",
  "motivo": "…",
  "overrides_hlg": { "nivel_jerarquico": null, "regimen_horario_id": null, "regimen_fecha_ancla": null }
}
```

**Auth:** sesión + jefe (o RRHH operando shell jefe) · destino en jurisdicción · subordinación.  
**Efecto:** tx HLg + `sol_pases_gdt` `APROBADO_INTERNO` · TC pendientes (no bloquean).  
**Output:** `{ ok, pase_id, hlg_destino_id, fecha_inicio_destino }`.

### 4.2 `solicitarPaseExternoGdt`

**Input:**

```json
{
  "agente_persona_id": "per_…",
  "hlg_origen_id": "hlg_…",
  "fecha_efectiva": "YYYY-MM-DD",
  "motivo": "…",
  "destino_sugerido_texto": "…"
}
```

**Efecto:** solo crea `sol_pases_gdt` `PENDIENTE_RRHH`, `gdt_destino_id: null`. **Sin** mutar HLg.

### 4.3 `aprobarPaseGdt` / `rechazarPaseGdt`

**Aprobar input:** `{ pase_id, gdt_destino_id, fecha_efectiva?, overrides_hlg?, motivo_rrhh? }` — auth RRHH · tx HLg · `APROBADO`.  
**Rechazar input:** `{ pase_id, motivo_rechazo }` — auth RRHH · `RECHAZADO` · **sin** tocar HLg.

### 4.4 `tomarConocimientoPaseGdtRrhh` / `tomarConocimientoPaseGdtJefe`

Estampan acuse; **no** revierten ni reejecutan el pase.  
Patrón: bandejas informativas Etapa 1 (TC post-hecho).

---

## 5. Toma de conocimiento (TC)

| Actor | Vista | Acción | Campos |
|-------|--------|--------|--------|
| RRHH | Pases informados / pendientes de acuse | Tomar conocimiento | `rrhh_toma_conocimiento_en` / `_por` |
| Jefe superior | Bandeja informativa (sin Aprobar/Rechazar) | Tomar conocimiento | saca id de `jefes_pendientes_conocimiento_ids` → entra en `jefes_acuses` |

**Cálculo de jefes pendientes (borrador):** subir `parent_group_id` desde origen y/o destino (máx. profundidad como en autorización jerárquica) y tomar titulares con nivel superior vigentes; deduplicar. Detalle fino = misma familia que `solicitudAutorizacionJerarquicaCore` (sin mezclar estados de ticketera).

**Principio:** el pase interno **ya está ejecutado**; los acuses son trazabilidad, no gate.

---

## 6. Firestore rules (borrador)

- Cliente **no** escribe `sol_pases_gdt` ni HLg de pases.
- Lectura: RRHH amplio; jefe solo docs donde es `solicitante`, figura en pendientes/acuses, o agente es de su jurisdicción (si la rule se vuelve cara → lecturas vía callable listado).
- Preferencia MVP: **listados por callable** + rules deny write; read acotado o deny+Admin SDK en callables (como otras `sol_*` de Etapa 1).

Índices tentativos:

- `(estado, creado_en desc)` — bandeja RRHH `PENDIENTE_RRHH`
- `(requiere_conocimiento_rrhh, rrhh_toma_conocimiento_en)` — acuses RRHH
- `(jefes_pendientes_conocimiento_ids array-contains, actualizado_en)` — bandeja jefe TC

---

## 7. Decisiones abiertas (cerrar antes de codear)

| # | Pregunta | Opciones | Preferencia spike | Estado |
|---|----------|----------|-------------------|--------|
| D1 | ¿RRHH puede cambiar `fecha_efectiva` al aprobar externo? | Sí / Solo confirmar | **Sí, con default = la del jefe** | ✅ Aceptado 2026-07-24 |
| D2 | ¿Pase interno permite overrides de nivel/régimen? | Sí jefe / Solo RRHH / No en MVP | **No en MVP interno** (herencia pura) | ✅ Aceptado 2026-07-24 |
| D3 | ¿Un agente con 2 HLg vigentes en GDT distintos? | Bloquear / Permitir | **Bloquear solape** el día de apertura destino | ✅ Aceptado 2026-07-24 |
| D4 | Prefijo id | `spg_` vs `sol_pase_` | **`spg_`** (RFC) | ✅ Aceptado 2026-07-24 |
| D5 | Rematerialización grilla post-pase | Sync in-tx / outbox async / diferir | **Outbox/async si ya existe hook HLg; si no, diferir a post-MVP** | ✅ Aceptado 2026-07-24 |

---

## 8. Criterios de aceptación del spike (docs)

- [x] Shape canónico documentado y alineado al RFC
- [x] Semántica de `fecha_efectiva` = último día en el grupo + `fecha_inicio` destino = +1
- [x] Texto UX de ayuda explícito definido
- [x] Flujos interno / externo / TC / callables listados
- [x] Decisiones D1–D5 confirmadas por producto/RRHH (o default spike aceptado) — **aceptadas 2026-07-24**
- [ ] Rules/índices revisados al implementar
- [x] `ejecutarPaseInternoGdt` core + callable (átomo 1 escritura) — pendiente deploy −dev + UI modal

---

## 9. Orden de implementación sugerido (post-spike)

1. Constants + core tx `ejecutarPaseInternoGdt` + tests unitarios de fechas/jurisdicción  
2. UI modal pase interno desde Plantel (fila agente)  
3. `solicitarPaseExternoGdt` + bandeja RRHH mínima  
4. `aprobar` / `rechazar` + overrides  
5. Callables TC + filtros bandeja  

---

## 10. Frase de continuación

> Spike Fase 2 listo en `docs/v2/SPIKE_PASES_GDT_FASE2_V2.md`. Confirmar D1–D5 (o aceptar defaults) y arrancar implementación por **`ejecutarPaseInternoGdt`** + modal con ayuda *«Indicar último día de trabajo en este grupo»* sobre `portal-hospital-v2-dev`.
