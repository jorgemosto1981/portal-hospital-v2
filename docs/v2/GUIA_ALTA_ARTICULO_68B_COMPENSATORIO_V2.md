# Guía de alta — Artículo **68-B** Compensatorio (Patrón C, horas)

**Audiencia:** RRHH / configurador de artículos.  
**Ruta:** `/portal/rrhh/configuracion-articulos`  
**Objetivo:** dejar publicada una versión que el portal clasifique como **Patrón C** (cuenta continua), con saldo en **horas**, cargable en **check-in de saldos** (pestaña C).

**Referencias:** [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) §1 · [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) · check-in [`GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md`](./GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md)

---

## 1. Verificación previa (patrón C)

El backend **no** tiene campo «Patrón C». Se deriva así:

| Campo en versión (Impacto y saldo) | Valor obligatorio 68-B |
|-----------------------------------|-------------------------|
| Momento de reseteo de la bolsa | **`cfg_rcc_nunca`** — El saldo no se resetea solo |
| ¿De dónde salen los días disponibles? | **`cfg_os_externo_informado`** — RRHH informa el saldo (check-in / planilla) |
| **Es LAO anual** (Identidad) | **`false`** — Si está activo, el sistema intentará Patrón A |

Con eso `resolvePatronSaldo` → **Patrón C**. Bolsa en Firestore: documento `sal_global_per_{persona}` / clave `bol_{articulo_id}_global`.

---

## 2. Crear artículo y versión

1. Entrar a **Configuración de artículos** → **Nuevo artículo** (o duplicar uno similar y renombrar).
2. Crear **versión** (borrador) y completar pestañas abajo.
3. Al terminar: **Publicar versión** (`cfg_est_ver_publicada`).
4. Anotar en esta tabla los IDs generados:

| Campo | Valor a completar tras guardar |
|-------|--------------------------------|
| `articulo_id` | `art_…` |
| `version_id` | `ver_…` |
| Código | `68-B` |
| Nombre | `COMPENSATORIO` (o texto oficial del hospital) |
| Inciso normativo | `Art 68 inc B` — Decreto 1919/89 (ajustar redacción institucional) |

---

## 3. Pestaña **Identidad y naturaleza**

| Campo | Valor recomendado 68-B |
|-------|-------------------------|
| Código | `68-B` |
| Nombre | Compensatorio (horas) |
| Inciso normativo | Art. 68 inc. B — Decreto 1919/89 |
| **Es LAO anual** | **No** (desmarcado) |
| Es licencia médica | No |
| Es sanción / inasistencia / sin goce | Según norma hospital (típico: todos **No** para permiso compensatorio) |
| Suma antigüedad LAO | **No** (no es LAO) |

---

## 4. Pestaña **Elegibilidad y filtros**

Definir con RRHH quién puede usar el artículo (misma semántica que 64-A: arrays vacíos = sin filtro en ese eje).

| Campo | Sugerencia inicial |
|-------|-------------------|
| Escalafón | Vacío = todos, o listar escalafones habilitados |
| Agrupamiento / vínculo / cargo / grupo / persona | Vacío salvo restricción explícita |
| Antigüedad mínima (meses) | `0` salvo norma |

Registrar aquí la decisión del hospital: _______________________________

---

## 5. Pestaña **Impacto y saldo** (crítica)

### 5.1 Cómputo y unidad de medida

| Campo | Valor 68-B |
|-------|------------|
| **[¡IMPORTANTE!] Unidad de medida del saldo** | **`cfg_uma_horas`** (Horas) |
| Ámbito de consumo | **`cfg_ac_anio_calendario`** (referencia para topes/consultas; la bolsa C es continua) |
| Depende de RDA | Según hospital (típico **No** hasta módulo Asistencia) |

Tras elegir **Horas**, completar el bloque **Configuración en horas**:

| Campo | Valor recomendado |
|-------|-------------------|
| Regla de cómputo de horas | **`cfg_rch_jornada`** (jornada teórica) o **`cfg_rch_reloj`** si la norma exige reloj |
| Módulo fraccionamiento (minutos) | `15` (redondeo habitual) |
| Unidad mínima de consumo | **`cfg_umc_horas`** o **`cfg_umc_minutos`** según política de solicitud |

### 5.2 Configuración de la bolsa (Patrón C)

Usar el botón **ℹ️** en la card *Configuración de la bolsa* para revisar la guía A/B/C.

| Campo | Valor 68-B |
|-------|------------|
| Momento de reseteo de la bolsa | **`cfg_rcc_nunca`** |
| ¿De dónde salen los días disponibles? | **`cfg_os_externo_informado`** |

**No** usar `cfg_os_interno` (eso es motor interno / LAO). **No** usar reseteo anual/mensual (eso es Patrón B).

### 5.3 Motor aritmético del saldo

| Campo | Valor típico compensatorio |
|-------|----------------------------|
| Acción sobre el saldo | **`cfg_as_resta`** — al **usar** horas compensatorias se descuentan de la bolsa |
| Multiplicador | `1` (solo si acción ≠ neutro) |

Si el artículo también sirve para **acreditar** horas (carga positiva), validar con normativa si hace falta otro artículo o acción **`cfg_as_suma`**; en la práctica muchas instituciones separan «franco compensatorio» (consumo) de «horas extra» (acreditación).

### 5.4 Campos que **no** aplican a Patrón C

- **Cupo días por ciclo**, **tope frecuencia mensual**, matriz LAO, **correspondencia_anio** (LAO): dejar vacíos / no completar.
- **Es LAO anual**: debe permanecer **desactivado**.

---

## 6. Pestaña **Acumulación y sucesión**

| Campo | Valor recomendado |
|-------|-------------------|
| Tipo de caducidad | **`cfg_cad_nunca`** (las horas no vencen al 31/12 salvo norma distinta) |
| Meses de arrastre | `0` |

---

## 7. Pestaña **Workflow / Avanzado**

| Campo | Valor recomendado |
|-------|-------------------|
| Roles habilitados para crear solicitud (`circuito_ingreso_ids`) | Mínimo **`CFG_USUARIO`** (agente). Agregar otros roles solo si deben iniciar por el agente |
| Permite retroactividad | Según norma |
| SLA / preaviso | Completar cuando el circuito de aprobación esté definido |

---

## 8. Publicar y validar en configurador

1. **Guardar** versión → revisar que en la grilla figure código **68-B** y versión publicada.
2. Abrir versión → pestaña Impacto: confirmar combinación **Nunca + Externo informado + Horas**.
3. (Opcional) En consola de desarrollo, al cargar meta del artículo en check-in, el badge de patrón debe decir **«C — cuenta continua»**.

---

## 9. Check-in de saldos (carga inicial)

1. `/portal/rrhh/checkin-saldos` → elegir agente piloto.
2. Año **A** → modo **Check-in nuevo** o **Rectificación** según corresponda.
3. Pestaña **Cuenta continua (C)** → localizar artículo **68-B**.
4. Informar **saldo en horas** (entero; vacío = 0; negativo solo si el legajo lo exige).
5. **Guardar** pestaña C (lote atómico si hay más artículos C).
6. Cierre global si es alta nueva completa.

Documento: [`GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md`](./GUIA_OPERATIVA_CHECKIN_SALDOS_RRHH.md)

---

## 10. Casos de prueba mínimos

| # | Prueba | Esperado |
|---|--------|----------|
| T1 | Versión publicada con tabla §1 | Patrón C en check-in |
| T2 | Check-in: 16 h en 68-B | Bolsa `sal_global_per_*` con `disponible` coherente |
| T3 | Solicitud futura (ticketera) | Descuenta horas si `cfg_as_resta` (cuando exista módulo) |
| T4 | `es_lao_anual` accidentalmente true | **No** debe aparecer en pestaña LAO (A) |

---

## 11. Registro post-alta (sesión 2026-05-18)

| Campo | Valor |
|-------|--------|
| Fecha alta | 2026-05-18 |
| `articulo_id` | `art_01KRYEF39ZM0KB0F0Y4GPBH38F` |
| `version_id` | `ver_01KRYEFZRQF0RKHJ5JTK6244G8` |
| Código / nombre | `68-B` — COMPENSATORIO - Art 68 Inc B |
| Validación técnica | Patrón **C**, `cfg_uma_horas`, publicada — script `scripts/inspect-articulo-version-checkin.mjs` |
| Observaciones RRHH | `cfg_as_resta`, `cfg_rch_jornada` |

---

## Decisiones pendientes de norma (RRHH)

- [ ] ¿Solo Administración 2695, o también Profesional 9282?
- [ ] ¿Regla horas jornada vs reloj?
- [ ] ¿Fraccionamiento mínimo en solicitud (horas vs minutos)?
- [ ] ¿Acreditación de horas extra en el mismo artículo o artículo aparte?
