# RFC — Patrones de dominio de saldos (A, B, C) y gobernanza cíclica (V2.1)

**Estado:** acordado producto/arquitectura 2026-05-16. **Capa contable** — regla de negocio de referencia para Functions, Rules, configurador y ticketera.  
**Relación:** [`REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md`](./REGISTRO_FASE_DOCUMENTAL_SALDOS_ABC_V2.md) (cierre fase doc), [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §2.5–§2.8, [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md), [`RFC_LAO_CHECKIN_SALDOS_V2.md`](./RFC_LAO_CHECKIN_SALDOS_V2.md), [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md), [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md), [`GUIA_RRHH_SALDOS_V2.md`](./GUIA_RRHH_SALDOS_V2.md), [`MODULO_CALENDARIO_FERIADOS_V2.md`](./MODULO_CALENDARIO_FERIADOS_V2.md).

---

## 1. Matriz de enrutamiento (configurador UI → backend)

RRHH no configura «Patrones» técnicos. En la UI (**Módulo Artículos → pestaña Impacto y Saldo →** card *Configuración de la bolsa de días / horas*) define:

| Label UI | Campo en versión | Catálogo |
|----------|------------------|----------|
| Momento de reseteo de la bolsa de días | `reinicio_ciclo_id` | `cfg_reinicio_ciclo_cuota` |
| ¿De dónde salen los días disponibles? | `origen_saldo_id` | `cfg_origen_saldo` |

El backend deriva el patrón con **`resolvePatronSaldo(reinicio_ciclo_id, origen_saldo_id, es_lao_anual)`** y enruta persistencia, validación y vista.

### 1.1 Regla de oro (routing lógico)

| Patrón | Nombre | `reinicio_ciclo_id` | `origen_saldo_id` (versión) | Condición extra |
|--------|--------|---------------------|-----------------------------|-----------------|
| **A** | Stock multi-año / LAO | `cfg_rcc_nunca` | `cfg_os_interno` | **`es_lao_anual === true`** (desempate estricto) |
| **B** | Topes cíclicos (64-A, exámenes) | ∈ `{cfg_rcc_anual, cfg_rcc_mensual, cfg_rcc_diario}` | `cfg_os_interno` | — |
| **C** | Cuenta corriente continua (francos) | `cfg_rcc_nunca` | ∈ `{cfg_os_externo_informado, cfg_os_externo_calculado}` | — |

**Excepción Patrón A (solo en bolsa, no en artículo):** durante check-in de años históricos **&lt; A**, la bolsa persistida lleva `origen_saldo_id: cfg_os_externo_informado` y `es_arrastre: true`; el artículo en versión sigue `cfg_os_interno`. El motor consume bajo reglas del Patrón A (FIFO de año, una solicitud por `anio_origen_bolsa`).

**Fase generación Patrón C:**

- **Fase 1 (hoy):** `cfg_os_externo_informado` — RRHH / check-in cargan créditos manualmente.
- **Fase 2 (futuro):** `cfg_os_externo_calculado` — módulo Asistencia/RDA acredita desde fichada (sin recalcular francos en ticketera).

### 1.2 Combinaciones inválidas o a advertir (configurador)

| Combinación | Acción |
|-------------|--------|
| Reseteo cíclico + origen externo | **Advertencia** — suele ser Patrón C mal parametrizado o error de origen |
| `cfg_rcc_nunca` + `cfg_os_interno` + `es_lao_anual === false` | **Advertencia** — motor interno sin LAO requiere definición explícita |
| LAO con `cfg_rcc_anual` (o mensual/diario) | **Error** — contradice [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md) (`cfg_rcc_nunca` obligatorio) |

### 1.3 Pseudocódigo `resolvePatronSaldo`

```text
function resolvePatronSaldo(reinicio_ciclo_id, origen_saldo_id, es_lao_anual):
  if reinicio_ciclo_id in (cfg_rcc_anual, cfg_rcc_mensual, cfg_rcc_diario):
    return PATRON_B
  if reinicio_ciclo_id == cfg_rcc_nunca and origen_saldo_id == cfg_os_interno:
    if es_lao_anual != true:
      return INVALIDO  // o ADVERTENCIA según política guardián
    return PATRON_A
  if reinicio_ciclo_id == cfg_rcc_nunca
     and origen_saldo_id in (cfg_os_externo_informado, cfg_os_externo_calculado):
    return PATRON_C
  return INVALIDO
```

### 1.4 Nota UX (configurador)

Se actualizarán los textos de ayuda en `web/src/features/configuracion/articulos/articuloLabels.js` para reflejar esta matriz (desvincular LAO del reinicio anual; orientar francos/compensatorios a origen **externo**). El contenido educativo completo está en **§7** de este RFC y en el modal de ayuda de la card de bolsa.

---

## 2. Estructura de persistencia en Firestore

Colección unificada: **`saldos_articulo_agente`**. El **ID del documento** bifurca según patrón temporal para evitar migraciones forzadas cada 1° de enero en cuentas continuas.

**Prohibido:** borrado físico de bolsas en producto (auditoría RRHH). Baja lógica vía `estado_bolsa_id` (§3).

### 2.1 Documentos anuales (Patrones A y B)

Acotados al año calendario del documento. Inicialización bajo demanda (lazy init).

| Concepto | Valor |
|----------|--------|
| **ID documento** | `sal_{anioCalendario}_per_{ULID}` |
| **Clave bolsa** | `bol_{articulo_id}_{anio_origen}` |
| **Helpers** | `saldoAnualDocId()`, `buildBolsaKey()` en [`shared/utils/laoSaldosBolsa.js`](../../shared/utils/laoSaldosBolsa.js) |

**Patrón A — consumo**

- Múltiples bolsas por persona (una por `anio_origen` de LAO).
- **FIFO de año** en UX/solicitud: consumir primero menor `anio_origen` con `disponible > 0` ([`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md)).
- Una solicitud = un solo `anio_origen_bolsa`.
- Escritura: si el doc `sal_*` ya existe → **`update`** con `bolsas.{bolsaId}` completo (no `set`+`merge` puntillado que deje campos viejos).

**Patrón B — consumo**

- Un documento por año calendario y persona; cupo desde versión (`cupo_dias_por_ciclo`, topes, `ambito_consumo_id`).
- Validación: contador de consumo en ventana del ciclo vs límite parametrizado (no FIFO multi-año).
- Detalle de mapas anidados (p. ej. `consumidos_por_mes`) — **RFC implementación Patrón B** (pendiente; alinear con MODULO §4 Bloque 4).

### 2.2 Documento global continuo (Patrón C)

Cuenta corriente (alcancía) sin corte ni reinicio el 31/12.

| Concepto | Valor |
|----------|--------|
| **ID documento** | `sal_global_per_{ULID}` |
| **Clave bolsa** | `bol_{articulo_id}_global` |
| **Invariante** | Una sola bolsa global por `articulo_id` en ese documento. **Sin** `anio_origen` (o `null`). |
| **Helper (pendiente)** | `saldoGlobalDocId(personaId)` en `shared/utils/laoSaldosBolsa.js` |

**No** alojar bolsas Patrón C solo dentro de `sal_2026_per_*` si el producto exige continuidad interanual sin job de arrastre.

---

## 3. Estados de bolsa y gobernanza (sin hard deletes)

Campo en cada entrada de `bolsas{}`: **`estado_bolsa_id`** → catálogo **`cfg_estado_bolsa_saldo`** (filas mínimas; ids sugeridos):

| ID catálogo | Uso |
|-------------|-----|
| `cfg_esb_activo` | Visible y operable por motor y Callable de vista |
| `cfg_esb_agotado` | Típico Patrón A (y C cuando `disponible === 0`). Transición en **trigger** al confirmar consumo que deja `disponible === 0` |
| `cfg_esb_expirado` | Típico Patrón B al cierre de ciclo. Transición por **job** según `cfg_fechas_cierre_ciclo` indexado por `reinicio_ciclo_id` (§10.3) |

**Lecturas del panel agente:** filtrar por estado en **servidor** (Callable), no exponer query SDK con `where(estado)` al cliente.

**Excepción operativa:** limpieza manual en BD solo con auditoría explícita (piloto); no es política de producto.

---

## 4. Contrato de vista: Callable agregador de saldos

El panel **«Mis saldos»** del agente **no** consulta `saldos_articulo_agente` con el SDK del cliente.

| Aspecto | Regla |
|---------|--------|
| **Callable** | `obtenerResumenSaldosAgente` (alias doc: `listarSaldosAgente`) |
| **Auth** | `persona_id` desde **claim**; body sin `persona_id` salvo rol RRHH documentado |
| **Rules** | Colección `saldos_articulo_agente`: **denegar lectura** agente (`allow read: if false`); lectura vía Admin SDK en Callable |
| **Cómputo** | Remanente y clasificación en servidor (no cruzar versión en caché del cliente) |

### 4.1 DTO objetivo (respuesta del servidor)

```json
{
  "schema_version": 1,
  "generado_en": "2026-05-16T12:00:00.000Z",
  "saldos_activos": [
    {
      "articulo_id": "art_…",
      "articulo_codigo": "LAO",
      "patron": "A",
      "anio_origen": 2025,
      "disponible": 10,
      "unidad": "dias",
      "estado_bolsa_id": "cfg_esb_activo"
    }
  ],
  "saldos_ciclo_actual_agotados": [
    {
      "articulo_id": "art_…",
      "articulo_codigo": "64-A",
      "patron": "B",
      "anio_ciclo": 2026,
      "remanente": 0,
      "cupo_ciclo": 6,
      "unidad": "dias",
      "estado_bolsa_id": "cfg_esb_agotado"
    }
  ],
  "hay_historial_oculto": true
}
```

### 4.2 Reglas UX del DTO (limpieza por defecto, transparencia bajo demanda)

| Bucket | Contenido | UI agente |
|--------|-----------|-----------|
| `saldos_activos` | Patrón A/C operativos; Patrón B con remanente &gt; 0 | Tarjetas a color |
| `saldos_ciclo_actual_agotados` | Solo **año calendario en curso** agotados (LAO o 64-A del año vigente) | Tarjeta grisada, badge «Agotado» |
| Histórico | LAO años pasados `agotado` + ciclos `expirado` | **No** en vista principal; botón «Ver saldos históricos» si `hay_historial_oculto` |

**Lazy load histórico:** segundo Callable o parámetro `incluir_historial=true` — solo si el usuario abre el acordeón (1 round-trip extra bajo demanda).

---

## 5. Carga manual y check-in universal (fase ticketera)

Unificación de acreditación inicial y compensatorios. Callable objetivo: **`persistirCheckinSaldosAgente`** (hermano de [`persistirCheckinLaoBolsas`](../../functions/onCall/solicitudes/persistirCheckinLaoBolsas.js); LAO histórico puede seguir en el callable LAO hasta unificar).

### 5.1 Payload mixto tipado

| Tipo fila | Patrón | Campos | Destino |
|-----------|--------|--------|---------|
| `A_lao_historico` | A | `anio_origen`, `dias_disponibles`, opc. `version_id` | `sal_{anio}_per_*` · reglas &lt; A y [`RFC_LAO_CHECKIN_SALDOS_V2.md`](./RFC_LAO_CHECKIN_SALDOS_V2.md) |
| `C_continuo` | C | `articulo_id`, `cantidad` (días/horas), opc. `version_id` | `sal_global_per_*` · `bol_{art}_global` |
| `B_ciclico` | B | (fase 2) cupo año en curso | `sal_YYYY_per_*` |

**Ejemplo producto:** *«Jorge: 10 días LAO 2024/2025 + 16 h francos»* — un acto RRHH, filas A + C; francos usables en portal **sin** módulo RDA en Fase 1.

### 5.2 Relación con callables existentes

| Callable | Alcance actual |
|----------|----------------|
| `persistirCheckinLaoBolsas` | Solo filas LAO &lt; A |
| `acreditarLaoBolsaAgente` | Acreditación motor ≥ A |
| `obtenerResumenSaldosAgente` | Vista agregada (§4) — pendiente implementación |

---

## 6. Point reads y costo (mandato MODULO §8)

1. Validación de una solicitud: **1 lectura** del doc `sal_*` aplicable (por ID predecible).
2. **Prohibido** calcular saldos operativos barrido de `solicitudes_articulo` en cliente.
3. Panel agente: **1** HTTPS Callable; lecturas Firestore internas acotadas (años con doc + `sal_global` si existe).
4. Grilla RRHH mensual: capa **Vista** `vistas_grilla_mes_agente` (§2.5 MODULO) — estrategia distinta al panel «Mis saldos».

---

## 7. Ayuda RRHH — Patrones de bolsa (copy UI y doc)

Texto del modal de ayuda en configurador (card *Configuración de la bolsa de días / horas*). **SSoT en código:** [`web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js`](../../web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js) (`AYUDA_PATRONES_BOLSA_SALDO_*`).

### Guía de Configuración de Saldos

El sistema enruta automáticamente el comportamiento de las bolsas según cómo configures el origen y el reinicio de los días.

#### Patrón A: Stock Acumulativo Multi-año (Ej. LAO)

Para licencias que acumulan días a favor y no vencen al finalizar el año calendario. Las bolsas históricas quedan vivas hasta que el agente las agota por completo.

- **Momento de reseteo:** Sin reinicio automático. El saldo no vuelve a cero el 31 de diciembre.
- **De dónde salen los días:** Bolsa interna (portal). El sistema calcula automáticamente el derecho a días (ej. cruzando con la antigüedad del legajo).  
  *(Nota: Al hacer la carga inicial o migración histórica, RRHH ingresa el saldo manualmente como «Externo informado», pero la naturaleza del artículo sigue siendo interna.)*

#### Patrón B: Topes Cíclicos (Ej. Art. 64-A, Exámenes)

Para permisos con un límite fijo por período (dictado por la ley/norma). Al terminar el ciclo, el cupo no utilizado caduca y se inicia uno nuevo desde cero.

- **Momento de reseteo:** Reinicio anual, mensual o diario. El marcador muere y se renueva al cambiar el ciclo.
- **De dónde salen los días:** Bolsa interna (portal). El cupo fijo (ej. 6 días anuales) se define directamente en los parámetros de esta versión del artículo.

#### Patrón C: Cuenta Corriente Continua (Ej. Francos Compensatorios)

Para días u horas a favor generados por esfuerzo extra (guardias, feriados trabajados). Funcionan como una cuenta continua que no se reinicia por el simple cambio de año.

- **Momento de reseteo:** Sin reinicio automático. Lo ganado en diciembre se traslada intacto a enero.
- **De dónde salen los días:** Externo informado o Externo calculado. El sistema no los genera por sí solo. Requieren que un operador los cargue manualmente (informado) o que ingresen automáticamente leyendo las fichadas del reloj (calculado).

**Tip de UX:** El modal debe usar **negritas en las etiquetas** (`Momento de reseteo`, `De dónde salen los días`) y viñetas para que RRHH escanee parámetros y lea el detalle solo si hace falta.

---

## 8. Implementación — referencias de código

| Pieza | Ruta | Estado |
|-------|------|--------|
| IDs y bolsas LAO | [`shared/utils/laoSaldosBolsa.js`](../../shared/utils/laoSaldosBolsa.js) | Implementado (Patrón A) |
| Check-in LAO | [`functions/onCall/solicitudes/persistirCheckinLaoBolsas.js`](../../functions/onCall/solicitudes/persistirCheckinLaoBolsas.js) | Implementado |
| Trigger descuento LAO | [`functions/triggers/solicitudArticuloLaoOnCreate.js`](../../functions/triggers/solicitudArticuloLaoOnCreate.js) | Implementado |
| Configurador UI | [`web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx`](../../web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx) | Campos `reinicio_ciclo_id`, `origen_saldo_id` |
| `resolvePatronSaldo` | `shared/utils/` o Functions | Pendiente |
| `sal_global_per_*` + Patrón C | Functions + shared | Pendiente |
| `obtenerResumenSaldosAgente` | Functions | Pendiente |
| `cfg_estado_bolsa_saldo` | Seed / configuración | Pendiente |
| Copy ayuda patrones | [`ayudaPatronesBolsaSaldo.js`](../../web/src/features/configuracion/articulos/ayudaPatronesBolsaSaldo.js) | Implementado (SSoT copy §7) |
| Modal ayuda patrones | [`AyudaPatronesBolsaModal.jsx`](../../web/src/features/configuracion/articulos/AyudaPatronesBolsaModal.jsx) + botón ℹ️ en [`ImpactoSaldoTabSections.jsx`](../../web/src/features/configuracion/articulos/ImpactoSaldoTabSections.jsx) | Implementado (D2); export `window.print()` |

---

## 9. Criterios de aceptación del RFC

1. Toda versión publicada de artículo con saldo puede clasificarse en A, B o C vía §1 sin ambigüedad (o queda `INVALIDO` con guardián).
2. LAO en versión exige `cfg_rcc_nunca` + `cfg_os_interno` + `es_lao_anual`.
3. Francos / compensatorios en versión usan `cfg_rcc_nunca` + origen externo; persistencia en `sal_global_per_*`.
4. Ningún flujo de producto hace hard delete de bolsas; estados `agotado` / `expirado` excluyen lecturas del panel sin borrar historia.
5. Cliente agente no lee `saldos_articulo_agente` directamente para «Mis saldos».
6. Copy de ayuda §7 visible desde configurador y alineado con este documento.
7. Ciclo de consumo, cierre y retroactivo RRHH conforme a §10 y matriz [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md).

---

## 10. Ciclo de consumo, transición y cierre de ciclos

### 10.1. El momento del descuento (hook transaccional)

El descuento o cómputo del saldo de un artículo (Patrones A, B y C) se ejecuta de forma estricta **al iniciar el trámite**. El evento desencadenante es la creación del documento en `solicitudes_articulo` (`onDocumentCreated`).

- El estado inicial (ej. `cfg_esa_borrador` o `cfg_esa_en_revision_jefe` según el flujo del formulario) representa el **compromiso** del saldo en el momento en que el usuario confirma Enviar/Iniciar (no en autosave intermedio).
- **Aprobación:** confirmación administrativa **idempotente**. No altera los balances numéricos ya modificados al iniciar.
- **Rechazo o anulación:** dispara un flujo de **reverso atómico** hacia la bolsa de origen (`anio_origen_bolsa` o `anio_ciclo_consumo`) basándose en los metadatos de trazabilidad inyectados en la solicitud (véase Caso 3 en [`CASOS_BORDE_SALDOS_V2.md`](./CASOS_BORDE_SALDOS_V2.md)).

**Referencia código (Patrón A hoy):** [`functions/triggers/solicitudArticuloLaoOnCreate.js`](../../functions/triggers/solicitudArticuloLaoOnCreate.js) — `onDocumentCreated` con validación de cupo y transición de estado.

### 10.2. Anclaje temporal y zona horaria

Para el cálculo de cupos y determinación de ciclos, el año contable se fija mediante el campo **`anio_ciclo_consumo`**, derivado estrictamente del **año calendario** de la propiedad `fecha_desde` de la solicitud, normalizada bajo la zona horaria **`America/Argentina/Buenos_Aires`**.

Validaciones al iniciar trámite (agente y backend): `año(fecha_desde) === año(fecha_hasta)` (Caso 1); `año(fecha_desde) === anio_ciclo_consumo`; bolsa Patrón B en `cfg_esb_activo` salvo flujo RRHH retroactivo (§10.4).

### 10.3. Mecanismo de expiración configurable (Patrón B)

Los artículos con topes cíclicos **no** se cierran de forma masiva en una fecha fija global (ej. 15 de enero para todos). Su caducidad se rige por la colección de configuración **`cfg_fechas_cierre_ciclo`**, indexada por el `reinicio_ciclo_id`:

| `reinicio_ciclo_id` | Parámetro típico |
|---------------------|------------------|
| `cfg_rcc_anual` | Fecha parametrizada (ej. 15 de enero del año $X+1$ respecto al ciclo $X$) |
| `cfg_rcc_mensual` | Día parametrizado del mes posterior (ej. día 5 del mes $M+1$) |
| `cfg_rcc_diario` | Regla documentada en la misma colección (ventana de gracia post-ciclo diario) |

Al ejecutarse el **cron job** de cierre en la fecha indicada, la bolsa muta a **`cfg_esb_expirado`**.

**Trámites en curso (Caso 6):** las solicitudes que quedaron en trámite (p. ej. `cfg_esa_en_revision_jefe`) al momento del corte completan su workflow normal contra el ciclo viejo. Si son rechazadas a posteriori, el reverso es absorbido por la bolsa ya expirada sin alterar el ciclo nuevo.

### 10.4. Tratamiento de solicitudes retroactivas por RRHH

Un agente base tiene bloqueado el inicio de trámites contra bolsas en estado **`cfg_esb_expirado`**. El rol RRHH puede saltear este bloqueo mediante un Callable parametrizado (`es_retroactivo: true`) bajo las siguientes condiciones:

1. Debe existir **remanente real** (`disponible > 0` o `consumido < cupo`) en la bolsa expirada.
2. Si el remanente es cero, RRHH **no** puede iniciar una solicitud normal retroactiva; debe ejecutar primero un **ajuste manual** de saldo (inyección de crédito vía `cfg_esa_ajuste_rrhh` — Caso 7), dejando el registro de auditoría legal antes de consumir.

La bolsa puede permanecer `expirada` para el agente mientras RRHH opera vía Callable dedicado (p. ej. `crearSolicitudRetroactivaRrhh`).

---

## 11. Registro de erratas documentales de la fase de diseño

| Documento / artefacto | Errata | Enmienda |
|------------------------|--------|----------|
| [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §8 (histórico) | Sugería que el cliente calculaba remanentes en base a versiones cacheadas | El cálculo es **100 % responsabilidad del servidor** a través del DTO del Callable agregador (`obtenerResumenSaldosAgente`, §4) |
| Minutas / §8 de este RFC (2026-05-16) | `ayudaPatronesBolsaSaldo.js` marcado como listo antes de existir el archivo | **Resuelto** — D2 implementado; copy en código y §7 de este RFC |

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-16 | Versión inicial V2.1 — patrones A/B/C, persistencia, estados, Callable vista, check-in universal, ayuda RRHH |
| 2026-05-16 | §10 ciclo consumo/cierre, §11 erratas; enlaces a CASOS_BORDE, GUIA_RRHH, MODULO_CALENDARIO_FERIADOS |
| 2026-05-16 | D2: `ayudaPatronesBolsaSaldo.js`, modal ayuda + PDF en configurador Impacto y Saldo |
