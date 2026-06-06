---
name: Warning cobertura HLg dentro de HLc
status: borrador
prioridad: media
modulo: datos_laborales
epic_relacionada: "Integridad cadena HLc → HLd → HLg"
fuera_de_alcance: "Bloqueo de guardado; cierre automático de HLc; validación en grilla/plan"
depende_de:
  - MODULO_DATOS_LABORALES_V2.md
  - MATRIZ_WARN_ERROR_LABORAL_V2.md
fecha: 2026-06-06
origen: "Análisis sesión 2026-06-06 — regla de negocio RRHH"
---

# RFC — Warning informativo: días sin HLg dentro del periodo HLc

## 1. Propósito

**HLc** = periodo de cargo (ciclo laboral). **HLg** = asignación operativa (dónde y cómo cumple, con régimen y grupo).

Regla acordada con RRHH:

> Dentro de la vigencia de un **HLc**, no debería quedar **ningún día civil** sin al menos un **HLg** vigente enlazado a ese cargo. Si el periodo de cargo cambia de verdad, **cerrar HLc** y abrir un **nuevo ciclo** — no dejar “agujeros” temporales.

Hoy el backend valida:

- contención HLg ⊆ HLc (`VAL-HLG-003`, `VAL-HLG-004`);
- solape HLg en el **mismo** `grupo_de_trabajo_id` (`VAL-HLG-014`, error);
- warnings de solape/carga (`VAL-HLG-W002`, `VAL-HLG-W003`).

**No existe** aviso cuando la **unión temporal** de HLg del cargo deja días sin cobertura.

Este RFC define un **warning no bloqueante** al **alta o modificación de fechas** de HLg.

---

## 2. Alcance

| Incluido | Excluido |
|----------|----------|
| Warning en `guardarRegistroLaboralTemporal` (HLg alta/edición fechas) | Error bloqueante |
| Warning en UI Datos Laborales (banner/toast + timeline) | Validación retroactiva masiva en BD |
| Función pura testeable `detectarHuecosCoberturaHlc` | Cobertura por **grupo** (solo por **cargo/HLc**) |
| Entrada en `MATRIZ_WARN_ERROR_LABORAL_V2.md` | Automatizar cierre HLc / alta HLc |

---

## 3. Definiciones

| Término | Significado |
|---------|-------------|
| **Ventana HLc** | `[fecha_desde, fecha_hasta]` del `hlc_*` alcanzado vía `hlg.dato_laboral_id → hld.cargo_id → hlc.id`. Si `fecha_hasta` es null, acotar evaluación al rango relevante (véase §5.3). |
| **HLg del cargo** | Todos los `hlg_*` de la misma `persona_id` cuyo `dato_laboral_id` apunta a un `hld_*` con el mismo `cargo_id` (mismo HLc). |
| **Día cubierto** | Existe al menos un HLg del cargo con `activo !== false` y `fecha_inicio ≤ día ≤ fecha_fin` (fin abierto = ∞). |
| **Día hueco** | Día en la ventana HLc **sin** ningún HLg del cargo vigente ese día. |
| **Multicargo** | Varios HLg **distintos grupos** el mismo día **cuentan como cubierto** (basta uno). |

---

## 4. Código y severidad

| Campo | Valor |
|-------|--------|
| **Código** | `VAL-HLG-W004` |
| **Código UI** | `COBERTURA_HLC_INCOMPLETA` |
| **Severidad** | `warning` — **no bloquea** guardado |
| **Matriz** | Agregar a § “Warning” en [`MATRIZ_WARN_ERROR_LABORAL_V2.md`](./MATRIZ_WARN_ERROR_LABORAL_V2.md) al implementar |

### Mensaje humano (plantilla)

> Hay **{n}** día(s) del periodo de cargo **sin asignación a ningún grupo de trabajo** (ej. {desde}…{hasta}). Si el cambio es definitivo, **cerrá el ciclo HLc** y creá uno nuevo en lugar de dejar huecos.

### Payload sugerido

```json
{
  "code": "VAL-HLG-W004",
  "severity": "warning",
  "message": "…",
  "details": {
    "hlc_id": "hlc_…",
    "persona_id": "per_…",
    "total_dias_hueco": 15,
    "primer_hueco_ymd": "2026-06-16",
    "ultimo_hueco_ymd": "2026-06-30",
    "intervalos": [{ "desde": "2026-06-16", "hasta": "2026-06-30" }]
  }
}
```

Listar como máximo **3 intervalos** en UI; el resto en `details` para soporte.

---

## 5. Algoritmo (borrador)

### 5.1 Entrada

- `persona_id`
- `hlc_id` (desde HLd del HLg que se guarda)
- `hlgPropuesto` — documento HLg en curso (fechas ya normalizadas YMD)
- `hlgExistentes[]` — resto de HLg del cargo (Firestore), reemplazando el mismo `hlg_id` si es edición

### 5.2 Pasos

1. Obtener `fecha_desde` / `fecha_hasta` del HLc.
2. Construir unión de intervalos `[inicio, fin]` de todos los HLg del cargo (incluido propuesto), solo `activo !== false`.
3. Fusionar intervalos solapados/adjacentes (opcional: tratar fin e inicio consecutivos como contiguos si RRHH confirma — **v1: solo solape estricto, día hueco = gap ≥ 1 día**).
4. Comparar con ventana HLc → intervalos faltantes = huecos.
5. Si hay huecos → emitir `VAL-HLG-W004`.

### 5.3 Acotación de ventana (v1)

Para no escanear décadas de HLc abierto:

- Evaluar **solo** desde `max(hlc.fecha_desde, min(fecha_inicio de HLg del cargo))` hasta `min(hlc.fecha_hasta ?? hoy+365d, max(fecha_fin de HLg del cargo, fecha_fin propuesta))`.
- Si HLc abierto y todos los HLg abiertos: acotar a **`[hlc.fecha_desde, hoy + 18 meses]`** (misma filosofía ventana materialización).

---

## 6. Cuándo disparar

| Evento | Evaluar |
|--------|---------|
| Alta HLg | Sí |
| Edición `fecha_inicio` / `fecha_fin` HLg | Sí |
| Edición campos sin fechas (régimen, nivel, etc.) | No |
| Deshabilitar HLg | No (opcional v2: huecos **post** corte) |
| Deshabilitar ciclo HLc | Ya cubierto por warnings cascada existentes |

Evaluar **después** de `assertHlgDentroDeHlc` y **antes** del `commit` — el warning refleja el estado **post-guardado** (incluye HLg propuesto).

---

## 7. UI (Datos Laborales)

| Superficie | Comportamiento |
|------------|----------------|
| Formulario HLg | Tras guardado OK, si hay warnings → banner ámbar bajo botón Guardar |
| Timeline laboral | Chip/filtro `COBERTURA_HLC_INCOMPLETA` (alineado a `SOLAPE_CARGO_GRUPO`) |
| Texto acción | Enlace a ayuda: “Cerrar ciclo HLc” → flujo deshabilitación ya existente §7.2.1 `MODULO_DATOS_LABORALES_V2.md` |

**No** modal bloqueante. RRHH puede guardar igual.

---

## 8. Casos de prueba

| # | Escenario | Esperado |
|---|-----------|----------|
| 1 | HLc 2026-01-01→2026-12-31; HLg A 01-01→15-06; HLg A 01-07→31-12 (mismo grupo, sin solape — imposible por VAL-HLG-014) | N/A solape mismo grupo |
| 2 | Dos HLg **distintos grupos** Oficina + Sala solapados todo el mes | **Sin warning** (días cubiertos) |
| 3 | HLg único 2026-05-25→abierto; HLc 2022-06-01→abierto; otro HLg Oficina 2022-06-01→abierto | **Sin warning** en jun-2026 (Oficina cubre 01–24) |
| 4 | Un solo HLg Sala 2026-01-01→2026-06-15; HLc cierra 2026-12-31; sin otro HLg | **Warning** 2026-06-16→2026-12-31 |
| 5 | HLg propuesto acota hueco existente | Warning con **menor** `total_dias_hueco` o ausente |

---

## 9. Implementación (archivos previstos)

| Capa | Archivo |
|------|---------|
| Lógica pura | `functions/modules/laboral/coberturaHlcHuecos.js` (nuevo) |
| Integración | `functions/modules/catalogosLaborales.js` — push warning en respuesta |
| Tests | `functions/test/coberturaHlcHuecos.test.js` |
| UI validación | `web/src/pages/datos-laborales/formLogic.js` (opcional preview cliente) |
| UI display | `web/src/pages/datos-laborales/sections/` — banner warnings |

Estimación: **1 PR** backend + tests; **1 PR** UI (puede ser posterior).

---

## 10. Relación con otras reglas

| Regla | Relación |
|-------|----------|
| `VAL-HLG-003/004` | Necesaria pero no suficiente; W004 es complemento temporal |
| `VAL-HLG-014` | Error solape **mismo grupo**; W004 no lo sustituye |
| `VAL-HLC-W005` | “Cargo sin HLg aún” — distinto (cargo recién creado); W004 es hueco **entre** HLg |
| Deshabilitar HLc §7.2.1 | Remediación acordada: nuevo ciclo, no “parche” de fechas |

---

## 11. Estado y siguiente paso

| Item | Estado |
|------|--------|
| RFC borrador | ✅ 2026-06-06 |
| Aprobación RRHH | Pendiente |
| Implementación | **Después** de US-3 escenario A + US-14 (prioridad acordada) |
| Actualizar matriz | Al merge del PR backend |

---

*Referencias:* [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §7.2.1 · [`MATRIZ_WARN_ERROR_LABORAL_V2.md`](./MATRIZ_WARN_ERROR_LABORAL_V2.md) · [`HANDOFF_SESION_2026-06-06_CIERRE_FASE5_GRILLA_TITULAR.md`](./HANDOFF_SESION_2026-06-06_CIERRE_FASE5_GRILLA_TITULAR.md)
