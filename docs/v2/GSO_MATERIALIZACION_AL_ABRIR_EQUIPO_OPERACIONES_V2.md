# Por qué la grilla de equipo puede “cambiar sola” al abrirla

**Audiencia:** RRHH, jefes de servicio, soporte, implementación  
**Módulo:** GSO — Calendario licencias (vista **equipo** o **sector**)  
**Estado:** guía operativa (junio 2026)  
**Relacionado:** [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)

---

## 1. Qué percibe el usuario

Al abrir **Calendario licencias** en modo **equipo** o **sector**, elegir grupo y mes, a veces los **turnos teóricos** cambian respecto de la última visita, sin haber guardado nada en esa pantalla. Las **licencias** (LAO, 64-A, etc.) en general **siguen visibles**. Lo que muta es la **capa de turno** (M, T, N, franco, NL) o aparecen **celdas en blanco** en agentes con **plan mensual incompleto**.

Eso **no** significa que el sistema haya borrado licencias ni agentes del mes.

---

## 2. Qué hace el sistema al cargar esa pantalla

Antes de devolver datos a la interfaz, el backend ejecuta —**en cada consulta del listado mensual por grupo**— la **materialización del mes para todo el grupo** (`materializarGrupoMes`):

- Recalcula la **capa teórica** (turno del día en `vis_*` y `asi_*`) para cada persona con HLg vigente en ese grupo y mes.
- Usa: plan mensual **habilitado** del grupo, régimen horario, calendario institucional, HLg vigente.
- **No elimina** licencias ya proyectadas (`eventos[]` en el mismo `vis_*`).
- **Sí puede cambiar** la teoría de días donde hubo otro turno o un estado intermedio (tras cambio de HLg, régimen, corrección de plan, feriado).

Es el **mismo motor** que al aprobar un plan o al rematerializar tras feriado; aquí se dispara **al consultar** la grilla de equipo.

---

## 3. Por qué existe

- Objetivo: que RRHH vea **teoría actualizada** al abrir el mes del servicio.
- Costo: la consulta no es solo lectura; incluye **recálculo grupal** de capa 1.

---

## 4. Otros actos que también recalculan teoría

| Acto | Alcance típico | ¿Toca licencias? |
|------|----------------|------------------|
| Abrir grilla **equipo/sector** | Todo el grupo × mes | No |
| Alta / modificar **HLg** | Persona × `gdt` × ventana M+M+1 (o tramo) | No |
| **Deshabilitar / cerrar** HLg | Purge desde corte + rematerialización de tramos | No |
| **Aprobar** plan mensual | Grupo del plan × mes | No |
| Feriado / régimen (rematerializar RRHH) | Día o mes según acción | No |
| Abrir grilla **titular** | Solo esa persona si la vista está vacía/degenerada | No |

---

## 5. Qué no hace la materialización

- No modifica el plan histórico (**VER plan** / `grilla_aprobada`).
- No borra solicitudes ni saldos de artículos.
- No quita **eventos de licencia** del documento mensual por grupo.

---

## 6. Si el síntoma es otro (matriz de conflictos)

| Síntoma | Causa probable | Caso |
|---------|----------------|------|
| Celdas **blancas** varios días | Plan con **laborable sin turno** | C |
| Solo licencia, sin aviso de plan roto | Plan incompleto + UI actual | B |
| Turno cambió, licencia sigue, sin aviso | Teoría recalculada después de la solicitud | A |
| NL + licencias visibles | **Purge** por HLg inactiva | F |
| LAO en Sala “sin motivo” | Licencia con **ancla** en otro grupo | E |

No usar “re-materializar todo” como primer remedio sin revisar plan y HLg.

---

## 7. Conducta recomendada para RRHH

1. Confirmar HLg vigentes, plan del mes habilitado y cambios recientes (HLg, régimen, feriado).
2. Si cambió la teoría pero la licencia sigue: validar conflicto de **negocio**, no BD rota.
3. Si hay celdas blancas: tratar como **plan incompleto** (caso C).
4. No usar **VER plan** como única fuente operativa del mes en curso (sin capa 3).
5. Tras deshabilitar HLg: esperar NL/teoría purgada hacia adelante; licencias del tramo suelen conservarse en calendario.

---

## 8. Mensaje de capacitación (una frase)

*“Abrir la grilla de **equipo** actualiza los **turnos teóricos** de todo el servicio en ese mes; las **licencias** no se borran, pero pueden quedar en un contexto distinto al de cuando se pidieron — la pantalla debe mostrar eso con claridad.”*

---

## 9. Evolución de producto (referencia)

- Criterios de aceptación GSO: visibilidad, alertas, anti-blanco — ver documento de criterios enlazado arriba.
- Posible mejora: aviso explícito al usuario cuando corre materialización de grupo (US-11) o desacoplar listado de materialización automática (US-12 / spike).
