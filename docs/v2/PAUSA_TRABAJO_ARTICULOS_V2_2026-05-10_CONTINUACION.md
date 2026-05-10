# Pausa de trabajo — Continuación Módulo Artículos V2 (10-05-2026)

**Fecha/hora de corte:** 10 de mayo de 2026, cierre de implementación en esta sesión.  
**Objetivo de esta continuación:** completar UX funcional de pestañas General/Elegibilidad/Plazos/Workflow, habilitar catálogos faltantes de Workflow y dejar seeds exclusivos por bloque.

---

## 1) Estado alcanzado (funcional)

### 1.1 Navegación de Artículos (RRHH)

- Se incorporó pantalla de lista en `/portal/rrhh/configuracion-articulos`:
  - listado de documentos `cfg_articulos`
  - acción `Editar` por fila
  - acceso a `Nuevo artículo`
- Se separaron rutas:
  - `/portal/rrhh/configuracion-articulos` → lista
  - `/portal/rrhh/configuracion-articulos/nuevo` → alta
  - `/portal/rrhh/configuracion-articulos/:articuloId` → edición

### 1.2 Formulario de Artículo

- **Publicar** ahora persiste `activo: true` en raíz del documento.
- **Duplicar** navega a `/nuevo` y mantiene lógica de duplicación limpia.

---

## 2) Pestañas: avance real

### 2.1 General

- Ayuda contextual dinámica para:
  - `norma_principal_tipo_id`
  - `tipo_articulo_id`
  - `unidad_medida_id`
- Bloque **Resumen final de impacto (General)** con:
  - normativa + referencia/inciso
  - clasificación
  - vigencia

### 2.2 Elegibilidad

- UI con filtros por ejes (`filtros_elegibilidad`) funcional.
- Lenguaje unificado (sin ambigüedad):
  - seleccionado = **sí puede solicitar**
  - no seleccionado = **no puede solicitar**
  - box vacío = **no filtra** (pasan todos en ese eje)
- Bloque **Resumen final de impacto (Elegibilidad)** con:
  - filtros activos por eje
  - regla final AND entre boxes que filtran

### 2.3 Plazos

- Campos operativos implementados:
  - `documentacion_diferida_habilitada`
  - `momento_entrega_documentacion_id`
  - `plazo_documental_tipo_dias_id`
  - `plazo_documental_post_inicio_dias`
  - `accion_vencimiento_documental_id`
- Ayuda contextual dinámica + **Resumen final de impacto (Plazos)**.

### 2.4 Workflow

- Campos operativos implementados:
  - origen/autorización
  - split/remanente
  - conflictos/superposición/prioridad
  - impacto operativo (reemplazo/contrataciones)
- Patrón UX acordado:
  - “tilde habilita” y “select configura”
  - dependencias sombreadas: persistidas pero ignoradas cuando no aplican
- Regla de default aplicada:
  - al habilitar parcial/decisión RRHH sin regla de split definida → `CFG_RSR_DERIVAR_RRHH`
- Ayuda contextual por opción y **Resumen final de impacto (Workflow)**.

---

## 3) Catálogos y seeds

### 3.1 Plazos (seed exclusivo)

- Script: `scripts/seed-v2/seed-articulos-plazos-catalogos.mjs`
- Colecciones:
  - `cfg_momento_entrega_documentacion`
  - `cfg_tipo_computo_plazo`
  - `cfg_accion_vencimiento`
- Datos compartidos en:
  - `scripts/seed-v2/plazosArticulosCatalogos.data.mjs`

### 3.2 Workflow (seed exclusivo)

- Script: `scripts/seed-v2/seed-articulos-workflow-catalogos.mjs`
- Colecciones:
  - `cfg_origen_alta_solicitud`
  - `cfg_regla_split_remanente`
  - `cfg_prioridad_normativa`
  - `cfg_politica_superposicion`
- Datos compartidos en:
  - `scripts/seed-v2/workflowArticulosCatalogos.data.mjs`

### 3.3 NPM scripts agregados

- `seed:articulos-plazos-catalogos`
- `seed:articulos-workflow-catalogos`

---

## 4) Backend / allowlist / despliegues

- `CFG_COLECCIONES_RRHH` ampliada para colecciones nuevas de Plazos y Workflow.
- Se ejecutaron despliegues de Functions para actualizar `listarColeccion`/`guardarOpcion`.

---

## 5) Verificaciones de sesión

- Lints en archivos modificados: sin errores.
- Tests utilitarios de artículo (`vitest` sobre `articuloForm.test.js`): OK.
- Seeds exclusivos ejecutados con éxito (entorno V2).

---

## 6) Pendientes al pausar

1. **DocumentaciónTab**: sigue como stub (falta simulador visual completo de vencimiento documental en UI).
2. **Lista avanzada de artículos**: faltan filtros de búsqueda/estado y orden configurable.
3. **Acople runtime de elegibilidad/workflow** en motor de solicitud (esta sesión cerró configuración y persistencia).
4. **Eventual colección dedicada** para tipo de norma principal (hoy provisoria con `cfg_tipo_acto_designacion`).

---

## 7) Estado de pausa

Implementación **pausada** en este punto por solicitud del usuario, con cambios registrados y guardados.
