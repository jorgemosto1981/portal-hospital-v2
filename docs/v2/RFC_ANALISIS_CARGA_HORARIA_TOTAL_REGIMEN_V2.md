# RFC — Análisis de carga horaria total configurable por régimen

> **Estado:** **Aprobado** (RRHH / producto — 2026-06-17, decisión Armando)  
> **Fecha:** 2026-06-17  
> **Relación:** [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) §3 (C6/C7) · [`RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md`](./RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md) · [`RFC_CUMPLIMIENTO_TURNO_COMPUESTO_FILAS_CELDA.md`](./RFC_CUMPLIMIENTO_TURNO_COMPUESTO_FILAS_CELDA.md) · [`PLAN_REGIMEN_HORARIO_V2.md`](./PLAN_REGIMEN_HORARIO_V2.md)  
> **Motor:** [`shared/utils/calcularDeltasCumplimiento.js`](../../shared/utils/calcularDeltasCumplimiento.js) · [`shared/utils/capaTeoricaLimitesCumplimiento.js`](../../shared/utils/capaTeoricaLimitesCumplimiento.js)

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Qué se pide? | En `cfg_regimen_horario`, un **tilde** para habilitar/deshabilitar el **análisis de carga horaria total** del día, y un campo de **tolerancia máxima en minutos**. |
| ¿Es nuevo el concepto? | **No.** El motor ya calcula `debito_tiempo` (teórico vs real agregado). Falta **exponerlo en UI RRHH** y **poder apagarlo** por régimen. |
| ¿Es independiente de fichada vs teórica? | **Sí, en producto.** Disciplina horaria (▲/▼ por ingreso/egreso nominal) usa tolerancias **por turno**. Carga total usa parámetros **a nivel régimen**. |
| ¿Afecta semáforo de celda? | **Sí, cuando está habilitado** y hay déficit &gt; tolerancia → alerta `DEFICIT_HORARIO_GRAVE` → semáforo **AMARILLO** (jefe). **No** pinta badge `-Nm` en filas M/T/N compuestas. |
| Esfuerzo estimado | **1,5–2 días** (schema + form RRHH + motor + tests + backfill piloto). |

---

## 1. Problema y motivación

### 1.1 Situación actual

- El régimen ya admite `tolerancia_debitohorario_minutos` en schema Zod y Callable, con default **30 min**, pero **no aparece** en el formulario RRHH (`RegimenHorarioForm.jsx`).
- El análisis de débito **siempre corre** si hay carga teórica &gt; 0; no hay forma de desactivarlo por régimen.
- En la práctica se mezclaron dos dimensiones con el mismo parámetro:
  - **Disciplina horaria** (¿entró/salió dentro de cortesía respecto al nominal del tramo?).
  - **Carga horaria total** (¿la suma de minutos fichados cubre la jornada teórica?).
- El modal de auditoría ya muestra: *«Carga horaria: tolerancia de débito del régimen 30 min.»* — pero RRHH no puede configurarlo sin tocar Firestore.

### 1.2 Objetivo

Permitir que RRHH defina, **por régimen**:

1. Si se evalúa o no la **carga horaria total del día**.
2. Cuántos minutos de déficit se toleran antes de declarar incumplimiento contractual.

Sin recalcular nada en el front: el motor materializa el resultado en `analitica_cumplimiento.debito_tiempo` y la UI **solo lee**.

---

## 2. Dos dimensiones (contrato de producto)

| Dimensión | Parámetros | Pregunta | Salida materializada | UI grilla compuesta |
|-----------|------------|----------|----------------------|---------------------|
| **A — Disciplina horaria** | `tolerancia_ingreso_min`, `tolerancia_egreso_min` **por turno** (M/T/N) | ¿Cada marca respeta el nominal del tramo? | `disciplina_horaria`, `segmentos_cumplimiento[].incumplimiento_celda_*` | Badges `▲ Nm` / `▼ Nm` por fila; color fila según `estado_tramo` |
| **B — Carga horaria total** | `analisis_carga_horaria_total_habilitado`, `tolerancia_debitohorario_minutos` **por régimen** | ¿Minutos trabajados totales ≥ minutos teóricos de la jornada (menos tolerancia)? | `debito_tiempo.*`, alerta `DEFICIT_HORARIO_GRAVE` | **No** badge `-Nm` en filas M/T/N; sí tarjeta/alerta en **modal** y semáforo jefe |

**Regla de separación (refinamiento obligatorio en implementación):**

- `tolerancia_debitohorario_minutos` **solo** alimenta la dimensión **B** (déficit agregado).
- La cortesía de **estado por tramo** (`presente` vs `parcial` sin badge) debe basarse en `tolerancia_ingreso_min` / `tolerancia_egreso_min` del turno correspondiente, **no** en la tolerancia de débito del régimen.

---

## 3. Schema `cfg_regimen_horario`

### 3.1 Campos nuevos / expuestos

| Campo | Tipo | Default | Ubicación UI |
|-------|------|---------|--------------|
| `analisis_carga_horaria_total_habilitado` | `boolean` | `true` | Sección **parámetros comunes** del régimen (no en cada turno M/T/N) |
| `tolerancia_debitohorario_minutos` | `int` 0–180 | `30` | Mismo bloque; **habilitado solo si** el tilde está en sí |

> **Retrocompatibilidad:** regímenes sin el campo booleano se interpretan como `analisis_carga_horaria_total_habilitado === true` y `tolerancia_debitohorario_minutos === 30` (comportamiento actual).

### 3.2 Validación Callable (`catalogosRegimenHorario.js`)

```javascript
analisis_carga_horaria_total_habilitado: d.analisis_carga_horaria_total_habilitado !== false,
tolerancia_debitohorario_minutos:
  typeof d.tolerancia_debitohorario_minutos === "number"
    ? Math.min(180, Math.max(0, Math.trunc(d.tolerancia_debitohorario_minutos)))
    : 30,
```

### 3.3 Materialización en capa teórica

`enriquecerLimitesCumplimientoEnCapa(capa, regimen)` propaga al slice del día:

```typescript
{
  analisis_carga_horaria_total_habilitado: boolean;
  tolerancia_debitohorario_minutos: number; // solo relevante si habilitado
  carga_horaria_diaria_minutos: number;     // ya existe
}
```

El fingerprint de validación fichada debe incluir estos flags para forzar re-evaluación al editar el régimen.

---

## 4. Motor — `calcularDeltasCumplimiento`

### 4.1 Cálculo (sin cambio de fórmula)

```
carga_teorica_minutos  ← capa (suma segmentos si compuesto M+T+N)
carga_real_minutos     ← Σ duración de tramos en fichadas_reales
deficit_minutos        ← max(0, carga_teorica_minutos - carga_real_minutos)
```

### 4.2 Reglas de incumplimiento

| `analisis_carga_horaria_total_habilitado` | Comportamiento |
|-------------------------------------------|----------------|
| `false` | `debito_tiempo.incumplimiento_carga_horaria = false` siempre; **no** emitir `DEFICIT_HORARIO_GRAVE`; `debito_tiempo.calculo_suspendido = true`, `motivo_calculo_suspendido = "ANALISIS_CARGA_HORARIA_DESHABILITADO"`. Se pueden seguir informando `carga_teorica_minutos` y `carga_real_minutos` a efectos informativos en modal. |
| `true` | Lógica actual: `incumplimiento_carga_horaria = deficit_minutos > tolerancia_debitohorario_minutos` |

### 4.3 Casos especiales (sin cambio)

| Caso | Débito |
|------|--------|
| `FICHADA_FUERA_TURNO_TEORICO` | Cálculo suspendido (ya implementado) |
| Día sin carga teórica (franco / NL) | Sin objeto débito accionable |
| Licencia cubre día | Sin `validacion_fichada_dia` (RFC Fase F §9) |

### 4.4 Ejemplos QA (Sala Internación 1, tol. 30 min, análisis **ON**)

| Día | Teoría | Real (suma tramos) | Déficit | Resultado B |
|-----|--------|-------------------|---------|-------------|
| 14 | 24 h M+T+N | ~23 h 05 m | &lt; 30 | Sin `DEFICIT_HORARIO_GRAVE` |
| 15 | 24 h | egreso 04:00 vs cierre 06:00 | ~120 m | `DEFICIT_HORARIO_GRAVE` (badge modal, semáforo AMARILLO) |
| 13 N | 8 h segmento | egreso 05:35 vs 06:00 | 25 m en tramo | Dimensión **A** puede marcar parcial; dimensión **B** jornada completa decide si hay déficit global |

---

## 5. Impacto en UI

### 5.1 Formulario RRHH (`RegimenHorarioForm.jsx`)

Bloque nuevo bajo campos comunes (junto a hs semanales / extras):

```
☑ Análisis de carga horaria total
   Tolerancia máxima de déficit (min): [ 30 ]
   Ayuda: compara minutos teóricos de la jornada vs suma de fichadas.
          Independiente de tolerancias de ingreso/egreso por turno.
```

- Si el tilde está **off**, el input de tolerancia queda deshabilitado (valor se conserva al guardar).
- Mobile-first: checkbox + input numérico `inputMode="numeric"`, altura táctil ≥ 44 px.

### 5.2 Grilla jefe — semáforo celda

| Análisis | Déficit | Semáforo |
|----------|---------|----------|
| OFF | cualquiera | **No** considera déficit; solo disciplina / fuera de turno / impar / ausencia |
| ON | ≤ tolerancia | VERDE (si no hay otras alertas) |
| ON | &gt; tolerancia | **AMARILLO** vía `DEFICIT_HORARIO_GRAVE` en `alertas_activas` |

### 5.3 Grilla — filas M/T/N (`presentacion_compuesto`)

- **Sin cambio:** el déficit **agregado** de jornada **no** genera badge `-Nm` en filas de tramo (RFC cumplimiento compuesto).
- Los badges por tramo siguen siendo solo dimensión **A** (`▲` / `▼` / `AUSENTE`).

### 5.4 Modal día — auditoría RRHH / jefe

| Análisis | Contenido |
|----------|-----------|
| ON | Tarjeta / línea débito: *«Déficit de carga horaria: N min (tolerancia régimen: M min).»* + alerta semántica si aplica |
| OFF | Ocultar tarjeta de incumplimiento por déficit; opcional línea informativa: *«Análisis de carga horaria total deshabilitado en el régimen.»* |
| ON (siempre) | Mantener líneas de cortesía ingreso/egreso por turno (dimensión A) |

---

## 6. Fases de implementación

| Fase | Entregable | Depende de |
|------|------------|------------|
| **F1 — Schema + Callable** | Zod, `catalogosRegimenHorario.js`, propagación en `capaTeoricaLimitesCumplimiento.js` | Aprobación RFC |
| **F2 — Motor** | Guard en `calcularDeltasCumplimiento.js`; separar tolerancia débito de `estado_tramo` en `resolverPresentacionCompuestoCelda.js`; tests | F1 |
| **F3 — UI RRHH** | Campos en `RegimenHorarioForm.jsx` + detalle en `RegimenHorarioDetalle.jsx` | F1 |
| **F4 — UI grilla** | `grillaAnaliticaCumplimientoUi.js`, `resumenCumplimientoFichadaJefe.js` respetan flag materializado | F2 |
| **F5 — Backfill piloto** | `sync-shared-to-functions` + backfill jun-2026 Sala Internación 1 | F2 |

**Orden recomendado:** F1 → F2 + F3 en paralelo → F4 → F5 → QA manual con matriz C6/C7.

---

## 7. Criterios de aceptación

1. RRHH puede crear/editar un régimen con análisis **OFF**; días con déficit real no generan `DEFICIT_HORARIO_GRAVE` ni AMARILLO por déficit.
2. RRHH puede setear tolerancia **45 min**; día con déficit 40 min → sin incumplimiento B; déficit 50 min → incumplimiento B.
3. Tolerancias **por turno** (25 min ingreso/egreso en captura de pantalla) siguen gobernando badges `▲`/`▼` sin mezclar la tolerancia de débito.
4. Jornada M+T+N: carga teórica = suma segmentos; carga real = suma de todos los pares fichados del día.
5. Tras editar régimen, backfill del mes recalcula `analitica_cumplimiento` y `validacion_fichada_dia` sin intervención manual en vis_*.
6. Tests unitarios: motor ON/OFF, tolerancia límite, compuesto M+T+N, fingerprint régimen.

---

## 8. Fuera de alcance (esta RFC)

- Déficit **semanal** o **mensual** (solo día).
- Liquidación / descuentos automáticos en nómina.
- Badge `-Nm` en celda simple (turno único M) — backlog UX separado; hoy prioridad compuesto + modal.
- Migración masiva de todos los regímenes de producción (solo piloto acordado post-implementación).

---

## 9. Referencias de código (as-built)

| Archivo | Rol |
|---------|-----|
| `web/src/schemas/regimenHorario.schema.js` | `tolerancia_debitohorario_minutos` (línea ~118) |
| `functions/modules/catalogosRegimenHorario.js` | Validación persistencia régimen |
| `shared/utils/capaTeoricaLimitesCumplimiento.js` | Enriquece capa con límites régimen |
| `shared/utils/calcularDeltasCumplimiento.js` | `debito_tiempo`, alerta C6/C7 |
| `shared/utils/resolverValidacionFichadaDia.js` | Semáforo ← `alertas_activas` |
| `web/src/features/grilla/grillaAnaliticaCumplimientoUi.js` | Copy modal auditoría |

---

## 10. Decisiones (cerradas — 2026-06-17)

| # | Pregunta | Decisión |
|---|----------|----------|
| D1 | ¿Default del tilde en regímenes nuevos? | **ON** — estricto por defecto; RRHH apaga explícitamente si el grupo lo requiere |
| D2 | ¿Mostrar carga real/teórica en modal con análisis OFF? | **Sí** — informativo; sin alerta ni semáforo por déficit |
| D3 | ¿Nombre visible en UI? | **«Análisis de carga horaria total»** |

---

## 11. Implementación

| Fase | Estado |
|------|--------|
| F1 — Schema + Callable + capa + fingerprint + form RRHH | ✅ 2026-06-17 |
| F2 — Motor (`calcularDeltasCumplimiento`, separación dim. A/B en `resolverPresentacionCompuestoCelda`) | ✅ 2026-06-17 |
| F3 — UI grilla modal (copy análisis OFF + badges dim. A) | ✅ 2026-06-17 |
| F4 — Backfill piloto jun-2026 Sala Internación 1 | ✅ 2026-06-17 |
| Render — reconciliación `estado_tramo` + color solo disciplina en pisos M/T/N | ✅ 2026-06-17 |
| Dual badge dim A (tardanza + salida mismo tramo) + `badges[]` en presentación | ✅ 2026-06-17 |
| Split marcas una fichada en compuesto (M+T / T+N genérico primero/último) | ✅ 2026-06-17 |
| Test T+N análogo CAMPOS d8 (motor + UI) | ✅ 2026-06-17 |

---

*Fin del RFC — F1–F4 piloto cerradas. Handoff: `HANDOFF_SESION_2026-06-17_CIERRE_ANALISIS_CARGA_GRILLA_V2.md`. Próxima sesión: auditar cambio de día (medianoche) + QA piloto.*
