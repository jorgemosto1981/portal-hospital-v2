# Acta RRHH — épica 1919, Bloque E (oleada P2)

**Plantilla / registro institucional.** Completar firma y adjuntar al cierre P0 (`tag 1919-p0-doc-g1`).

## Alcance acordado

- **Oleada P2 (justificaciones):** Art. **63.c**, **63.d**, **63.i**, **63.j**, **63.k** (códigos grilla 63-C … 63-K; SARH 63C … 63K).
- **Fuera de oleada:** Art. **63.a** (mesas de examen / certificados académicos).
- **Bloque E:** solo **día entero exclusivo** (`cfg_nod_exclusivo`); sin justificación por tramo horario en esta oleada.

## Transversal (configurador)


| Tema          | Decisión                                                                         |
| ------------- | -------------------------------------------------------------------------------- |
| Elegibilidad  | `escalafon_ids` vacío (todos); filtros restrictivos en otros ejes según artículo |
| Circuito      | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR`                      |
| `depende_rda` | `true` en los cinco incisos                                                      |
| Superposición | Manual en bandeja P2; sin `articulos_incompatibles_ids` en piloto                |
| Impacto       | Igual 64-A: goce completo, no presentismo, suma SAC                              |
| Documentación | Adjunto al inicio o hasta **5 días hábiles** posteriores                         |
| Sanciones     | Fuera del portal (manual RRHH/SARH)                                              |
| Grilla        | Pasiva: no sugiere artículos                                                     |


## Duelo (63.j)

- Un `art_`* unificado, tope **5** días; tabla vínculo → días en configurador (`opciones_consumo_solicitud[]` — ver RFC).
- Cómputo **días corridos**.

## LAO Art. 40

- **Sin cambio** de esquema: un `art_`*, versiones por `correspondencia_anio`, Patrón A / check-in intocable.

## Firmas


| Rol                   | Nombre | Fecha |
| --------------------- | ------ | ----- |
| RRHH                  |        |       |
| Producto / desarrollo |        |       |


