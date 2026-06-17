# RFC — Cumplimiento en turno compuesto: filas alineadas por segmento (celda grilla)

> **Estado:** **Aprobado** (2026-06-17) — revisión producto / lectura fichadas (Armando)  
> **Tag documental:** `v2.8.0-rfc-cumplimiento-compuesto-filas-celda` (aprobación RFC; implementación en curso)  
> **Relación:** [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) · [`RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md`](./RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md) · [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) · [`MODULO_FICHADAS_RELOJ_V2.md`](./MODULO_FICHADAS_RELOJ_V2.md) §14  
> **Piloto de referencia:** `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (Sala Internación 1), junio 2026, turno **M+T+N** continuo (06:00→06:00).

---

## 0. Resumen ejecutivo

| Tema | Decisión |
|------|----------|
| **Problema** | `fichadas_reales` llega como 1 o N filas (reloj / ABM); el negocio y la analítica leen **N segmentos** teóricos. La UI hoy mezcla sobre colapsado + cadenas concatenadas + badges “flotantes” → incoherencia cognitiva. |
| **Principio** | **Pila alineada por índice canónico:** fila *i* = segmento *i* (`capa.segmentos[i]`). Teoría, fichada proyectada y badge/status comparten la misma fila. |
| **Persistencia** | **`fichadas_reales` no se falsifica** en Firestore. Capa **`presentacion_compuesto`** materializada en `vis_*` (§4.2), calculada en el mismo pipeline que Fase F. |
| **Teoría en celda** | Con compuesto (**≥2 segmentos**), mostrar **siempre N líneas de teoría**, aunque `tiene_huecos === false` (sin colapsar a “06–06” una sola línea). |
| **Motor (pendiente implementación)** | Cobertura por intersección tramo real ∩ ventana nominal; umbral **≥50%** de carga del segmento → presente/parcial; &lt;50% → ausente de tramo. Fase A: sobre compuesto punta a punta; fase B: desarme por segmentos. |

---

## 1. El problema (divergencia estructural)

### 1.1 Dos modelos que hoy no comparten forma

| Modelo | Forma | Origen |
|--------|--------|--------|
| **Persistencia fichada** | 0…N filas en `vis_*.dias.{DD}.fichadas_reales[]` (`ingreso`, `egreso`, `fecha_ymd`, `fecha_egreso_ymd`) | Reloj, import, ABM RRHH |
| **Teoría / cumplimiento** | Siempre **N** entradas en `capa_teorica.segmentos[]` y en `analitica_cumplimiento.segmentos_cumplimiento[]` (cuando `calculo_por_segmentos`) | Materialización `asi_*`, motor Fase F |

El reloj “escupe” **presencia continua** (un par largo 06:38→05:35). RRHH puede cargar **dos ABM** (mañana + noche). El motor debe decidir cumplimiento **por tramo M/T/N**, pero la grilla hoy:

1. **Teoría:** en compuesto continuo suele mostrar un solo sobre **06:00–06:00** (`horarioDisplayDesdeSegmentos` retorna `null` si no hay huecos).
2. **Fichada RRHH:** `textoHorarioFichadaReal` concatena filas con ` · ` → **una o dos cadenas**, no N filas por segmento.
3. **Badges:** `listaBadgesIncumplimientoPorSegmentoCelda` solo lista segmentos con incumplimiento &gt; 0 → **AUSENTE** sin fila hermana con horario del tramo que sí cumplió.

### 1.2 Síntoma en piloto (CHAPARRO, `per_01KR3HD24AMJ6YX3N7B3GPAZJ4`)

Datos reales junio 2026 (motor actual post-empareje global ABM; **sin** aún capa de presentación):

| Día | Fichada persistida | Solape nominal M/T/N (aprox.) | Lectura humana esperada | UI / motor hoy (resumen) |
|-----|-------------------|-------------------------------|-------------------------|---------------------------|
| **13** | 06:38→05:35 (+1) | 92% / 100% / 95% | Guardia casi completa; déficit ~1 h | Una línea larga + **AUSENTE** M y N; T “gana” el único tramo emparejado |
| **14** | 06:35→05:40 (+1) | 93% / 100% / 96% | Idem | Idem |
| **15** | 05:45→04:00 (+1) | 100% / 100% / 75% | M cubierta; cierre antes de N | M OK; **AUSENTE** T y N pese a solape alto en ventanas |
| **16** | ABM 05:54–14:10 + 21:50–05:55 | M+N parcial, T vacío | M OK, **T ausente**, N OK | Corregido en motor (empareje); UI aún no apila por fila |

La **débito agregado** del día (55–105 min en 13–15) es razonable; el fallo es **semántica y anclaje visual por tramo**.

---

## 2. Principio de diseño: pila alineada por índice canónico

### 2.1 Regla

Para `segmentos.length === N` (N ≥ 2):

```
fila[i] ↔ segmentos[i]  (mismo orden que materialización: típicamente M → T → N o M → N)
```

Cada fila expone **tres anclajes** en la misma línea (o sub-fila apilada):

1. **Teoría del tramo** — rango HH:mm desde `ingreso_iso` / `egreso_iso` del segmento.
2. **Fichada proyectada** — intersección de la unión de tramos reales con la ventana nominal del segmento (ver §5), o vacío si ausente.
3. **Estado / badge** — `OK` (sin chip), `AUSENTE`, `▼ …` (tardanza/salida/déficit de tramo), coherente con `segmentos_cumplimiento[i]`.

**Contrato visual:** si el tramo T está ausente, el badge **AUSENTE** cuelga de la **fila T**, no del pie de la celda bajo un bloque “06–06”.

### 2.2 Compuestos de dos turnos (M+N, M+T, etc.)

Misma regla con **N = 2**. No cambiar el número de filas entre vista jefe y RRHH.

### 2.3 Teoría siempre en N líneas (incluso continuo 06–06)

**Decisión de producto (2026-06-17):** aunque `tiene_huecos === false`, la celda **no** colapsa la teoría a una sola línea envelope. Renderiza **N líneas** (M, T, N) para mantener anclajes con badges y fichada proyectada.

El sobre 06:00→06:00 puede seguir existiendo en datos (`ingreso_teorico_final` / `egreso_teorico_final`) para liquidación y “fuera de turno” global; **no** reemplaza la matriz visual por segmento.

---

## 3. Vistas Jefe vs RRHH (misma matriz, distinto detalle)

| Dimensión | Vista Jefe | Vista RRHH / fichadas |
|-----------|------------|------------------------|
| **Filas** | N | N (idéntico) |
| **Teoría** | Etiqueta corta por tramo (“Mañana”, “Tarde”, “Noche”) o rango compacto | Rango HH:mm explícito (ej. 14:00–22:00) |
| **Fichada** | Opcional / resumida (“OK”, “—”, color) | Intersección proyectada o `—` si ausente |
| **Badge** | Semáforo por fila o chip AUSENTE / ▼ | Igual + tooltips con minutos y `segmento_id` |
| **Déficit día** | Un resumen en modal o chip agregado (opcional) | Visible en analítica; no sustituye filas |

---

## 4. Capa de adaptación: `presentacion_compuesto`

### 4.1 No tocar `fichadas_reales`

- Firestore conserva la verdad operativa (reloj, ABM).
- ABM puede seguir agregando **una fila por alta** sin `segmento_id` obligatorio en v1 de este RFC.

### 4.2 Contrato y ubicación (decisión: materializar en Firestore)

**Decisión (2026-06-17):** **Opción A** — sub-objeto `vis_*.dias.{DD}.presentacion_compuesto`, materializado junto con `analitica_cumplimiento` y `validacion_fichada_dia` (mismo fingerprint / recálculo en worker Fase F).

**Motivo:** la grilla mensual puede renderizar del orden de **~900 celdas** por vista (30 días × ~30 personas). Calcular intersección y proyección **solo en el cliente** por celda degrada performance. Con el worker pre-digiriendo N sub-filas, el front **lee e imprime**.

**Implementación:** la lógica vive en `shared/` como función pura `resolverPresentacionCompuestoCelda(celda, capa, analitica)`; el **backend** la invoca al persistir (única fuente de verdad para grilla y modal). El front **no** recalcula en caliente salvo tests o herramientas de diagnóstico.

~~Opción B (solo al vuelo en listado): descartada para producción; permitida en scripts `diag_*`.~~

```typescript
type FilaPresentacionCompuesto = {
  segmento_id: string;           // ej. "M" | "T" | "N"
  orden: number;                 // 0..N-1, = índice en capa.segmentos
  teoria_label: string;          // "06:00–14:00"
  fichada_label: string | null;  // "06:38–14:00" o null / "—" si ausente
  estado_tramo: "presente" | "parcial" | "ausente";
  badge_label: string | null;    // "AUSENTE" | "▼ 3h 30m" | null
  badge_tipo: "ausente_tramo" | "tardanza" | "salida" | null;
  cobertura_minutos: number;     // intersección nominal
  carga_teorica_minutos: number;
};

type PresentacionCompuesto = {
  version: 1;
  turno_compuesto_id: string | null;
  filas: FilaPresentacionCompuesto[];  // length === segmentos.length
  eval_fingerprint?: string;           // opcional: mismo criterio que validacion_fichada_dia
};
```

**Regla de lectura UI:** grilla y `DiaGrillaDetalleModal` consumen **solo** `presentacion_compuesto.filas[]` para apilar teoría + real + badge en compuesto; dejan de concatenar `textoHorarioFichadaReal` en una sola línea cuando `filas.length >= 2`.

### 4.3 Relación con analítica existente

- `analitica_cumplimiento.segmentos_cumplimiento[]` sigue siendo la fuente de **verdad numérica** (tardanza, salida, ausente_tramo).
- `presentacion_compuesto` es **derivada** (proyección + etiquetas). Si el motor evoluciona (§6), ambas se recalculan en el mismo pipeline (`resolverValidacionFichadaDia` / worker tras fichada).

---

## 5. Algoritmo de proyección (vista) — borrador

> Implementación futura; define comportamiento esperado para QA y dev front/back.

### 5.1 Entradas

- `fecha_ymd` del día de celda.
- `segmentos[]` con `ingreso_iso`, `egreso_iso`, `segmento_id`.
- `fichadas_reales[]` → unión de tramos `[ingreso_ms, egreso_ms]` (misma lógica que `extraerTramosFichadaDesdeCelda`).

### 5.2 Cobertura por segmento

Para cada segmento S con ventana nominal `[V_in, V_out]`:

```
cobertura_S = minutos de ⋃ tramos reales intersectados con [V_in, V_out]
carga_S     = V_out - V_in (minutos)
ratio_S     = cobertura_S / carga_S
```

### 5.3 Etiqueta fichada en fila i

- Si `estado_tramo === "ausente"` (`ratio_S < 0.5` según §6): `fichada_label = null` (UI muestra `—` o solo AUSENTE).
- Si presente/parcial: mostrar **recorte** en HH:mm institucional:
  - `ingreso_mostrar = max(primer ingreso real en S, V_in)`
  - `egreso_mostrar = min(último egreso real en S, V_out)`  

**Medianoche (segmento N y ventanas que cruzan día):** antes de `max`/`min`, convertir marcas a **instantes absolutos** (`instanteMarcaInstitucionalMs` + `fecha_ymd` / `fecha_egreso_ymd` por fila). La ventana nominal del segmento usa `ingreso_iso` / `egreso_iso` (ya en UTC anclado). No comparar solo HH:mm sin fecha civil — evita que N (22:00→06:00) colapse con M del mismo calendario.

(si cruza medianoche en **display**, respetar `fecha_egreso_ymd` al formatear HH:mm institucional).

**No** repetir en cada fila el rango global 06:38–05:35 cuando una sola marca cubre el día.

### 5.4 Ejemplo canónico (producto)

Turno **M+T+N**. Una fichada **06:00–18:30** (un tramo):

| Fila | Teoría | Fichada proyectada | Estado | Badge |
|------|--------|--------------------|--------|-------|
| M | 06:00–14:00 | 06:00–14:00 | presente | — |
| T | 14:00–22:00 | 14:00–18:30 | parcial (4h30 / 8h &gt; 50%) | ▼ déficit 3h30 hasta 22:00 |
| N | 22:00–06:00 | — | ausente | AUSENTE |

---

## 6. Motor de cumplimiento (alcance RFC, implementación posterior)

Este RFC **prioriza presentación**; alinea criterios con el motor para que `segmentos_cumplimiento[i]` y `presentacion_compuesto.filas[i]` no contradigan.

### 6.1 Fase A — Sobre compuesto

Evaluar si la unión de tramos **encaja** con el envelope `ingreso_teorico_final` → `egreso_teorico_final` (tolerancias régimen). Si encaja como guardia continua, repartir cobertura por intersección (no emparejar “un tramo → un solo segmento”).

### 6.2 Fase B — Desarme por segmentos

Si no encaja punta a punta (fichadas parciales, varias filas ABM, salida temprana):

- Calcular `cobertura_S` y `ratio_S` para cada segmento.
- **`ratio_S >= 0.5`** → tramo **presente** (total o parcial); disciplina sobre tramo **recortado** a la ventana (tardanza/salida vs nominal de S).
- **`ratio_S < 0.5`** → **ausente_tramo** (badge AUSENTE en fila S).

Umbral 50%: parametrizable en `cfg_regimen_horario` en implementación futura; default 50% en piloto.

### 6.3 Empareje de múltiples filas ABM

Cuando hay 2+ filas en `fichadas_reales`, asignar cada fila al segmento de **mayor solape** (empareje global, ya aplicado al caso día 16). La presentación sigue **N filas**: filas sin fichada asignada → ausente en esa fila aunque otra fila exista en el día.

---

## 7. Matriz de casos de prueba (QA — prueba del ácido)

**Persona:** `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` · **Grupo:** `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · **Teoría:** M+T+N 06–06.

| ID | Día / escenario | Entrada fichada | Resultado esperado (filas) |
|----|-----------------|-----------------|----------------------------|
| **QA-C1** | **13** | 06:38→05:35 (+1) una fila | **3 filas:** M/T/N con proyección en cada ventana; **no** dos AUSENTE en M y N con una sola línea global; déficit agregado ~63 min compatible con semáforo |
| **QA-C2** | **14** | 06:35→05:40 (+1) | Igual C1; déficit ~55 min |
| **QA-C3** | **15** | 05:45→04:00 (+1) | M presente; T/N según cobertura real (N ~75% → parcial o presente según regla 50%); **no** T y N ambos AUSENTE 8h si solape &gt;50% |
| **QA-C4** | **16** | ABM 05:54–14:10 + 21:50–05:55 | Fila M: horario M; Fila T: **AUSENTE**; Fila N: horario N; sin tardanza 470 min en T |
| **QA-C5** | Sintético | 06:00–18:30 una fila | M OK; T parcial con ▼; N AUSENTE (§5.4) |
| **QA-C6** | M+N (2 seg.) | Solo mañana fichada | **2 filas:** M con horario; N **AUSENTE** |
| **QA-C7** | Modal vs grilla | Cualquier C1–C4 | Misma `presentacion_compuesto` tras refresh modal RRHH |

**Comandos diagnóstico (dev):**

```bash
node scripts/diag_celda_cumplimiento.mjs --persona=per_01KR3HD24AMJ6YX3N7B3GPAZJ4 --fecha=2026-06-13 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V
node --test functions/test/calcularDeltasCumplimiento.test.js
```

---

## 8. Impacto en componentes (checklist implementación)

| Área | Cambio |
|------|--------|
| `shared/` | `resolverPresentacionCompuestoCelda(celda, capa, analitica)` + tests unitarios |
| Motor | Evolución `calcularDeltasCumplimiento` (cobertura %, fases A/B) — épica separada o sub-fase F+ |
| `validacionFichadaDiaPersistencia` / worker | Persistir `presentacion_compuesto` con fingerprint |
| `horarioInstitucionalDisplay` | Dejar de ocultar tramos teóricos en continuo **para celdas compuestas en grilla** (usar N líneas) |
| `GrillaMesEquipoTabla` / celda | Render matriz N filas; RRHH deja de usar solo `textoHorarioFichadaRealDesdeCelda` concatenado |
| `DiaGrillaCelda` / `grillaAnaliticaCumplimientoUi` | Badges por índice de fila, no lista filtrada solo incumplimientos |
| Modal día | Leer misma estructura |

---

## 9. Fuera de alcance (esta RFC)

- Cambiar formato de import reloj o obligar N filas en ABM.
- Licencias / overrides: se documenta que la cobertura debe descontar ventanas cubiertas por licencia **antes** del 50% (trabajo futuro con `licenciaCubreDiaFichada`).
- Liquidación final: puede seguir usando débito agregado; la matriz es **operativa y UX**.

---

## 10. Estado y orden de implementación

**RFC aprobado.** Matriz §7 (QA-C1, QA-C5 ácido) es la base TDD.

### 10.1 Orden recomendado (épica)

| Fase | Entregable | Notas |
|------|------------|--------|
| **1 — Motor cobertura** | Fase A/B en `calcularDeltasCumplimiento` (ratio ≥50%, intersección por segmento) | Sin esto, `segmentos_cumplimiento[i]` sigue contradiciendo días 13–15; los badges de `presentacion_compuesto` heredarían errores. |
| **2 — Presentación** | `resolverPresentacionCompuestoCelda` + tests + persistencia `presentacion_compuesto` | Proyección §5; badges alineados a analítica ya corregida. |
| **3 — UI** | Grilla + modal leen `filas[]`; teoría N líneas en compuesto | Solo lectura; sin cálculo pesado en React. |

**No invertir 1 y 2:** la presentación puede mostrar filas coherentes con proyección §5 aun con motor viejo, pero **estado_tramo** y **badge** deben salir del motor — implementar presentación sola reproduce AUSENTE falsos en piloto hasta cerrar fase 1.

### 10.2 Pendientes documentales

1. Actualizar [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) con QA-C1…C7.
2. Release notes Fase F+ al mergear implementación.

---

## 11. Referencias de sesión

- Handoff QA fichadas / teoría: [`HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md`](./HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md) (si existe en repo).
- Fix empareje ABM M+N (día 16): `calcularDeltasCumplimiento` — empareje global por solape; test `ABM M+N en M+T+N`.
