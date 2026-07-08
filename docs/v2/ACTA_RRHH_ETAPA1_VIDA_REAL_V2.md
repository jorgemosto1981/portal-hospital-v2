# Acta RRHH — Etapa 1 vida real (Portal Digital V2)

| Campo | Valor |
|-------|--------|
| **Documento** | Acta operativa / contrato producto–tecnología–RRHH |
| **Versión** | 1.0 aceptada · 2026-07-08 (fechas/canal al firmar) |
| **URL piloto** | https://portal-hospital-v2.web.app |
| **Proyecto Firebase** | `portal-hospital-v2` |
| **Referencias** | Checklist UAT Etapa 1 · Política de deploy Etapa 1 · Go-Live runbook |
| **Firmas** | RRHH (operación) · Producto · Tecnología — al pie |

## 1. Alcance del acuerdo

### 1.1 Qué se digitaliza en Etapa 1

Solo estos trámites en el portal, para la población §2:

| Trámite | Notas |
|---------|--------|
| **64-A** | Asuntos particulares con goce — Patrón B / saldos |
| **64-B** | Asuntos particulares sin goce — Patrón B / saldos |
| **63.j** | Duelo / fallecimiento — opciones de vínculo |
| **Cambio de día** | Traslado propio (mismo agente: día origen → día destino), con OK de jefe en **bandeja** |

### 1.2 Qué no entra (sigue en papel / planilla)

Todo lo demás, en particular:

- LAO  
- Licencias médicas y circuitos auditor/junta  
- Intercambio de guardia entre dos agentes  
- Cualquier otro artículo 1919 no listado en §1.1  
- Uso de **GSO / creación de turnos por el jefe** (queda en RRHH hasta nueva acta)

### 1.3 Principio de convivencia (ratificado)

> **Si el trámite no está en §1.1, sigue en papel/planilla.**  
> Si está en §1.1, el canal oficial es el portal: RRHH **no** tramita por planilla el mismo pedido ya cargado (salvo contingencia declarada o remediación §4).

### 1.4 Superficies por rol (recordatorio operativo)

| Rol | En portal Etapa 1 |
|-----|-------------------|
| Agente | Login, alta/consulta solicitudes §1.1, historial |
| Jefe | **Solo bandeja** (aprobar/rechazar). Sin GSO ni turnos |
| RRHH | Bandeja TC, remediación, GSO/turnos (dueño operativo temporal) |

## 2. Población objetivo (allowlist)

### 2.1 Unidad / GDT piloto (nuevos)

| Campo | Valor |
|-------|--------|
| **GDT / unidad** | **Grupos de trabajo nuevos** creados para Etapa 1 (IDs en Anexo A / Go-Live). No reutilizar como cohorte los GDT históricos de prueba salvo decisión firmada. |
| **Usuarios** | **Usuarios nuevos** (altas) asignados a esos GDT. Usuarios actuales del sistema **permanecen**, fuera de circuito Etapa 1. |
| **Cupo máximo** | ~70–80 personas (agentes + jefes del árbol; no incluye cuentas RRHH/técnicas) |
| **Lista nominal** | Anexo A — `gdt_*` + nómina `persona_id` / DNI / cargo / jefe esperado |

### 2.2 Compromisos de RRHH antes del Día D

RRHH se compromete a, **antes del Soft Launch y antes de cada oleada**:

1. Crear los **GDT nuevos** del piloto y altas de persona + cuenta para cada integrante de la allowlist.  
2. Cargos / HLg / HLc vigentes y coherentes con el GDT ancla (jefe con nivel jerárquico **mayor** que los agentes a cargo).  
3. Check-in de saldos **64-A / 64-B** (y lo requerido para 63.j) en cada agente que vaya a pedir esos arts.  
4. Comunicar a la nómina: URL, qué trámites van al portal, que el resto sigue en papel.  
5. Mantener la allowlist: altas/bajas del piloto se informan a Tecnología con **48 h** de anticipación (salvo urgencia).

### 2.3 Compromisos de Tecnología / Producto

1. Filtro de catálogo y allowlist activos (persona cuyo HLg vigente no está en `gdt_ids_etapa1` no opera circuito Etapa 1).  
2. Superficie jefe sin GSO.  
3. No deploy a prod piloto fuera de la Política de deploy Etapa 1.  
4. Canal técnico de soporte a RRHH durante Soft Launch y primera semana de oleada.

## 3. Hitos y fechas (roll-out)

| Hito | Descripción | Fecha / ventana | Criterio de pase |
|------|-------------|-----------------|------------------|
| **UAT interno** | Checklist UAT 100% verde (o smoke firmado) | `[fecha]` | Go Soft Launch |
| **Día D — Soft Launch** | 5–10 **usuarios nuevos** + ≥1 jefe + ≥1 RRHH en GDT nuevos | `[fecha]` | Acta UAT previa OK |
| **Revisión Soft Launch** | 48–72 h post Día D | `[fecha]` | Ver umbral §3.1 |
| **Oleada** | Resto allowlist hasta ~70–80 (por tandas / GDT nuevos) | `[ventana]` | Soft Launch sin bloqueantes |
| **Régimen / estabilización** | 1 semana post oleada | `[ventana]` | Métricas §3.1; Go/No-Go ampliar arts. |

### 3.1 Umbral Soft Launch → Oleada (**aceptado**)

**Go a oleada** si en 48–72 h:

- Cero bloqueantes en: login allowlist, alta 64, aprobación jefe, TC RRHH, Cambio de día happy path.  
- Incidentes de remediación GSO (Cambio de día unhappy path) **≤ 2** y cerrados por RRHH el mismo día hábil.  
- Sin evidencia de jefes operando GSO ni agentes usando LAO/médicas por el portal.  
- Primera respuesta en canal soporte **≤ 4 h hábiles**.

**No-Go** si: falla recurrente puente Cambio de día; huérfanas masivas por HLg; allowlist/catálogo agujereados.

## 4. Canales de soporte y remediación

### 4.1 Cómo reporta el piloto

| Canal | Uso |
|-------|-----|
| **`[nombre canal — al firmar]`** | Incidentes piloto (agentes → RRHH; RRHH escala a Tecnología) |
| **Portal (bandeja/historial)** | Fuente de verdad del estado del trámite |
| **Escalamiento técnico** | RRHH → `[contacto]` con DNI/`persona_id`, `sol_*`, captura, hora |

Horario Soft Launch / 1.ª semana oleada: **`[al firmar]`**.

### 4.2 Dueño de remediación

- **RRHH es dueño** de remediación operativa en GSO (B-BATCH fallido, desfasaje grilla, contingencia papel puntual).  
- **Tecnología** corrige defectos de producto/backend.  
- **Jefe no remedia en GSO** en Etapa 1.

### 4.3 Contingencia

Portal caído > **`[ej. 2 h hábiles]`** → RRHH puede autorizar planilla temporal para arts. §1.1 y regulariza al restablecer.

## 5–6. Anexos y firmas

Anexo A nómina/GDT nuevos · B instructivo portal vs papel · C links UAT/Deploy/Go-Live. Firmas RRHH / Producto / Tecnología.

---


---

**Estado:** aceptada · 2026-07-08 (fechas/canal al firmar)
