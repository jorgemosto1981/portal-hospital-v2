# Arquitectura Maestra SIGAL V2

**Módulo Operativo y de Asistencia**

Este documento condensa reglas de negocio, esquemas de datos y casos borde acordados para el módulo operativo y de asistencia. Sirve como referencia estable para implementación (frontend, Cloud Functions, reglas Firestore) y onboarding de desarrolladores.

**Relación con otros documentos:** complementa `PLAN_DESARROLLO_VERSION2.md` y los módulos descritos en `docs/v2/README.md`.

---

## 1. Principios Fundacionales del Sistema

- **Identificadores determinísticos y ULID:** Toda entidad utiliza el formato `<prefijo>_<ULID>` (ej.: `per_01JQ...`). Los registros diarios usan IDs compuestos predecibles (`asi_<personaId>_<YYYYMMDD>`) para permitir escrituras directas (costo cero de lectura previa cuando el ID ya define el documento).

- **Inversión de carga (separación de responsabilidades):** El frontend (UI) es estrictamente un **consumidor pasivo**. No calcula horas, no deduce estados normativos ni procesa lógicas de licencias. Toda la inteligencia normativa ocurre en el backend a través del **Motor de Desarmado y Consolidación (MDC)**, que inyecta resultados finales en la base de datos.

- **No borrado físico:** Se utiliza deshabilitación lógica (`activo: false`) para mantener la integridad histórica.

---

## 2. Estructura de Datos Base: Identidad y Laboral

La relación entre un agente y sus cargos es **1:N** con **vigencia estricta**, reflejando pluriempleo / múltiples encuadres hospitalarios.

### A. Entidades clave

- **`personas` (`per_<ULID>`):** Legajo digital maestro. Esquema de **mapas anidados** (`identidad`, `contacto`, `metadata`, etc.) para agrupar información y evitar subcolecciones innecesarias donde no aporten.

- **`grupos_de_trabajo` (`gdt_<ULID>`):** Unidades organizativas creadas **exclusivamente por RRHH**. Actúan como **clave foránea obligatoria** para cualquier alta en historial laboral.

- **`historial_laboral_cargos` (`hlc_<ULID>` — alias histórico `lab_<ULID>`):** Define el encuadre operativo. Incluye `vigente_desde`, `vigente_hasta` (nullable) y un array **estricto** `horario_plantilla` de **7 elementos** (día de semana **1 = Lunes** a **7 = Domingo**, ISO-style). Los días no laborables se declaran con `horas` en `0` y/o `ingreso`/`egreso` nulos según contrato de validación.

### B. Tratamiento de horarios y turnos nocturnos

- **Turnos nocturnos (ancla de inicio):** Todo turno que **cruza la medianoche** (ej.: 22:00 a 06:00) pertenece **íntegramente** al **día calendario en que inicia** (día D). El día **D+1** **no** hereda esas horas en su **plantilla base** del RDA (evita doble conteo).

- **Telemetría (fichadas):** La fichada de egreso física del día **D+1** (ej.: 06:05) se **atribuye programáticamente** al array `fichadas` del **RDA del día D** para cerrar el ciclo del turno nocturno (coherencia factual con la ancla de plantilla).

---

## 3. El Registro Diario Atómico (RDA)

Unidad mínima de información: la **verdad consolidada** de un agente en un día específico.

### A. Consolidación diaria (fusión 1:N)

Cuando un agente tiene múltiples `hlc_*` **activos** el mismo día, el RDA sintetiza la expectativa así:

- **`grupos_ids`:** Array **desduplicado** y ordenado **lexicográficamente** con todos los grupos donde el agente debe prestar servicio ese día. Habilita **indexación multi-jefe** (misma fila/día visible en grillas de distintos grupos).

- **`es_laborable`:** Regla lógica **OR** — `true` si **al menos un** cargo exige presencia ese día.

- **`horas_asignadas` (fusión de intervalos):**
  - **Adyacencia:** Intervalos que se tocan sin solaparse en el interior (ej.: 08:00–14:00 y 14:00–18:00) se **unen**; el total refleja la cobertura continua (ej.: **10 h**). **Sin** `warning_solapamiento_plantilla`.
  - **Solapamiento estricto:** Intervalos con **interior compartido** (ej.: 08:00–14:00 y 12:00–16:00) se fusionan en un único intervalo (ej.: 08:00–16:00 = **8 h**). Se activa `warning_solapamiento_plantilla: true` (auditoría RRHH).
  - **Tramos disjuntos:** Tras fusionar solapamientos, se **suman** las duraciones de los **componentes aislados** (ej.: 08:00–12:00 y 16:00–20:00 → **8 h** totales).

Solo entran en el cómputo los bloques del día con `es_laborable: true` y ventanas horarias válidas según contrato.

### B. Esquema orientativo del RDA

El siguiente JSON es **orientativo** (campos pueden extenderse con `metadata`, flags de anomalía, `periodo` para consultas, mapa completo de aportes con `estado_ticket`, etc.):

```json
{
  "id": "asi_per123_20260425",
  "persona_id": "per_123",
  "grupos_ids": ["gdt_A", "gdt_B"],
  "periodo": "2026-04",

  "es_laborable": true,
  "horas_asignadas": 8,

  "estado_consolidado": "ART_14_A",
  "prioridad_actual": 90,

  "fichadas": [
    { "ingreso": "08:00", "egreso": "16:00" }
  ],

  "aportes_normativos": {
    "tic_888": {
      "tipo": "ART_14_A",
      "prioridad": 90,
      "estado_ticket": "APROBADO"
    }
  }
}
```

**Capas:**

- **Factual:** `fichadas` — no debe ser sobrescrita por el MDC al aplicar tickets; las reglas de atribución cruzan medianoche según §2.B.

- **Normativa:** `aportes_normativos` — mapa por ULID de ticket; permite idempotencia (borrado de clave + `recalcularVeredicto`).

---

## 4. Motor de Desarmado y Consolidación (MDC)

Servicio backend (p. ej. **Cloud Function**) transaccional: traduce un **ticket aprobado** en múltiples RDAs y resuelve colisiones normativas.

### A. Funcionamiento core

- **Explosión en batch:** Itera el rango de fechas del ticket y usa `writeBatch` de Firestore en **chunks ≤ 450** operaciones (margen bajo el límite de 500).

- **Idempotencia y reprocesador:** Si un ticket se edita o se revoca, el MDC localiza RDAs afectados, elimina la clave correspondiente en `aportes_normativos` (p. ej. `FieldValue.delete()` en la ruta del mapa) y vuelve a ejecutar la consolidación del veredicto.

### B. Jerarquía de la verdad (`recalcularVeredicto`)

Ante colisiones en un mismo RDA, el estado ganador sigue esta escala (pesos):

| Prioridad | Peso | Ejemplos / significado |
|-----------|------|-------------------------|
| Suspensión / sanción disciplinaria | 100 | Máxima precedencia |
| Licencia normativa / médica (SARH, etc.) | 90 | Sobre planificación salvo reglas específicas documentadas en tickets |
| Franco / descanso programado | 80 | Base de planificación |
| Presente | 70 | Asistencia validada por fichadas |
| Ausencia injustificada | 10 | Default si es laborable y no aplica otro evento |

**Anomalía de presencia:** Si gana una licencia (90) pero existen fichadas físicas en el RDA, `estado_consolidado` **permanece** como licencia; se activa un flag de **anomalía de presencia** (alerta RRHH / jefatura).

**Cruce con plantilla:** Las reglas explícitas de “franco vs licencia en el mismo día” que exijan excepciones por tipo de ticket deben documentarse en el catálogo de tipos de ticket / LCR; este documento fija la escala base de pesos.

---

## 5. Grilla de Supervisión Operativa (GSO)

Componente frontend (React / Tailwind) para consumo masivo de RDAs (RRHH y jefaturas).

### A. Rendimiento y UI/UX

- **Desktop-first (excepción):** Alta densidad: `text-xs`, padding mínimo (`p-1`), bordes compactos.

- **Sticky:** Fila superior (días) y primera columna (nombres) fijas; la celda esquina superior izquierda requiere **z-index** superior para scroll diagonal estable.

- **Lazy loading y caché:** Clave de caché estricta, p. ej. `["gso", "grupo", grupo_id, periodo]`. Meses ya visitados se sirven desde **RAM** (cero lecturas Firestore) mientras la política de caché no invalide innecesariamente.

### B. Comportamiento visual (tokens)

- **Nivel 1 (grilla):** Colores sólidos (presente, licencia, ausente, franco) y `border-dashed` u equivalente para **pendientes / en curso** según producto.

- **Nivel 2 (hover):** Un **tooltip en portal** único en el DOM para no inflar el árbol de React.

- **Nivel 3 (drawer):** Panel lateral con detalle y auditoría de la celda.

---

## 6. Siguiente paso (implementación)

Con esta arquitectura referenciada, las iteraciones de código (Fase A layout, Fase B onboarding, MDC, GSO) deben alinearse a estas reglas; cualquier cambio normativo debe **actualizar primero** este documento o un anexo versionado explícito.
