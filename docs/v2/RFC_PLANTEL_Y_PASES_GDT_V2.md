# RFC — Plantel por GDT y Pases de personal (V2)

**Estado:** aceptado · contrato de implementación  
**Fecha:** 2026-07-24  
**Entorno de desarrollo:** `develop` + Firebase `portal-hospital-v2-dev`  
**Prod Etapa 1:** no desplegar hasta UAT −dev verde  
**Referencias:** [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) · V1 `ArbolJerarquicoView.jsx` / `SolicitudTransferencia.jsx`

---

## 0. Resumen ejecutivo

Portar a V2 dos capacidades de V1 (**Estructura Organizativa** + **Transferencia de Personal**) respetando la regla de oro V2:

> **Un cambio de GDT no actualiza `grupo_de_trabajo_id` en un HLg vigente.**  
> Se **cierra** el HLg actual (`fecha_fin`) y se **abre** un HLg nuevo (`fecha_inicio`, resto heredado).

| Módulo | Nombre | Naturaleza | Prioridad |
|--------|--------|------------|-----------|
| **A** | Plantel / Estructura por GDT | Solo lectura | **Fase 1** (ahora) |
| **B** | Solicitud / ejecución de pase GDT | Escritura + TC | **Fase 2** (después de A) |

Fuera de ticketera de ausentismos/licencias: átomo laboral independiente.

---

## 1. Origen V1 (contexto)

| Capacidad V1 | Ubicación | Comportamiento |
|--------------|-----------|----------------|
| Estructura Organizativa | `ArbolJerarquicoView.jsx` · menú `estructura-organizativa` | Árbol GDT + integrantes (nombre, DNI, nivel) |
| Transferencia de Personal | `SolicitudTransferencia.jsx` · menú `transferencia-personal` | Interno = cambio directo; externo = solicitud RRHH |
| Persistencia V1 | Cliente → `historial_pases` + update `usuarios.grupos_servicios_trabajo` | Sin Cloud Functions; modelo embebido (no HLc/HLg) |

---

## 2. Modelo laboral V2 (SSoT)

Colecciones relevantes:

| Capa | Colección / id | Rol en el pase |
|------|----------------|----------------|
| Organigrama | `grupos_de_trabajo` (`gdt_*`) | Destino / origen; `parent_group_id`, `activo` |
| Persona | `personas` (`per_*`) | Apellido, nombre, DNI |
| Cargo | `historial_laboral_cargos` (`hlc_*`) | Marco del acto; no se “pisa” el GDT aquí |
| Datos del cargo | `historial_laboral_datos` (`hld_*`) | **Función real** (`funcion_real_id`), detalle técnico |
| Asignación a grupo | `historial_laboral_grupos` (`hlg_*`) | **Grupo, nivel, régimen, ancla, vigencias** |

### 2.1 Campos HLg que participan del pase

Al **cerrar** HLg vigente: solo setear `fecha_fin` (efectiva del traslado; convenio de día a definir en implementación: fin del día anterior vs instante).

Al **abrir** HLg nuevo (clon + overrides):

| Campo | Herencia por defecto |
|-------|----------------------|
| `grupo_de_trabajo_id` | **Nuevo** (destino) |
| `fecha_inicio` | Fecha efectiva del pase |
| `fecha_fin` | `null` |
| `dato_laboral_id` | **Mismo** `hld_*` (mantiene función real y resto HLd) |
| `cargo_id` / vínculo HLc | Mismo que el HLg cerrado (salvo regla distinta futura) |
| `nivel_jerarquico` | Clonado (RRHH puede editar en aprobación externa) |
| `regimen_horario_id` | Clonado (idem editable) |
| `regimen_fecha_ancla` | Clonado si régimen rotativo (idem) |

**Matiz:** `funcion_real_id` vive en **HLd**, no en HLg. El pase típico **no crea un HLd nuevo**: reutiliza `dato_laboral_id`. Si negocio exige cambiar función real, es extensión del modal RRHH (fuera del MVP mínimo del pase).

---

## 3. Módulo A — Plantel / Estructura por GDT (lectura)

### 3.1 Objetivo

Visualizar dotación por GDT **sin** exponer al cliente la colección completa de personas/usuarios.

### 3.2 Rutas y menú

| Rol | Ruta | Alcance del árbol |
|-----|------|-------------------|
| RRHH | `/portal/rrhh/plantel` | Todos los `gdt_*` **activos** (árbol completo) |
| Jefe | `/portal/jefe/plantel` | Solo su GDT + sub-GDT (`parent_group_id` descendientes) |

Menú: RRHH bajo funciones/estructura; Jefe bajo “Cosas del jefe” (o equivalente vigente).

### 3.3 UX

- **Split view:** izquierda árbol/lista GDT activos; derecha tabla del GDT seleccionado.
- **Columnas:** Apellido, Nombre, DNI, Nivel jerárquico (`hlg.nivel_jerarquico`), Vigencia (`fecha_inicio` del HLg vigente; opcional mostrar `hlg_id` en tooltip/debug).

### 3.4 Callable — `obtenerPlantelPorGdt`

**Input (propuesto):**

```json
{
  "gdt_id": "gdt_…",
  "a_fecha": "YYYY-MM-DD"
}
```

`a_fecha` opcional; default = hoy (AR).

**Autorización:**

1. Auth obligatoria.
2. Si actor es RRHH (`CFG_RRHH` / roles HLc vigentes equivalentes) → OK.
3. Si actor es jefe → el `gdt_id` debe estar en su **jurisdicción** (GDT donde tiene HLg vigente con nivel superior relativo, o subárbol bajo sus GDT “de mando”; detalle de algoritmo en implementación, alineado a `laborProfile` / burbujeo existente).
4. Otro → `permission-denied`.

**Lógica server:**

1. Validar `gdt_*` existe y `activo === true` (o permitir inactivos solo RRHH — decisión: **MVP solo activos**).
2. Query `historial_laboral_grupos` donde `grupo_de_trabajo_id == gdt_id` y vigente a `a_fecha` (`fecha_inicio ≤ a_fecha` y (`fecha_fin` null o `> a_fecha`)).
3. Join `personas` por `persona_id`.
4. Devolver array limpio ordenado por `nivel_jerarquico` ASC (o DESC — alinear a V1: mayor nivel primero).

**Output (fila):**

```json
{
  "persona_id": "per_…",
  "hlg_id": "hlg_…",
  "apellido": "…",
  "nombre": "…",
  "dni": "…",
  "nivel_jerarquico": 10,
  "fecha_inicio": "YYYY-MM-DD",
  "regimen_horario_id": "cfg_…",
  "dato_laboral_id": "hld_…"
}
```

**Callable auxiliar sugerido (Fase 1b):** `listarArbolGdtPlantel` — devuelve nodos GDT visibles según rol (evita filtrar árbol solo en cliente).

---

## 4. Módulo B — Pases de GDT (escritura)

### 4.1 Colección `sol_pases_gdt`

Documento id sugerido: `spg_<ULID>` (o prefijo acordado en constants).

```json
{
  "agente_persona_id": "per_…",
  "hlg_origen_id": "hlg_…",
  "gdt_origen_id": "gdt_A",
  "gdt_destino_id": "gdt_B_o_null",
  "solicitante_persona_id": "per_jefe…",
  "tipo_pase": "INTERNO" | "EXTERNO",
  "estado": "APROBADO_INTERNO" | "PENDIENTE_RRHH" | "APROBADO" | "RECHAZADO",
  "motivo": "…",
  "fecha_efectiva": "YYYY-MM-DD",
  "hlg_destino_id": null,
  "overrides_hlg": {
    "nivel_jerarquico": null,
    "regimen_horario_id": null,
    "regimen_fecha_ancla": null
  },
  "requiere_conocimiento_rrhh": true,
  "rrhh_toma_conocimiento_en": null,
  "rrhh_toma_conocimiento_por": null,
  "jefes_pendientes_conocimiento_ids": ["per_…"],
  "jefes_acuses": {},
  "creado_en": "Timestamp",
  "actualizado_en": "Timestamp"
}
```

### 4.2 Flujo interno (jurisdicción del jefe)

1. UI: subordinado + GDT destino **solo** de su rama + fecha + motivo.
2. Callable `ejecutarPaseInternoGdt`.
3. Server (transacción / batch atómico):
   - Valida subordinación y destino en jurisdicción.
   - Cierra HLg origen (`fecha_fin`).
   - Crea HLg destino (herencia §2.1).
   - Persiste `sol_pases_gdt` con `estado: APROBADO_INTERNO`, `tipo_pase: INTERNO`.
   - Calcula jefes superiores (subir `parent_group_id` desde origen/destino según regla) → `jefes_pendientes_conocimiento_ids`.
   - `requiere_conocimiento_rrhh: true`.
4. **No bloquea** por acuses: el pase ya está ejecutado.

### 4.3 Flujo externo (jefe no ve GDT fuera de rama)

**UI jefe — selector destino:**

1. Lista de sub-GDT de su jurisdicción (pases internos).
2. Opción fija: **"Traslado a otro Servicio / GDT (A gestionar por RRHH)"**.
3. Al elegirla: campo texto obligatorio *motivo y destino sugerido* (libre); **no** selector de catálogo completo.

**Callable `solicitarPaseExternoGdt`:**

- Crea `sol_pases_gdt` con `gdt_destino_id: null`, `estado: PENDIENTE_RRHH`, `tipo_pase: EXTERNO`.
- **No** cierra ni abre HLg todavía.

**Bandeja RRHH — Pases pendientes:**

- RRHH lee motivo, elige `gdt_destino_id` del árbol completo, ve resumen de herencia HLg y puede editar overrides.
- Callable `aprobarPaseGdt` / `rechazarPaseGdt`:
  - Aprobar: cierra HLg + alta HLg + `estado: APROBADO` + `hlg_destino_id`.
  - Rechazar: `estado: RECHAZADO` sin tocar HLg.

### 4.4 Toma de conocimiento (pases internos y, opcional, informativos)

| Actor | Dónde | Acción |
|-------|--------|--------|
| RRHH | Pestaña/filtro **Pases informados (pendientes de acuse)** | Botón **Tomar conocimiento** → estampa `rrhh_toma_conocimiento_*` |
| Jefe superior | Bandeja informativa (sin Aprobar/Rechazar) | **Tomar conocimiento** → mueve su id a `jefes_acuses` y sale de pendientes |

Callables sugeridos: `tomarConocimientoPaseGdtRrhh`, `tomarConocimientoPaseGdtJefe`.

Patrón alineado a TC ya usado en Etapa 1 (autorizaciones / acuses), sin bloquear la ejecución del pase interno.

---

## 5. Callables — inventario

| Callable | Módulo | Fase |
|----------|--------|------|
| `obtenerPlantelPorGdt` | A | 1 |
| `listarArbolGdtPlantel` | A | 1b (recomendado) |
| `ejecutarPaseInternoGdt` | B | 2 |
| `solicitarPaseExternoGdt` | B | 2 |
| `aprobarPaseGdt` | B | 2 |
| `rechazarPaseGdt` | B | 2 |
| `tomarConocimientoPaseGdtRrhh` | B | 2 |
| `tomarConocimientoPaseGdtJefe` | B | 2 |

---

## 6. Roadmap e integración Etapa 1

1. **Hoy:** este RFC en `develop` (contrato).
2. **Fase 1 (−dev):** Módulo A — callables lectura + UI plantel RRHH/Jefe. Cero riesgo de liquidación.
3. **Fase 2 (−dev):** Módulo B — motor de pases + TC + bandejas.
4. **Prod:** solo tras UAT −dev y política de deploy Etapa 1.

No mezclar con Soft Launch UAT de solicitudes 64/CAMBIO-DIA salvo que RRHH pida plantel como herramienta ops en paralelo (solo lectura).

---

## 7. Fuera de alcance (MVP)

- Cambiar `funcion_real_id` / crear HLd nuevo en el mismo acto (salvo extensión explícita del modal RRHH).
- Multi-HLg simultáneos del mismo agente en dos GDT “principales” sin regla de negocio adicional.
- Port 1:1 de `historial_pases` V1 (estados PROVISORIO/CONFIRMADO legacy).
- Notificaciones email/push (MVP: bandejas in-app).
- Escritura cliente a HLg (todo pase vía Callable).

---

## 8. Criterios de aceptación (alto nivel)

### Módulo A

- [ ] RRHH ve árbol completo de GDT activos y plantel con apellido, nombre, DNI, nivel, vigencia.
- [ ] Jefe no ve GDT fuera de su rama.
- [ ] Callable deniega GDT fuera de jurisdicción.
- [ ] Cliente no descarga dump de `personas`.

### Módulo B

- [ ] Pase interno: HLg origen con `fecha_fin`; HLg nuevo vigente; `sol_pases_gdt` `APROBADO_INTERNO`; TC pendientes RRHH + jefes superiores.
- [ ] Pase externo: jefe no elige GDT externo; RRHH asigna destino y ejecuta cierre+alta.
- [ ] Rechazo externo no muta HLg.
- [ ] Overrides de régimen/nivel en aprobación RRHH se reflejan en el HLg nuevo.
- [ ] Acuses no revierten el pase ya ejecutado.

---

## 9. Frase de continuación

> Retomar desde `docs/v2/RFC_PLANTEL_Y_PASES_GDT_V2.md`: Fase 1 — implementar `obtenerPlantelPorGdt` (+ `listarArbolGdtPlantel`) en `functions/` y UI `/portal/rrhh/plantel` · `/portal/jefe/plantel` sobre `portal-hospital-v2-dev`.
