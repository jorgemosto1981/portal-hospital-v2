# RFC — Fase F: validación fichada persistida y semáforo grilla (Jefe / RRHH)

> **Estado:** **Aprobado** (Fase B — 2026-06-16) · **Fase C** autorizada  
> **Rama:** `feature/grilla-fase1-colision`  
> **Relación:** [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) · [`MODULO_FICHADAS_RELOJ_V2.md`](./MODULO_FICHADAS_RELOJ_V2.md) §14 · [`HANDOFF_SESION_2026-06-12_PAUSA_QA_FICHADAS_COLISION.md`](./HANDOFF_SESION_2026-06-12_PAUSA_QA_FICHADAS_COLISION.md)  
> **Plan Cursor:** `cruce_teoría_f_n_real_2c7ce00d.plan.md`

---

## 0. Resumen ejecutivo

| Capa | Esta fase |
|------|-----------|
| **Producto** | Visual y semántica en grilla **jefe** y **RRHH**: semáforo V/A/R (pasado/hoy), futuro gris solo teórico, modal con alertas legibles. **No** cambia cómo se ficha (reloj, manual, ABM). |
| **Arquitectura** | Backend **evalúa una vez**, **persiste** `validacion_fichada_dia`; listado **solo lee** (+ `grillaVistaCacheStore`). **Prohibido** calcular semáforo en sanitize o en React al pintar el mes. |
| **Fase A (paralelo)** | QA manual valida **matemática** de `analitica_cumplimiento` (matriz B/P/C). **No** se arregla la discrepancia UI vieja semáforo OK vs badges ▲/-Nm — eso es **Fase C**. |
| **Sin compat atrás** | Se elimina `estado_fichada_jefe` como contrato público; backfill/re-materialización piloto aceptable. |

---

## 1. Objetivo y alcance

### 1.1 Entregable Fase F

Traducir datos **ya producidos** en `vis_*` (`analitica_cumplimiento`, presencia, teoría, `fichadas_esperadas`, eventos/licencias) a:

- Sub-objeto persistido `validacion_fichada_dia` (solo días evaluables).
- UI jefe: color + `texto_resumen`; futuro sin objeto → gris.
- UI RRHH: mantiene real celeste / teórico en modal; puede reutilizar el mismo sub-objeto en bandeja/resumen.

### 1.2 Fuera de alcance

- Import TXT, enrolamiento, `guardarCapaFichadaDia`, outbox, ticketera retroticket (épica D).
- Colorear futuro por **estado de licencia** (trámite/aprobada/rechazada): solo **hook UI** documentado; implementación posterior.

---

## 2. Alcance temporal y austeridad Firestore

### 2.1 Regla de oro: dos universos

| Universo | Condición | Motor fichadas | Campo en Firestore |
|----------|-----------|----------------|-------------------|
| **Pasado + hoy** | `fecha_ymd <= hoy_institucional` | Sí, si aplica §9 (licencias / expectativa) | `dias.{DD}.validacion_fichada_dia` **opcional** según §9 |
| **Futuro** | `fecha_ymd > hoy_institucional` | **No invocar** | **`validacion_fichada_dia` NO EXISTE** |

**Prohibido:**

- Escribir `estado_semaforo: "FUTURO"` o cualquier placeholder en días futuros.
- Pre-calcular validación para todo el mes al abrir grilla.
- Recalcular el mes en `grillaVisSanitizeGso` o en el cliente.

**UI futuro:** si `validacion_fichada_dia` **ausente** y `fecha_ymd > hoy` → celda **gris/neutro**, solo información teórica (turno, horarios). Coste BD: **cero** writes de fichadas en futuro.

### 2.2 Zona horaria

`hoy_institucional` = fecha civil en `America/Argentina/Buenos_Aires` (misma convención que fichadas y grilla).

---

## 3. Schema `validacion_fichada_dia`

**Ubicación:** `vistas_grilla_mes_agente` → `dias.{DD}.validacion_fichada_dia`.

**Presencia del campo:**

| Situación | `validacion_fichada_dia` en documento |
|-----------|----------------------------------------|
| Día futuro | **Ausente** (no clave, no `null` escrito a propósito en batch) |
| Día pasado/hoy, licencia cubre día entero (§9) | **Ausente** — capa licencias manda en UI |
| Día pasado/hoy, sin expectativa fichada (franco/NL sin `f_n`) | **Ausente** — sin semáforo reloj |
| Día pasado/hoy, evaluado | Objeto §3.1 o §3.2 según pipeline |

### 3.1 Contrato listado (liviano — sanitize GSO / caché RAM)

Campos mínimos que viajan al listar grilla jefe:

```typescript
type ValidacionFichadaDiaListado = {
  estado_semaforo: "VERDE" | "AMARILLO" | "ROJO";
  texto_resumen: string;           // una línea, lenguaje administrativo
  eval_estable: boolean;
  eval_fingerprint: string;        // hash estable inputs §4.3
  evaluado_en: string;             // ISO-8601 UTC
};
```

**No** incluir en listado: `alertas_semanticas`, `analitica_cumplimiento` completa, `fichadas_reales`.

### 3.2 Contrato modal (lazy — callable día / refresh modal)

Extiende §3.1:

```typescript
type AlertaSemantica = {
  codigo: string;                  // enum §3.4
  texto_humano: string;
  minutos_desvio?: number;
  herramienta_sugerida: string;    // enum §3.5
};

type ValidacionFichadaDiaModal = ValidacionFichadaDiaListado & {
  alertas_semanticas: AlertaSemantica[];
  editable_por_jefe?: boolean;      // épica D / GSO escritura
  motivo_bloqueo?: string | null;  // ej. PERIODO_CERRADO, PLAZO_RETROACTIVO_VENCIDO
};
```

Persistencia en Firestore: se puede guardar **versión modal completa** en el mismo sub-objeto al evaluar (una escritura); el listado solo **proyecta** el subconjunto §3.1 en sanitize (sin recalcular).

### 3.3 Enum `estado_semaforo` (cerrado — solo pasado/hoy evaluado)

| Valor | Regla |
|-------|--------|
| `VERDE` | `fichadas_esperadas > 0`; marcas presentes; `analitica_cumplimiento` sin alertas accionables de divergencia; disciplina y débito dentro de tolerancias de régimen materializado |
| `AMARILLO` | `f_n > 0`; hay al menos una marca; divergencia: margen (tardanza/egreso anticipado), `FICHADA_FUERA_TURNO_TEORICO`, marca impar, ausencia parcial multi-segmento (cuando exista soporte segmentos) |
| `ROJO` | `f_n > 0`; **cero marcas** tras reglas capa 4 (matriz P1/P4/P6); ventana de evaluación cumplida si aplica `ausencia_automatica` |

**Unificación Fase C:** `VERDE` debe ser **consistente** con ausencia de badges ▲/-Nm en jefe (hoy inconsistente — no arreglar en Fase A).

### 3.4 Códigos `alertas_semanticas[].codigo` (extracto)

| Código | Origen típico |
|--------|----------------|
| `TARDANZA_PUNITIVA` | `analitica_cumplimiento.alertas_activas` |
| `SALIDA_ANTICIPADA` | idem |
| `DEFICIT_HORARIO_GRAVE` | idem |
| `FICHADA_FUERA_TURNO_TEORICO` | idem |
| `MARCA_IMPAR` | `celdaTieneFichadaImpar` |
| `AUSENCIA_AUTOMATICA` | analítica (contexto ROJO previo a cierre) |

### 3.5 `herramienta_sugerida` (enum)

| Código alerta | `herramienta_sugerida` |
|---------------|------------------------|
| `MARCA_IMPAR` | `DERIVAR_RRHH_MARCA_MANUAL` |
| `FICHADA_FUERA_TURNO_TEORICO` | `CAMBIO_INTERCAMBIO_TURNO_EXISTENTE` |
| Tardanza / egreso / déficit en margen | `SOLICITAR_LICENCIA_FRANQUICIA` (u otro según artículo — validación ticketera en épica D) |

El jefe **nunca** recibe `INYECTAR_MARCA_VIRTUAL`.

---

## 4. Motor, persistencia y fingerprint

### 4.1 Módulos (Fase C)

| Módulo | Rol |
|--------|-----|
| [`calcularDeltasCumplimiento.js`](../../shared/utils/calcularDeltasCumplimiento.js) | Matemática disciplina + débito (ya existe) |
| [`capaTeoricaLimitesCumplimiento.js`](../../shared/utils/capaTeoricaLimitesCumplimiento.js) | Inyecta tolerancias régimen en slice teórico |
| **`resolverValidacionFichadaDia.js`** (nuevo) | Orquesta: gates §2/§9 → presencia → analítica → enum V/A/R → `alertas_semanticas` |

`resolverValidacionFichadaDia` **no** duplica fórmulas; consume `analitica_cumplimiento` ya persistida cuando `eval_estable` y fingerprint coinciden, o invoca `calcularDeltasCumplimiento` solo en recálculo.

### 4.2 Cuándo escribir (granular)

| Evento | Acción |
|--------|--------|
| `materializarTurnoTeoricoDia` / outbox | Recalcular **solo días** tocados; `update` puntual `dias.{DD}` |
| `guardarCapaFichadaDia` / import | Invalidar `eval_estable` en esa celda; recalcular; write |
| Licencia MDC / cambio teoría en día | Invalidar fingerprint; recalcular si aplica §9 |
| Día futuro | **No write** de `validacion_fichada_dia` |
| Licencia cubre día (§9) | **No write**; si existía, **borrar** sub-objeto en mismo `update` |

### 4.3 `eval_estable` y `eval_fingerprint`

- `eval_estable: true` solo si el resultado semáforo + resumen + alertas no cambiarían ante mismos inputs.
- `eval_fingerprint` = hash determinista de: `fecha_ymd`, fingerprint teoría (`rda_*`, `fichadas_esperadas`, tolerancias materializadas en slice), marcas normalizadas (`fichadas_reales`), versión `analitica_cumplimiento.version`, flag licencia cubre día.

Si `eval_estable === true` y fingerprint coincide → **skip** motor (0 writes).

### 4.4 Invalidación

Cualquier evento que cambie inputs del fingerprint → `eval_estable: false` o eliminación del sub-objeto hasta próxima evaluación.

Invalidar también entrada correspondiente en `grillaVistaCacheStore` (hoy `invalidateGrupoPeriodo`; extender por agente si hace falta).

---

## 5. Jerarquía licencias vs semáforo fichadas (CRÍTICO)

### 5.1 Principio cultural

El semáforo de **reloj** no debe generar **ROJO urgente** si el agente está **legalmente cubierto** por licencia de día completo aprobada (vacaciones, LAO día entero, etc.). La grilla ya comunica licencias por capa eventos; Fase F **no compite** con eso.

### 5.2 Regla de evaluación

Antes de invocar motor fichadas o persistir `validacion_fichada_dia`:

```text
SI fecha_ymd > hoy → NO evaluar (§2)
SI licenciaCubreDiaCompleto(celda) → NO evaluar; NO persistir validacion_fichada_dia
SI NO celdaEsperaFichada(celda) Y fichadas_esperadas no aplica → NO evaluar
SINO → evaluar y persistir según §3.3
```

### 5.3 `licenciaCubreDiaCompleto(celda)` (especificación Fase C)

Función pura en `shared/utils` (nombre definitivo en implementación), criterios mínimos:

1. Celda con **evento(s)** de licencia en `dias.{DD}.eventos[]` (o señal GSO equivalente ya usada en grilla) en estado **aprobado/consolidado** (no borrador ni rechazado).
2. La licencia **cubre la expectativa de asistencia** del día: día laborable o guardia con `fichadas_esperadas > 0` queda justificado como no fichable (matriz **P6** — licencia justifica ausencia/impar).
3. **Franco con licencia solapada** (US-7): no semáforo ROJO por ausencia de marcas.

**UI:** cuando no hay `validacion_fichada_dia` por licencia, el jefe ve la celda según **capa licencias** (chip/código/color existentes). No se inventa `estado_semaforo: "AZUL"` en el sub-objeto fichadas — evita duplicar semántica.

### 5.4 ROJO solo cuando

- `f_n > 0` (o `celdaEsperaFichada`),
- capa 4 materializada y **cero marcas** (o `ausencia_automatica` true),
- **y** `licenciaCubreDiaCompleto === false`,
- **y** `fecha_ymd <= hoy`.

---

## 6. Tolerancias — matar hardcode (120 / 30 / 25%)

### 6.1 Ya resuelto desde régimen (mantener)

| Uso | Fuente | Materialización |
|-----|--------|-----------------|
| Gracia ingreso / egreso | `turno.tolerancia_ingreso_min`, `tolerancia_egreso_min` en `cfg_regimen_horario` | [`enriquecerLimitesCumplimientoEnCapa`](../../shared/utils/capaTeoricaLimitesCumplimiento.js) → `ingreso_limite_con_gracia_iso`, `egreso_limite_con_gracia_iso` |
| Débito horario | `regimen.tolerancia_debitohorario_minutos` | `tolerancia_debitohorario_minutos` en slice |

`calcularDeltasCumplimiento` **ya lee** esos campos del slice enriquecido para disciplina y déficit.

### 6.2 Literales pendientes (Fase C — **solo régimen**, sin cfg fichadas)

| Literal hoy | Archivo | Reemplazo normativo |
|-------------|---------|---------------------|
| `AUSENCIA_VENTANA_MIN = 120` | `calcularDeltasCumplimiento.js` | Campo en **`cfg_regimen_horario`** (nivel régimen o turno): `ventana_ausencia_automatica_min` → materializar en slice como `ventana_ausencia_automatica_min` |
| `SOLAPE_MIN_FUERA_TURNO_MIN = 30` y `25%` carga | `evaluarFichadaFueraTurnoTeorico` | Campos régimen: `umbral_solape_fuera_turno_min` y `umbral_solape_fuera_turno_pct` (0–100) → materializados en slice; fórmula: `umbral = max(umbral_min, round(carga * pct/100))` |
| `DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN = 30` | `capaTeoricaLimitesCumplimiento.js` | Solo fallback en **seed/migración** si régimen legacy sin campo; en prod el régimen debe traer valor — documentar en acta RRHH |

**Prohibido:** nuevo documento `cfg_politica_validacion_fichadas`, `if (minutos > 15)` sueltos, o leer tolerancias desde UI.

### 6.3 Secuencia Fase C (tolerancias)

1. Ampliar schema Zod/seed `cfg_regimen_horario` con campos §6.2 (defaults en seed alineados a comportamiento actual: 120, 30, 25).
2. Extender `enriquecerLimitesCumplimientoEnCapa` para copiar al slice.
3. Cambiar firmas internas de `calcularDeltasCumplimiento` / `evaluarFichadaFueraTurnoTeorico` para leer **solo** `capaTeoricaGrupo` enriquecido.
4. Tests golden actualizados con slice explícito (sin depender de constantes ocultas).

---

## 7. Lectura API, sanitize y caché

### 7.1 `grillaVisSanitizeGso`

- Proyectar `validacion_fichada_dia` §3.1 si existe.
- **No** llamar `evaluarEstadoFichadaJefe` ni `calcularDeltasCumplimiento`.
- Eliminar exposición de `estado_fichada_jefe` tras Fase C.
- Días futuros: sin sub-objeto → front aplica clase `celda-futuro-gris`.

### 7.2 `grillaVistaCacheStore`

- Tras write de validación o fichada: invalidación de clave mes/grupo (y agente si se implementa).
- Cache hit = **no** recomputar semáforo; confiar en Firestore + sanitize.

### 7.3 Modal

- `obtenerVistaGrillaMesAgente` (o equivalente día) devuelve §3.2 si se almacena completo, o ensambla alertas desde sub-objeto persistido.

---

## 8. UI por rol

| Rol | Grilla mes | Modal |
|-----|------------|-------|
| **Jefe** | Pasado/hoy: borde/fondo V/A/R + `texto_resumen`; futuro: gris + teórico; licencia: capa eventos prevalece si no hay `validacion_fichada_dia` | `alertas_semanticas` + CTAs semánticos §3.5 |
| **RRHH** | Sin cambio de flujo fichada (real celeste, etc.) | Auditoría numérica + ABM |

**Hook futuro licencias en gris:** clase CSS reservada `celda-futuro-licencia--{tramite|aprobada|rechazada}` sin datos de `validacion_fichada_dia`.

---

## 9. Fases y paralelismo

| Fase | Entregable | Estado |
|------|------------|--------|
| **A** | Tests auto ✅; QA manual matriz (solo matemática base, §10) | En curso (humano) |
| **B** | **Este RFC** | **Aprobado** 2026-06-16 |
| **C** | Código: motor, persistencia, sanitize, UI, régimen §6.2, tests, backfill piloto | **En progreso** — backfill jun-26 2026-06-16; QA día a día pendiente · [`HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md`](./HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md) |
| **D** | Retroticket, `editable_por_jefe`, ticketera | Backlog |

---

## 10. Guía QA manual Fase A (no bloqueante para B)

Validar en navegador / consola / modal RRHH:

- ¿Tardanza numérica correcta vs anclas teóricas?
- ¿Impar detectado con `contarMarcasFichadaReal`?
- ¿Fuera de turno día 18 y déficit día 15 coherentes con matriz?

**Explícitamente fuera de Fase A:** arreglar que jefe muestre OK con ▲/-Nm; unificación visual = **Fase C**.

---

## 11. Criterios de aceptación Fase C

1. 50 agentes × 30 días listado jefe sin `calcularDeltasCumplimiento` en cliente/sanitize.
2. Ningún `validacion_fichada_dia` en días con `fecha_ymd > hoy` (auditoría script).
3. Día con licencia día completo aprobada: sin ROJO fichadas; sin sub-objeto o sin `ROJO`.
4. `eval_estable` reduce writes en re-listados sin cambios.
5. Matriz escenarios críticos marcados ✅ post-implementación.

---

## 12. Aprobación

| Revisor | Fecha | OK |
|---------|-------|-----|
| Producto / RRHH | 2026-06-16 | ☑ |
| Implementación | 2026-06-16 | ☑ (aprobación explícita en sesión) |

**Fase C** en rama `feature/grilla-fase1-colision`.

**Seguridad Git:** tag anotado `v2.7.0-pre-fase-f-validacion-fichada` antes del primer commit de código Fase C; al cerrar, `v2.7.0-fase-f-validacion-fichada-grilla` (ver plan Cursor `fase_c_semáforo_fichada_03916755.plan.md`).

---

**Última actualización:** 2026-06-16 — Fase C en rama; backfill piloto ejecutado; pausa QA teoría vs real (handoff 2026-06-16).
