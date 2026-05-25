# Campos obligatorios ABM — V2 (estricto)

Fecha: 2026-04-28

## Objetivo

Definir el contrato de campos **obligatorios estrictos** para ABM de datos personales y laborales en V2.  
Este contrato aplica a validaciones de frontend y backend (Cloud Functions).

---

## 1) Datos personales

### 1.1 Colección `personas` (obligatorios)

- `dni`
- `nombre`
- `apellido`
- `fecha_nacimiento`
- `lugar_nacimiento_id`
- `activo`
- `sexo_genero_id`
- `estado_civil_id`
- `nacionalidad_id`
- `contacto.telefono_celular`
- `contacto.email_personal`
- `domicilio.calle`
- `domicilio.numero`
- `domicilio.provincia_id`
- `domicilio.pais_id`
- `domicilio.localidad_id`
- `domicilio.codigo_postal`

Reglas adicionales:
- Si `activo=false`, `motivo_baja_id` es obligatorio.
- `dni` debe cumplir formato numérico válido según validación activa.

### 1.2 Colección `formacion_agente` (obligatorios)

- `persona_id`
- `nivel_estudios_id`

### 1.3 Colección `declaraciones_grupo_familiar` (obligatorios)

Del documento:
- `titular_persona_id`

Por cada familiar cargado en `familiares[]`:
- `parentesco_id`
- `dni`
- `nombre`
- `apellido`
- `fecha_nacimiento`

Reglas adicionales:
- Debe existir al menos un familiar válido.

---

## 2) Datos laborales

### 2.1 Colección `historial_laboral_cargos` (HLc) — obligatorios

- `persona_id`
- `efector_designacion_id`
- `efector_cumplimiento_id`
- `estado_asignacion_id`
- `escalafon_id`
- `agrupamiento_id`
- `tipo_vinculo_id`
- `categoria_id`
- `rol_id`
- `cargo_funcional_id`
- `modalidad_jornada_id`
- `carga_horaria_total`
- `fecha_desde`

Referencias normativas (al menos una):
- `referencias_normativa_designacion[].tipo_acto_id`
- `referencias_normativa_designacion[].numero`
- `referencias_normativa_designacion[].fecha`

Reglas adicionales:
- Si hay `fecha_hasta`, `causal_fin_asignacion_id` es obligatoria.

### 2.2 Flujo de asignación por grupo (HLd + HLg) — obligatorios

> Nota de modelo: en V2, HLG no guarda `cargo_id` directo; se enlaza por `dato_laboral_id` (HLd).

Para crear/editar subnivel operativo:

En `historial_laboral_datos` (HLd):
- `persona_id`
- `cargo_id`
- `funcion_real_id`
- `nivel_jerarquico`
- `fecha_inicio`

En `historial_laboral_grupos` (HLg):
- `persona_id`
- `dato_laboral_id`
- `grupo_de_trabajo_id`
- `nivel_jerarquico`
- `carga_por_dia_semana` (al menos un item válido)
- `fecha_inicio`

Por cada item de `carga_por_dia_semana`:
- `dia_semana_id`
- `horas`

---

## 3) Criterio de cumplimiento

Se considera cumplimiento del contrato cuando:

1. El frontend bloquea guardado ante ausencia de campos obligatorios.
2. El backend rechaza la operación con error bloqueante ante ausencia o inconsistencia.
3. No quedan caminos alternativos de persistencia que permitan guardar incompleto.

