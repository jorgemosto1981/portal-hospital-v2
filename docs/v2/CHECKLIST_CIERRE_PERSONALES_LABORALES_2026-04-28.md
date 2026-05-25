# Checklist de cierre (Personales + Laborales)

Estado: pendiente de ejecución manual guiada en ambiente V2.

## Casos críticos (10)

1. **Personas - alta válida estricta**
   - Completar todos los obligatorios y guardar.
   - Esperado: guardado exitoso sin error.

2. **Personas - alta inválida por faltantes**
   - Omitir `domicilio.localidad_id` o `contacto.email_personal`.
   - Esperado: bloqueo por validación frontend/backend.

3. **Personas - foto_rostro real**
   - Seleccionar imagen (jpg/png <= 5MB) y guardar.
   - Esperado: upload a Storage en `personas/foto_rostro/...` y persistencia de `foto_rostro.storage_path/content_type/download_url`.

4. **Formación - falta nivel_estudios_id**
   - Cargar solo `persona_id`.
   - Esperado: error `VAL-FOR-002`.

5. **DDJJ - familiar incompleto**
   - Cargar familiar sin `dni` o sin `fecha_nacimiento`.
   - Esperado: error `VAL-DDJJ-003`.

6. **HLc - alta válida estricta**
   - Informar todos los obligatorios de HLc + referencia normativa completa.
   - Esperado: guardado exitoso.

7. **HLc - solape temporal**
   - Intentar crear HLc para misma persona con rango que se superpone.
   - Esperado: error bloqueante `VAL-HLC-008`.

8. **HLd - faltantes estrictos**
   - Crear HLd sin `rol_id` o sin `funcion_real_id`.
   - Esperado: error `VAL-HLD-002`.

9. **HLg - carga por día inválida**
   - Guardar HLg sin `carga_por_dia_semana` o en modo numérico sin `dia_semana_id`.
   - Esperado: error `VAL-HLG-013` o `VAL-HLG-015`.

10. **HLg - solape temporal por persona+grupo**
    - Crear HLg solapado en misma persona y mismo grupo.
    - Esperado: error bloqueante `VAL-HLG-014`.

## Criterio de cierre

- Todos los casos deben mostrar comportamiento esperado.
- Sin errores de consola críticos en `DatosPersonales` ni `DatosLaborales`.
- Sin inconsistencias de cadena HLg->HLd->HLc en datos resultantes.
