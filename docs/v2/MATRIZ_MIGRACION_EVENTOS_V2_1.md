# Matriz de migracion de eventos - V2.1

## Alcance

Matriz de ejecucion para migrar todos los emisores al contrato canonico `eventos_v2_1`, sin compatibilidad retroactiva.

## Restricciones operativas obligatorias

1. Sin mocks.
2. Sin datos ficticios.
3. Conexion directa a BD real.
4. Sin fallback legacy en lectura UI RRHH.
5. Sin migracion de eventos historicos previos (corte limpio ya aplicado).

---

## Convencion de columnas

- **Modulo/Archivo**: origen del emisor.
- **Callable/Operacion**: punto funcional que dispara el evento.
- **Accion canonica**: valor de `accion`.
- **tipo_evento_id (cfg_tev_*)**: id de catalogo para el evento.
- **Entidad principal**: entidad funcional afectada.
- **Estado migracion**:
  - `pendiente`
  - `en_progreso`
  - `migrado_v2_1`
- **Observaciones**: decisiones de payload.ui/contexto/cambios.

---

## E3 - Emisores core

| Modulo/Archivo | Callable/Operacion | Accion canonica | tipo_evento_id (cfg_tev_*) | Entidad principal | Estado migracion | Observaciones |
|---|---|---|---|---|---|---|
| `functions/modules/login.js` | registro primer acceso | `registrar_primer_acceso` | `cfg_tev_login` | `usuarios_cuenta` | pendiente | Incluir cambios de `estado_acceso_id`, `auth_uid`, `username`. |
| `functions/modules/login.js` | vinculacion cuenta | `vincular_cuenta` | `cfg_tev_login` | `usuarios_cuenta` | pendiente | Actor puede ser usuario final; asegurar `actor_label` legible. |
| `functions/modules/login.js` | login exitoso relevante RRHH | `login_exitoso` | `cfg_tev_login` | `usuarios_cuenta` | pendiente | Emitir solo si aporta valor de negocio (evitar ruido). |
| `functions/modules/onboarding.js` | completar onboarding | `completar_onboarding` | `cfg_tev_onboarding` | `personas` | pendiente | `payload.cambios` con campos efectivamente modificados. |
| `functions/modules/onboarding.js` | aceptar consentimientos | `registrar_consentimientos` | `cfg_tev_onboarding` | `personas` | pendiente | Incluir version y marca temporal de consentimientos. |
| `functions/modules/rrhh.js` | alta agente | `alta_agente_rrhh` | `cfg_tev_rrhh` | `personas` | pendiente | Incluir `persona_id`/`cuenta_id` en `payload.contexto`. |
| `functions/modules/rrhh.js` | actualizar estado acceso | `actualizar_estado_cuenta_acceso` | `cfg_tev_rrhh` | `usuarios_cuenta` | pendiente | Cambio de `estado_acceso_id` obligatorio en `payload.cambios`. |
| `functions/modules/rrhh.js` | baja laboral transaccional | `aplicar_baja_laboral` | `cfg_tev_rrhh` | `historial_laboral_cargos` | pendiente | Resumen RRHH debe indicar cantidad de HLC cerrados. |
| `functions/modules/rrhh.js` | reinicio de vinculacion | `reiniciar_vinculacion_cuenta` | `cfg_tev_rrhh` | `usuarios_cuenta` | pendiente | Registrar revocacion de sesion y estado posterior. |

---

## E4 - Emisores datos personales/laborales

| Modulo/Archivo | Callable/Operacion | Accion canonica | tipo_evento_id (cfg_tev_*) | Entidad principal | Estado migracion | Observaciones |
|---|---|---|---|---|---|---|
| `functions/modules/catalogosPersonales.js` | alta registro personal | `alta_dato_personal` | `cfg_tev_datos_personales` | `personas` | pendiente | Campos simples y catalogos con labels. |
| `functions/modules/catalogosPersonales.js` | actualizacion registro personal | `actualizar_dato_personal` | `cfg_tev_datos_personales` | `personas` | pendiente | Solo diffs reales en `payload.cambios`. |
| `functions/modules/shared/ddjjGrupoFamiliarService.js` | guardar borrador DDJJ | `guardar_ddjj_borrador` | `cfg_tev_ddjj` | `declaraciones_grupo_familiar` | pendiente | Si no hay cambios, evitar emitir duplicado. |
| `functions/modules/shared/ddjjGrupoFamiliarService.js` | presentar DDJJ | `presentar_ddjj` | `cfg_tev_ddjj` | `declaraciones_grupo_familiar` | pendiente | Resumen RRHH y contexto de version obligatorios. |
| `functions/modules/catalogosLaborales.js` | alta HLC | `alta_hlc` | `cfg_tev_datos_laborales` | `historial_laboral_cargos` | pendiente | Contexto: ids vinculados + vigencia. |
| `functions/modules/catalogosLaborales.js` | actualizacion HLC | `actualizar_hlc` | `cfg_tev_datos_laborales` | `historial_laboral_cargos` | pendiente | Normalizar cambios de estado y fechas. |
| `functions/modules/catalogosLaborales.js` | cierre HLC | `cerrar_hlc` | `cfg_tev_datos_laborales` | `historial_laboral_cargos` | pendiente | Debe dejar trazabilidad de causal de cierre. |
| `functions/modules/catalogosLaborales.js` | alta/actualizacion/cierre HLD | `alta_actualizacion_cierre_hld` | `cfg_tev_datos_laborales` | `historial_laboral_detalle` | pendiente | Definir subaccion en `payload.contexto`. |
| `functions/modules/catalogosLaborales.js` | alta/actualizacion/cierre HLG | `alta_actualizacion_cierre_hlg` | `cfg_tev_datos_laborales` | `historial_laboral_grupo` | pendiente | Incluir nivel jerarquico y vigencia. |

---

## Checklist de implementacion por etapa

## E1 - Contrato congelado
- [ ] `schema_version = eventos_v2_1` fijo.
- [ ] Diccionario `accion` aprobado.
- [ ] Diccionario `tipo_evento_id` aprobado.

## E2 - Helper unico
- [ ] Helper compartido implementado.
- [ ] Sin emision manual ad hoc.
- [ ] `payload.ui` y `periodo_yyyymm` siempre presentes.

## E3 - Core
- [ ] `login.js` migrado.
- [ ] `onboarding.js` migrado.
- [ ] `rrhh.js` migrado.

## E4 - Personales/Laborales
- [ ] `catalogosPersonales.js` migrado.
- [ ] `ddjjGrupoFamiliarService.js` migrado.
- [ ] `catalogosLaborales.js` migrado.

## E5 - Read models
- [ ] `eventos_bandeja_rrhh` activo.
- [ ] `eventos_por_persona` activo.
- [ ] `eventos_por_modulo` activo.
- [ ] Indices minimos aplicados.

## E6 - QA y cierre
- [ ] QA funcional completo en BD real.
- [ ] Sin eventos legacy detectados.
- [ ] Cierre documental firmado.

---

## Criterio de aceptacion final

Se considera cerrado cuando:

1. Todos los emisores listados figuran en estado `migrado_v2_1`.
2. Todos los eventos nuevos incluyen `payload.ui` util para RRHH.
3. No se detectan escrituras con formato legacy en `eventos_ticket`.
4. La UI operativa consulta read models y no el log global para listados.
