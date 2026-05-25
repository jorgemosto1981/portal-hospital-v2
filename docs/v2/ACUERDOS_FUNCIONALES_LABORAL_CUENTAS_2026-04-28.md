# Acuerdos funcionales (Laboral + Cuentas)

Fecha: 2026-04-28  
Estado: aprobado por usuario (base para implementación próxima sesión)

## 1) Modelo histórico laboral (oficial)

- Se confirma modelo objetivo:
  - `HLc` = acto/cargo base.
  - `HLd` = detalle técnico del cargo.
  - `HLg` = asignación por grupo (burbuja operativa).

### Solapes y paralelos

- **Se permite** que una persona tenga múltiples `HLc` en paralelo.
- **Se permite** que una persona tenga múltiples `HLg`, incluyendo paralelos.
- Se permite que una persona tenga varios `HLg` simultáneos en grupos distintos.
- Se permite más de un `HLc` activo simultáneo, incluyendo efectores distintos.

### Cierre histórico y correcciones

- El cierre histórico usa `fecha_hasta/fecha_fin` y causal cuando aplique.
- Puede incluirse campo de texto de comentarios (opcional).
- Se permite edición retroactiva de registros cerrados.

## 2) Registro y visualización del ciclo histórico

- La UI debe incluir vista **timeline por persona** (`HLc -> HLd -> HLg`) además de tablas.
- Filtros requeridos:
  - Activos.
  - Cerrados.
  - Vigentes en fecha X.
  - Con conflicto/alerta.
- Se requiere vista operativa por grupo (burbuja actual) separada de vista histórica.
- Columnas mínimas de auditoría:
  - Vigencia.
  - Causal de cierre.
  - IDs de cadena (`cargo_id`, `dato_laboral_id`).
  - Usuario/fecha de actualización.

## 3) Baja de usuarios (cuenta)

- Baja funcional = **deshabilitar** (`activo=false`), no borrar.
- Acciones requeridas para RRHH/Seguridad:
  - Bloquear temporal.
  - Rehabilitar.
  - Forzar revinculación DNI/cuenta.
  - Invalidar sesión activa.
- Restricciones:
  - No puede existir persona activa con usuario deshabilitado.
  - Usuario deshabilitado no debe ver ninguna pantalla.
- Se requiere motivo de baja + trazabilidad (quién/cuándo) y comentario opcional.

## 4) Datos adicionales requeridos para HLd (procesos futuros)

- Procesos prioritarios: Ticket, burbujeo, licencias, reportes y payroll.
- Confirmado agregar/usar en `HLd`:
  - `modalidad_jornada_id`.
  - `regimen_horario_id` (o equivalente).
  - `centro_costo_id` / imputación presupuestaria.
- No incluir por ahora:
  - especialidad/subespecialidad operativa.
  - criticidad/guardias.
- `nivel_jerarquico` en `HLd` queda como respaldo informativo; operativo final en `HLg`.
- No se agrega campo de fuente normativa/referencia administrativa en `HLd`.

## 5) Reglas de cierre (pendiente de definición)

Pendientes para próxima sesión:

- Matriz bloqueante vs warning en laboral: **INDEFINIDO**.
- SLA de calidad de datos antes de abrir próximo módulo:
  - 0 solapes: **ANALIZAR** (incompatible con permiso de paralelos definido).
  - 0 registros sin cadena `HLg -> HLd -> HLc`: **ANALIZAR**.
  - Reconciliación de carga horaria con tolerancia acordada: **ANALIZAR**.

## 6) Impacto técnico detectado (para aplicar en próxima sesión)

Hay decisiones nuevas que contradicen validaciones hoy activas en backend:

- `VAL-HLC-008` actualmente bloquea solapes de `HLc`.
- `VAL-HLG-014` actualmente bloquea solapes de `HLg`.

Próxima sesión: ajustar estas reglas a política de paralelos permitidos y redefinir qué se considera conflicto real (warning vs bloqueo).
