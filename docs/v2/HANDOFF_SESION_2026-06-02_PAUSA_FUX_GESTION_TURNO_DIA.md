# Handoff — Pausa F-UX Gestión turno del día (A/B/C)

**Fecha pausa:** 2026-06-02  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**Estado:** propuesta de producto/UI **acordada y registrada** — **sin implementar aún**  
**Retomar:** cerrar decisiones §10 → refinar spec si hace falta → **recién entonces** codificar  

**Relación:** F4 outbox [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) · segmentos [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) · pendientes [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

---

## 1. Contexto de la sesión (qué pasó antes de esta pausa)

- F3 cerrada (`v2.3.0-f3-turnos-compuestos`) · F4 outbox parcial en código (batch + UI grilla).
- Usuario probó modales **Cobertura parcial** y **Cambio de turno** en grilla (ej. LOKITO 2026-06-15, Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`).
- Problemas observados en UI actual:
  - «Sin segmentos materializados» — día sin capa teórica materializada.
  - Error crudo **«internal»** al fallar carga de capa (`obtenerCapaTeoricaDia`).
  - Tramos como checkboxes poco claros; usuario pide **select**.
  - Buscador agente YY sin resultados visibles cuando falla la carga o lista vacía.
  - Select compensación sin opciones visibles / mal UX móvil.
  - **Cambio de turno:** toggle reemplazo/adicional confuso; turno texto libre en lugar de select del régimen.
- Conclusión del equipo (usuario): **hay que replantear** — no parchear la UI actual sin acuerdo de producto.

---

## 2. Términos acordados (texto literal — usar en UI y ayuda)

### Cobertura parcial = INTERCAMBIO DE GUARDIA ENTRE DOS AGENTES

Un agente cede uno o más turnos a otro agente que los ejecuta. **Ambos agentes intervienen.**

- Tipo backend: `cobertura_parcial`
- Nombre UI propuesto: **Intercambio de guardia**

### Reemplazo = CAMBIO DE TURNO PROPIO

Un agente cumplirá un turno distinto al teórico del turno. **Solo para corrimientos en turnos dentro del mismo día.**

- Tipo backend: `reemplazo`
- Nombre UI propuesto: **Cambio de turno propio**

### Adicional = HORAS ADICIONALES

Un agente cumplirá más horas de las asignadas en su turno y éstas deben ser reconocidas como **extras**.

- Tipo backend: `adicional`
- Nombre UI propuesto: **Horas adicionales**

### Aclaración explícita (no confundir)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Reemplazo es lo inverso de cobertura parcial? | **No.** Cobertura = dos agentes + ceder tramos. Reemplazo = un agente + otro turno mismo día. |
| ¿Adicional es lo mismo que reemplazo? | **No.** Reemplazo **sustituye** el turno teórico. Adicional **suma** horas extra sobre lo asignado. |

---

## 3. Replanteo propuesto — Gestión turno del día (sin codificar)

### 3.1 Punto de entrada único

Desde el detalle del día en grilla (GSO con escritura):

**Botón:** «Gestionar turno de este día»

**Paso 1 — obligatorio** (sin formulario largo debajo):

> **¿Qué necesitás registrar?**

| Opción | Título corto | Subtítulo (1 línea) |
|--------|--------------|---------------------|
| **A** | **Intercambio de guardia** | Otro agente cubre parte de mi turno → flujo cobertura (**2 personas**). Un agente cede uno o más turnos a otro que los ejecuta. Ambos intervienen. |
| **B** | **Cambio de turno propio** | Cumplirá un turno distinto al teórico del turno. **Solo corrimientos en turnos dentro del mismo día** → flujo ajuste (**1 persona**). |
| **C** | **Horas adicionales** | Cumplirá más horas de las asignadas en su turno; deben reconocerse como **extras** → flujo adicional (**1 persona**). |

- Una sola opción activa → **Continuar**.
- **Cancelar** cierra sin tocar outbox.
- Ayuda `(?)` por opción con las definiciones del §2.

**Lo que desaparece en la UI nueva:** dos botones sueltos («Cobertura parcial» / «Cambio de turno») y el toggle reemplazo/adicional en la misma pantalla.

---

### 3.2 Precondición común (antes de cualquier formulario)

**Regla:** el día del agente titular debe tener **turno teórico materializado** (`capa_teorica` + `segmentos[]` o equivalente unificado).

| Estado | Qué ve el usuario |
|--------|-------------------|
| Sin materializar | Pantalla bloqueante: *«Este día aún no tiene turno calculado.»* + **Materializar este día** (acción explícita) + enlace a plan/régimen si falla |
| Materializado | Entra al flujo A, B o C |
| Período cerrado / GSO solo lectura | Mensaje claro; sin formulario |
| Error de carga | Mensaje humano (**nunca** `internal`): qué revisar (plan habilitado, materialización, cargo `gdt`) |

**Cabecera fija en todos los flujos:** agente, fecha, **nombre del cargo** (no solo `gdt_*`), turno teórico resumido (ej. «M+T 06–22 · F:2»).

---

### 3.3 Flujo A — Intercambio de guardia (2 agentes)

**Modelo de negocio:** XX cede tramo(s); YY los ejecuta. Ambos en la liquidación del día.

| Paso | Campo | Control propuesto | Reglas |
|------|--------|-------------------|--------|
| A1 | Turnos que cedo | **Select múltiple** (o select + chips) con labels del régimen: «Mañana 06–14», «Tarde 14–22», no ids crudos | ≥1 turno; solo segmentos **activos** del titular ese día |
| A2 | Agente que ejecuta (YY) | **Select con búsqueda** (combobox): nombre + DNI; lista del mismo `gdt` | ≠ titular; avisos si YY ya tiene turno/franco ese día (no bloqueante, sí visible) |
| A3 | Tipo de compensación del intercambio | **Select** obligatorio (`cfg_tcc_*`) | Placeholder «Elegí compensación…»; opciones con `titulo_ui` |
| A4 | Motivo | Textarea obligatorio (mín. 3) | Operativo |

**Acción:** «Agregar a cambios» → outbox (`cobertura_parcial`).

**Post-aplicación:** rematerializa **XX y YY** ese día en el cargo.

**No confundir con B:** acá **siempre hay segundo agente** y **cedés parte** (uno o más turnos), no reemplazás todo el día solo para vos.

---

### 3.4 Flujo B — Cambio de turno propio (1 agente, mismo día)

**Modelo de negocio:** el agente **no** cumple el teórico del plan ese día; cumple **otro turno del mismo día** (corrimiento M→T, M→N, etc.). **No** es intercambio (no hay YY).

| Paso | Campo | Control propuesto | Reglas |
|------|--------|-------------------|--------|
| B1 | Turno teórico actual | Solo lectura | Desde capa materializada |
| B2 | Turno que voy a cumplir | **Select obligatorio** — paleta del régimen/cargo (M, T, N, M+T, Franco si aplica…) | Debe ser **distinto** al teórico; misma fecha |
| B3 | Horario (opcional avanzado) | Colapsado «Ajuste fino»: ingreso/egreso solo si el turno elegido lo permite editar | Por defecto se completan desde catálogo del turno |
| B4 | Motivo | Textarea obligatorio | Ej. «Corrimiento por reunión», «Permuta interna mismo día» |

**Acción:** «Agregar a cambios» → outbox (`reemplazo`).

**Validaciones producto a definir con RRHH (§10):**
- ¿Franco → laborable entra acá o por solicitud/licencia?
- ¿Cambio de **todo** el día (ej. teórico M+T → solo T) = un reemplazo con turno compuesto en select o varios segmentos? → recomendación: **un select de turno destino** alineado a ids del régimen (`M+T`, no texto libre).

**No confundir con A:** un solo agente, sin «agente que ejecuta».

---

### 3.5 Flujo C — Horas adicionales (1 agente)

**Modelo de negocio:** el agente mantiene (o amplía) su jornada con **horas extra reconocidas**, no un «otro turno» en sentido de corrimiento.

| Paso | Campo | Control propuesto | Reglas |
|------|--------|-------------------|--------|
| C1 | Turno / jornada base | Solo lectura | Teórico + hs asignadas |
| C2 | Horas adicionales | **Numérico** (step 0.5) **o** bloques del régimen («+4 hs», «doble guardia») según catálogo | >0; tope configurable (ej. 24 hs total día) |
| C3 | Detalle horario extra (opcional) | Ingreso/egreso del tramo extra si RRHH lo exige | Si no se completa, derivar de hs adicionales + fin del turno base |
| C4 | Motivo | Textarea obligatorio | Ej. «Guardia de refuerzo», «Extensión por demanda» |

**Acción:** «Agregar a cambios» → outbox (`adicional`).

**Diferencia clave vs B:**

| | B — Cambio propio | C — Horas adicionales |
|--|-------------------|------------------------|
| Intención | **Sustituir** qué turno cumplo | **Sumar** sobre lo asignado |
| Turno teórico | Queda **reemplazado** en capa | Base se mantiene; se **añade** carga extra |
| Segundo agente | No | No |

---

### 3.6 Outbox y cierre (contrato F4 — sin cambiar backend en esta fase UX)

1. Cualquier flujo → **«Agregar a cambios»** (borrador local + banner «Cambios pendientes: N»).
2. **«Aplicar cambios»** envía batch (`cobertura_parcial` / `reemplazo` / `adicional`).
3. Toasts: éxito, período cerrado, grilla desactualizada (reintentar).
4. Recuperación borrador 24 h (ya existente en `useAsistenciaOutbox`).

**Mejora UX pendiente:** en el banner, listar pendientes con **tipo legible** (Intercambio / Cambio propio / Horas adicionales), agente, fecha.

---

### 3.7 Matriz de decisión (ayuda in-app)

```
¿Interviene otro agente que ejecuta turnos que yo cedo?
  SÍ → A Intercambio de guardia
  NO → ¿Reemplazo mi turno del día por otro del mismo día?
         SÍ → B Cambio de turno propio
         NO → ¿Sumo horas extra sobre mi turno asignado?
                SÍ → C Horas adicionales
```

---

### 3.8 Cambios respecto a la UI actual (motivo del replanteo)

| UI actual | UI propuesta |
|-----------|----------------|
| Dos botones sueltos en modal día | Un wizard A/B/C |
| Reemplazo y adicional como toggle | **Flujos B y C separados** |
| Tramos checkbox | **Select múltiple** con labels régimen |
| Turno texto libre `M/T/N` | **Select** paleta régimen |
| Buscador YY + lista oculta / vacía sin mensaje | **Combobox** + estados vacíos explícitos |
| Select compensación sin feedback | Select con placeholder + altura táctil 44px |
| Sin materializar → formulario roto | **Gate + CTA materializar** |
| Error `internal` | Mensajes operativos |

---

## 4. Decisiones abiertas (cerrar mañana ANTES de codificar)

1. **B:** ¿Franco y «no laborable → laborable» entran en cambio propio o van por otro módulo (solicitudes/licencias)?
2. **C:** ¿Horas adicionales se expresan solo como **número de hs** o también como **turno/bloque** del catálogo (ej. «+ guardia N»)?
3. **A:** ¿Compensación del intercambio siempre obligatoria o hay valor por defecto «cambio interno»?
4. **Materializar:** ¿botón manual en modal o materialización automática con confirmación al abrir?

---

## 5. Entregables de implementación (orden sugerido — NO iniciar hasta OK §4)

| # | Entregable | Archivos afectados (referencia) |
|---|------------|----------------------------------|
| 1 | Wizard paso 1 (A/B/C) | `DiaGrillaDetalleModal.jsx` o modal dedicado |
| 2 | Flujo A — Intercambio de guardia | Refactor `ModalCoberturaParcial.jsx` |
| 3 | Flujo B — Cambio turno propio | Refactor `ModalCambioTurno.jsx` (solo reemplazo) |
| 4 | Flujo C — Horas adicionales | Nuevo modal o rama dedicada |
| 5 | Copy ayuda | `web/src/constants/helpContent.js` |
| 6 | Errores legibles carga capa | `obtenerCapaTeoricaDia` + catch en modales |
| 7 | Banner outbox con labels A/B/C | `GrillaMesLicenciasPanel.jsx` |
| 8 | QA manual | LOKITO 2026-06-15 Sala materializado + tres flujos outbox |

**Backend F4 ya parcial en rama:** `aplicarBatchAsistencia` soporta los tres tipos · tests `npm run test:batch-asistencia-normalize`.

---

## 6. Código existente (no reimplementar lógica batch)

| Pieza | Ubicación |
|-------|-----------|
| Outbox | `web/src/features/grilla/useAsistenciaOutbox.js` |
| Batch apply UI | `GrillaMesLicenciasPanel.jsx` |
| Batch backend | `functions/modules/asistencia/cambiosTurno.js` → `aplicarBatchAsistencia` |
| RFC F4 | `docs/v2/RFC_CACHE_LOCAL_ASISTENCIA_V2.md` |

---

## 7. Cómo retomar mañana

1. Leer este handoff + §4 decisiones.
2. Resolver §4 con usuario/RRHH (aunque sea «default operativo»).
3. Si hace falta, ajustar §3 en este mismo doc (sin código).
4. **Confirmación explícita** → recién entonces implementar §5 en orden 1→8.
5. PR merge épica y `gh auth login` siguen pendientes en paralelo (no bloquean F-UX).

---

**Registrado:** 2026-06-02 · pausa antes de implementación F-UX gestión turno del día.

---

## 8. Cierre de sesión 2026-06-02

| Ítem | Estado |
|------|--------|
| Propuesta A/B/C registrada | ✅ Este documento |
| Código F4 batch (reemplazo/adicional) | ✅ En rama · **deploy functions pendiente** |
| UI wizard A/B/C | ⏸️ No implementar hasta §4 |
| Commit + push rama | ✅ Al cierre sesión |
| PR → master | ⏸️ `gh auth login` + merge manual |
| Deploy prod F4 | ⏸️ Tras implementar F-UX.3 o hotfix batch si RRHH lo pide |

**Próxima sesión:** §7 — decisiones §4 → implementación F-UX.3 (UX-8…10).
