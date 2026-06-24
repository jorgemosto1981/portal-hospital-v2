# Lineamientos Decreto 1919/89 por artículo — Portal Hospital V2

**Propósito:** fichas operativas artículo a artículo para alinear **configurador** (`cfg_articulos` + versiones en 7 bloques), **motores A/B/C**, **ticketera** y **grilla** (`vistas_grilla_mes_agente`) con el Decreto 1919/89. No reemplaza el texto legal.

**Estado:** **índice y convención cerrados** · redacción de fichas **en curso** (Fase 0 doc).

**Plan maestro:** [`PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md`](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md)  
**Handoff:** [`HANDOFF_SESION_2026-06-11_PLAN_LINEAMIENTOS_1919_MOTOR.md`](./HANDOFF_SESION_2026-06-11_PLAN_LINEAMIENTOS_1919_MOTOR.md)  
**Precedencia normativa:** [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md)  
**Schema configurador:** [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) · ABM [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md)  
**Política día vs tramo (P0):** [`GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md`](./GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md)  
**Texto oficial (consulta):** [Decreto 1919/89 — Santa Fe (SIN)](https://www.santafe.gov.ar/index.php/web/content/view/full/119989/decreto-191989-regimen-de-licencias-y-franquicias-del-personal-de-la-administracion-publica-provincial)

**Leyenda de estado en índice**

| Símbolo | Significado |
|---------|-------------|
| ⏳ | Ficha pendiente de redactar en este MD |
| 📎 | Detalle en otro doc V2 (enlace) |
| ✅ | `art_*` operativo en piloto / motor |
| 🏷 | Referencia procedimental (sin solicitud estándar) |
| ⬛ | Caja negra médica (`es_licencia_medica`) hasta RFC médico |

---

## Índice general

1. [Convención de ficha](#convención-de-ficha)
2. [Brechas de schema priorizadas (RFC)](#brechas-de-schema-priorizadas-rfc)
3. [Backlog altas RRHH (orden sugerido)](#backlog-altas-rrhh-orden-sugerido)
4. [Matriz cobertura motor ↔ configurador](#matriz-cobertura-motor--configurador)
5. [Bloque A — Procedimental y aptitud (Arts. 1–13)](#bloque-a--procedimental-y-aptitud-arts-113)
6. [Bloque B — Licencias médicas (Arts. 14–33)](#bloque-b--licencias-médicas-arts-1433)
7. [Bloque C — Maternidad, guarda y LAO (Arts. 34–47)](#bloque-c--maternidad-guarda-y-lao-arts-3447)
8. [Bloque D — Licencias extraordinarias (Arts. 48–62)](#bloque-d--licencias-extraordinarias-arts-4862)
9. [Bloque E — Justificaciones (Art. 63)](#bloque-e--justificaciones-art-63)
10. [Bloque F — Franquicias (Arts. 64–70 bis)](#bloque-f--franquicias-arts-6470-bis)
11. [Ayuda contextual por familia normativa](#ayuda-contextual-por-familia-normativa)
12. [Criterios de cierre Fase 0](#criterios-de-cierre-fase-0)

---

## Convención de ficha

Cada artículo (o inciso frecuente del Art. 63) usa **la misma plantilla**. Copiar el bloque siguiente y completar; no pegar el PDF del decreto.

```markdown
### Art. NN — [Título breve]

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. NN [, inciso …]; sección del decreto |
| **Resumen operativo** | (3–8 líneas: derecho, plazo, goce, autoridad) |
| **¿Artículo en portal?** | Sí / No / Solo RRHH-médico / Informativo |
| **Patrón saldo** | A / B / C / Neutro / Médico-caja-negra |
| **`art_*` piloto** | `art_…` o — |
| **Parámetros versión (Bloques 1–7)** | Lista orientativa: impacto, elegibilidad, topes, acumulación, workflow, documentación |
| **Brecha motor** | Qué valida hoy el backend vs manual / pendiente |
| **Texto instructivo — Agente** | (párrafo wizard) |
| **Texto instructivo — Jefe** | |
| **Texto instructivo — RRHH** | |
| **Grilla operativa** | `codigo_grilla`, día entero vs franja horaria, impacto en `vis_*` |
| **Relación SARH** | Pendiente §6 anexo / código(s) cuando exista inventario |
```

**Bloques del schema (recordatorio):** ver matriz §4 de [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md).

**Fichas oleada 1 (Art. 63):** incluyen tablas **Bloques 1–7** + **bloque grilla** con ids `cfg_*` / `art_*` (valores `—` = pendiente alta RRHH en P2). **Enlace asistencia** alineado a la [guía día vs tramo](./GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md).

---

## Brechas de schema priorizadas (RFC)

Lista acordada en handoff 2026-06-11 (máx. 5 para RFC Fase 3):

| # | Brecha | Artículos / uso | Acción documentada |
|---|--------|-----------------|-------------------|
| 1 | Tramos con distinto % haberes en una misma causal | **14** | Tres `art_*` o `topes[]` + `variantes_sarh[]` |
| 2 | Ámbito de consumo carrera / episodio enfermedad | **17**, **23**, **53** | Extender `cfg_ambito_consumo` o bolsa por evento |
| 3 | Plazos procesales en **horas** (no cupo de saldo) | **15**, **20** | SLA / eventos solicitud, no Patrón B |
| 4 | Grilla por **franja horaria** (no solo día) | **65–69 ter**, **70 bis** | `nivel_ocupacion_dia_id` + RDA Fase 2 |
| 5 | Ayuda al solicitante versionada | Transversal | RFC `texto_ayuda_*` o módulos JS por familia |

---

## Backlog altas RRHH (orden sugerido)

| Orden | Familia | Artículos | Plantilla / referencia |
|-------|---------|-----------|-------------------------|
| 1 | Justificaciones | **63** (**c**, d, i, j, k) | Patrón B; ver [§ Bloque E](#bloque-e--justificaciones-art-63) |
| 2 | Extraordinarias cortas | **52**, **54** | Patrón B |
| 3 | Maternidad / guarda | **34–39** | Patrón B + filtros familia |
| 4 | Médicas | **14–23** | ⬛ workflow + documentación |
| 5 | Franquicias horarias | **65–70 bis** | Patrón B/C horas; [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md) como modelo |

**Ya operativos en piloto:** ver [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) (LAO, 64-A/B, 68-B).

---

## Matriz cobertura motor ↔ configurador

| Capacidad normativa | Campos / catálogos | Motor hoy | Próxima etapa (plan) |
|---------------------|-------------------|-----------|----------------------|
| Cupo anual/mensual | `cupo_dias_por_ciclo`, `ambito_consumo_id`, `reinicio_ciclo_id` | B; A (LAO) | Ámbitos carrera / evento médico |
| Límite por solicitud | `tope_dias_por_evento`, `dias_minimos_por_evento` | B; LAO R3 | Preview B en todos los artículos |
| Frecuencia mensual | `tope_frecuencia_mensual` | B (64) | 63.k, 66–67 |
| Goce / sin goce / % | `justifica_sueldo_id`, `es_sin_goce`, `variantes_sarh[]` | Flags; sin validar % | Variantes al aprobar RRHH |
| Antigüedad mínima | `filtros_antiguedad[]` | LAO; B/C parcial | Elegibilidad unificada pre-wizard |
| Preaviso | `plazo_preaviso_normativa_dias` | Warnings | Warning vs hard fail por artículo |
| Documentación | Bloque 7, `cfg_tcp_*` | Parcial UI | Post-licencia + grilla doc pendiente |
| Superposición / LAO | `politica_superposicion_id`, incompatibilidades | LAO | B + médicas vs LAO |
| Dictamen | `requiere_dictamen`, `es_licencia_medica` | Workflow | Bandeja médica |
| RDA / grilla | `depende_rda`, `nivel_ocupacion_dia_id` | B/C parcial | Franjas 65, 68 |
| Compensación horas | Patrón C, `multiplicador_valor` | **68-B** ✅ | `externo_calculado` asistencia |

---

## Bloque A — Procedimental y aptitud (Arts. 1–13)

**Rol en portal:** 🏷 referencia procedimental; **no** motorizar cupos en `saldos_articulo_agente`. Plazos (examen 90 días, etc.) = alertas RRHH.

| Art. | Tema (índice) | Estado ficha |
|------|----------------|--------------|
| 1–2 | Marco; autoridades otorgantes | ⏳ |
| 3–10 | Aptitud psicofísica ingreso | ⏳ 🏷 |
| 11–13 | Juntas; carpeta médica; procedimiento | ⏳ 🏷 |

> Al redactar: enlazar `cfg_rol_aprobador`, `requiere_dictamen`, `es_licencia_medica` como **contexto**, no como artículo solicitables.

---

## Bloque B — Licencias médicas (Arts. 14–33)

**Rol en portal:** ⬛ ticketera + workflow + grilla; cupos y % haberes vía SARH/médico o manual hasta RFC médico.

| Art. | Esencia (índice) | Patrón / notas | Estado |
|------|------------------|----------------|--------|
| **14** | Corta duración 35+35+resto; % haberes | ⬛; brecha RFC #1 | ⏳ |
| **15** | Comunicación 2 h; certificado 48 h | ⬛; brecha RFC #3 | ⏳ |
| **16** | Larga duración 2 años / enfermedad | ⬛; ámbito episodio | ⏳ |
| **17** | 5 años carrera administrativa | ⬛; brecha RFC #2 | ⏳ |
| **18** | Períodos 90 d (30 psiquiatría) | ⬛ | ⏳ |
| **19** | Catálogo patologías | ⬛ lista externa | ⏳ |
| **20–22** | Procedimiento; tratamiento; extranjero | ⬛ workflow | ⏳ |
| **23** | Familiar enfermo 30 hábiles/año | B + prórrogas | ⏳ |
| **24–29** | Accidente / enfermedad trabajo | ⬛ ART / Ley 9688 | ⏳ |
| **30–33** | Juntas incapacidad >40% | ⬛ dictamen | ⏳ |

---

## Bloque C — Maternidad, guarda y LAO (Arts. 34–47)

| Art. | Esencia (índice) | Patrón / notas | Estado |
|------|------------------|----------------|--------|
| **34–38** | Pre-parto, post-parto, prematuro | B; varios `art_*` o matriz | ⏳ |
| **39** | Guarda judicial por edad menor | B + `filtros` familia | ⏳ |
| **40** | LAO — escala antigüedad | **A** | 📎 [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md) |
| **41** | Fraccionamiento LAO (mín. 5 hábiles, etc.) | **A** | 📎 + ⏳ ficha resumen aquí |
| **42** | Plan anual licencias | Módulo planificación (nov–dic) | ⏳ 🏷 |
| **43** | Acumulación años anteriores | **A** | 📎 |
| **44–45** | Interrupción / postergación LAO | **A** + eventos | ⏳ (Fase 2 grilla) |
| **46** | Proporcional meses | **A** | 📎 |
| **47** | Otras reglas LAO | **A** | ⏳ |

**Operativo:** LAO `art_01KRNYDN5WR7RER7MWXRZ817E7` — [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md).

---

## Bloque D — Licencias extraordinarias (Arts. 48–62)

| Art. | Esencia (índice) | Patrón | Estado |
|------|------------------|--------|--------|
| **48** | Terapéutica radiólogos | B + incompat. LAO | ⏳ |
| **49–51** | Política / gremial / comisión sin goce | B o sin cupo | ⏳ |
| **52** | Matrimonio 10 hábiles | B | ⏳ **prioridad backlog** |
| **53** | Razones particulares; cónyuge misión | B; ámbito carrera | ⏳ |
| **54** | Exámenes 28/año, máx 7 por período | B compuesto | ⏳ **prioridad backlog** |
| **55** | Capacitación / tesis | B (2 artículos) | ⏳ |
| **57** | Estudios 2 años | B + workflow | ⏳ |
| **58–60** | Deportes / militar / FFAA | B; Art. 59 50% → variantes SARH | ⏳ |
| **61** | Atención paterna fallecimiento cónyuge | B | ⏳ |
| **62** | Preaviso 15 d (regla general) | Transversal B/C | ⏳ |

---

## Bloque E — Justificaciones (Art. 63)

**Modelo producto:** un `art_*` por **inciso de uso frecuente** (plantilla Patrón B). Motor valida topes y unidad; **no** sugiere artículo desde grilla.

**Plantilla de alta:** misma estructura operativa que [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md), con Patrón **B** y unidad **días** salvo indicación.

| Inciso | Tema | Estado ficha |
|--------|------|--------------|
| **63.c** | Fuerza mayor / fenómenos meteorológicos | ✅ [ficha](#art-63-c--fuerza-mayor) |
| **63.d** | Donación de sangre | ✅ [ficha](#art-63-d--donación-de-sangre) |
| **63.i** | Día preventivo de salud | ✅ [ficha](#art-63-i--día-preventivo-de-salud) |
| **63.j** | Duelo | ✅ [ficha](#art-63-j--duelo) |
| **63.k** | Concursos / oposiciones | ✅ [ficha](#art-63-k--concursos-y-oposiciones) |

**Fuera de oleada P2:** **63.a** (mesas de examen / certificados académicos) — lógica documental compleja; backlog posterior.

### Parámetros transversales RRHH (acta 2026-06-24)

| Tema | Decisión institucional |
|------|------------------------|
| **Oleada P2** | `63.c`, `63.d`, `63.i`, `63.j`, `63.k` |
| **Elegibilidad** | `escalafon_ids` = `[]` (todos). Resto de filtros del configurador **activos** (agrupamiento, vínculo, cargo, grupo, persona/DNI) según restricción RRHH por artículo |
| **Circuito** | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` — autogestión agente |
| **`depende_rda`** | **`true`** en los cinco |
| **Grilla** | `cfg_nod_exclusivo`; códigos `63-C`, `63-D`, `63-I`, `63-J`, `63-K` |
| **Superposición** | Política **manual** en bandeja P2; **no** poblar `articulos_incompatibles_ids` aún |
| **Impacto** | Igual **64-A**: goce completo (`cfg_js_si_completo`), `suma_para_sac` = true, `afecta_presentismo` = false |
| **Cómputo** | **63.j:** `cfg_rcd_corridos`. **63.d, 63.i, 63.k:** `cfg_rcd_habiles_compuesto` (o el hábil vigente en 64-A) |
| **Workflow** | Borrador → Jefe → RRHH → Aprobada (sin paso especial concursos) |
| **Documentación** | Adjunto puede ir **al inicio** o **hasta 5 días hábiles posteriores** (`cfg_tcp_*`); solicitud puede crearse antes del certificado |
| **SARH** | Códigos origen: **63C, 63D, 63I, 63J, 63K** |
| **Acta P0** | Bloque E: **solo día entero exclusivo**; tramos horarios **no** aplican en esta oleada |

### Regla de oro — configurador (sin hardcoding)

Toda regla de la tabla anterior y de las fichas debe poder **cargarse y editarse** en el ABM (`ArticuloConfigTabs` + catálogos `cfg_*`) y consumirse desde motores/wizards por `version_id`. **Prohibido** tablas de vínculo/duelo o topes por inciso en constantes TS.

**Extensiones requeridas** (prioridad P5 / gate antes de alta masiva 1919): ver [`RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md`](./RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md).

---

### Art. 63.d — Donación de sangre

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. 63 inc. **d** |
| **Resumen operativo** | Justificación por donación de sangre; **1 día** por evento; con goce; documentación acreditante; autorización según workflow. |
| **¿Artículo en portal?** | Sí — Patrón B |
| **Patrón saldo** | **B** |
| **`art_*` piloto** | — (alta P2) |
| **Enlace asistencia** | `cubre_inasistencia_total` (por tramo/día según solicitud); no delta parcial fragmentado |
| **Brecha motor** | Preview B + MDC día entero; sin variante SARH en UI (C2 pendiente) |
| **Relación SARH** | **63D** (app origen) |

**Bloque 1 — Identidad** (`bloque_identidad_naturaleza`)

| Campo | Valor objetivo |
|-------|----------------|
| `codigo` | `63-D` |
| `inciso_normativo` | Art. 63 inc. d — Decreto 1919/89 |
| `nombre` | DONACION DE SANGRE (ajustar mayúsculas institucional) |
| `es_lao_anual` | `false` |
| `es_sin_goce` | `false` |
| `es_licencia_medica` | `false` |
| `requiere_dictamen` | `false` |
| `visualizacion.codigo_grilla` | `63-D` |
| `visualizacion.color_ui` | (paleta institucional licencia administrativa) |

**Bloque 2 — Impacto** (`bloque_impacto_economico`)

| Campo | Valor objetivo |
|-------|----------------|
| `justifica_sueldo_id` | `cfg_js_si_completo` |
| `suma_para_sac` | `true` |
| `afecta_presentismo` | `false` |
| `suma_antiguedad_lao` | `false` |

**Bloque 3 — Elegibilidad** (`bloque_elegibilidad_filtros`)

| Campo | Valor objetivo |
|-------|----------------|
| `escalafon_ids` | `[]` (todos) |
| `agrupamiento_ids`, `tipo_vinculo_ids`, `cargo_ids`, `grupo_ids`, `persona_ids` | Según restricción RRHH por artículo (pueden ser restrictivos) |
| `filtros_antiguedad` | `0` meses salvo norma |

**Bloque 4 — Topes** (`bloque_topes_plazos_computo`)

| Campo | Valor objetivo |
|-------|----------------|
| `unidad_medida_id` | `cfg_uma_dias` |
| `regla_computo_desde_id` / `regla_computo_hasta_id` | `cfg_rcd_habiles_compuesto` |
| `ambito_consumo_id` | `cfg_ac_anio_calendario` |
| `reinicio_ciclo_id` | `cfg_rcc_anual` |
| `origen_saldo_id` | `cfg_os_interno` |
| `accion_saldo_id` | `cfg_as_resta` |
| `cupo_dias_por_ciclo` | **sin tope anual** en sistema |
| `tope_dias_por_evento` | **1** |
| `tope_frecuencia_mensual` | **no parametrizar** (control manual abusos) |
| `depende_rda` | **`true`** |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |
| `politica_superposicion_id` | según catálogo (incompatibilidades LAO en ficha LAO) |

**Bloque 5 — Acumulación** (`bloque_acumulacion_sucesion`)

| Campo | Valor objetivo |
|-------|----------------|
| Caducidad / arrastre | Sin arrastre típico; evento puntual |

**Bloque 6 — Workflow** (`bloque_workflow_sla_cobertura`)

| Campo | Valor objetivo |
|-------|----------------|
| `circuito_ingreso_ids` | `CFG_USUARIO`, `CFG_RRHH`, `CFG_MEDICO`, `CFG_VISUALIZADOR` |
| Adjuntos / plazos doc | Certificado donación — bloque 7 |

**Bloque 7 — Documentación** (`bloque_documentacion_convivencia`)

| Campo | Valor objetivo |
|-------|----------------|
| Adjuntos obligatorios | Certificado institución **hemoterapia** (obligatorio; puede adjuntarse hasta **5 días hábiles** posteriores) |
| `articulos_incompatibles_ids` | **vacío** P2 (control manual bandeja) |
| Plazo presentación doc | `cfg_tcp_*` — hasta **5 hábiles** post último día licencia |

**Bloque grilla**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo_grilla` | `63-D` |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |
| Unidad consumo | Días |
| Fichada | Cubre **día entero** (`licenciaCubreDiaFichada`) |
| MDC | Fan-out por cada día de solicitud aprobada |

**Texto instructivo — Agente:** Solicitá el día de la donación con certificado; no reemplaza comunicación institucional si la norma lo exige.  
**Texto instructivo — Jefe:** Verificar certificado y que el día coincide con el evento.  
**Texto instructivo — RRHH:** Parametrización 1 día/evento; cruce excepcional día vs delta solo por acto RRHH ([guía](./GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md) §5).

---

### Art. 63.i — Día preventivo de salud

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. 63 inc. **i** |
| **Resumen operativo** | **1 día** por año calendario; examen preventivo de salud; con goce; documentación. |
| **¿Artículo en portal?** | Sí — Patrón B |
| **Patrón saldo** | **B** |
| **`art_*` piloto** | — (alta P2) |
| **Enlace asistencia** | `cubre_inasistencia_total` |
| **Relación SARH** | **63I** |
| **Brecha motor** | Tope anual 1 — preview B |

**Bloque 1 — Identidad**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo` | `63-I` |
| `inciso_normativo` | Art. 63 inc. i |
| `nombre` | DIA PREVENTIVO DE SALUD |
| `es_lao_anual` / `es_sin_goce` / `es_licencia_medica` | `false` |
| `visualizacion.codigo_grilla` | `63-I` |

**Bloque 2 — Impacto**

| Campo | Valor objetivo |
|-------|----------------|
| `justifica_sueldo_id` | `cfg_js_si_completo` |
| `suma_para_sac` | `true` |
| `afecta_presentismo` | `false` |

**Bloque 3 — Elegibilidad**

| Campo | Valor objetivo |
|-------|----------------|
| `escalafon_ids` | `[]` |
| Otros filtros | Restrictivos según RRHH (transversal) |

**Bloque 4 — Topes**

| Campo | Valor objetivo |
|-------|----------------|
| `unidad_medida_id` | `cfg_uma_dias` |
| `regla_computo_*` | `cfg_rcd_habiles_compuesto` |
| `reinicio_ciclo_id` | `cfg_rcc_anual` |
| `origen_saldo_id` | `cfg_os_interno` |
| `cupo_dias_por_ciclo` | **1** |
| `tope_dias_por_evento` | **1** |
| `tope_frecuencia_mensual` | **1** |
| `depende_rda` | **`true`** |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |

**Bloques 5–7**

| Bloque | Valor objetivo |
|--------|----------------|
| 5 | Sin arrastre |
| 6 | Circuito estándar |
| 7 | Certificado médico/laboratorio **efector público o privado**; adjunto inicial o hasta **5 hábiles** posteriores |

**Bloque grilla**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo_grilla` | `63-I` |
| Fichada | **Solo día entero** (no fraccionar tramos) |
| MDC | Exclusivo |

**Texto instructivo — Agente:** Un día por año; podés crear la solicitud y adjuntar certificado después (máx. 5 hábiles).  
**Texto instructivo — Jefe:** Controlar cupo anual y fechas.  
**Texto instructivo — RRHH:** No acumular más de 1 día/ciclo A.

---

### Art. 63.j — Duelo

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. 63 inc. **j** |
| **Resumen operativo** | Licencia por fallecimiento; días **corridos** según vínculo (tabla institucional); un `art_*` unificado tope **5**; wizard con opción de vínculo. |
| **¿Artículo en portal?** | Sí — Patrón B |
| **Patrón saldo** | **B** |
| **`art_*` piloto** | — (alta P2; código sugerido `art_63_j` unificado) |
| **Enlace asistencia** | `cubre_inasistencia_total` — día entero exclusivo |
| **Relación SARH** | **63J** |
| **Brecha motor / configurador** | Requiere `opciones_consumo_solicitud[]` en versión + UI ABM ([RFC extensiones](./RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md) §2.1). **Sin** tabla vínculo en código wizard. |

**Bloque 1 — Identidad**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo` | `63-J` |
| `inciso_normativo` | Art. 63 inc. j |
| `nombre` | DUELO |
| `visualizacion.codigo_grilla` | `63-J` |

**Bloque 4 — Topes (parametrización inicial piloto)**

| Campo | Valor objetivo |
|-------|----------------|
| `unidad_medida_id` | `cfg_uma_dias` |
| `tope_dias_por_evento` | **5** (máximo; días efectivos = opción elegida en wizard) |
| `cupo_dias_por_ciclo` | sin tope anual bajo (por evento fallecimiento) |
| `regla_computo_*` | **`cfg_rcd_corridos`** |
| `depende_rda` | **`true`** |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |

**Tabla institucional → `opciones_consumo_solicitud[]` (parametrizar en ABM)**

| Opción (etiqueta_ui) | `dias_por_evento` | Notas |
|----------------------|-------------------|--------|
| Cónyuge / conviviente, hijos, padres | **5** | corridos |
| Hermanos | **3** | corridos |
| Abuelos y nietos | **2** | corridos |
| Tíos y sobrinos (consanguíneos directos) | **1** | día del sepelio |

**Bloque 6 — Workflow**

| Campo | Valor objetivo |
|-------|----------------|
| `circuito_ingreso_ids` | Estándar piloto completo |
| Comunicación | Práctica interna primeras horas (texto ayuda; no bloqueo automático salvo política futura) |

**Bloque 7**

| Campo | Valor objetivo |
|-------|----------------|
| Adjuntos | Acta/certificado defunción; hasta **5 hábiles** posteriores |
| `opciones_consumo_solicitud[]` | Tabla arriba — **fuente de verdad** para wizard y motor |

**Bloque grilla**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo_grilla` | `63-J` |
| Fichada | Día entero por cada día de la solicitud aprobada |
| Multievento | Un evento por fallecimiento; no fragmentar en horas |

**Texto instructivo — Agente:** Comunicá en las primeras horas según norma interna; indicá fechas y adjuntá certificado.  
**Texto instructivo — Jefe:** Verificar vínculo y días laborables otorgados.  
**Texto instructivo — RRHH:** Aplicar tabla 5/3/2; cruce excepcional solo acto RRHH.

---

### Art. 63.k — Concursos y oposiciones

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. 63 inc. **k** |
| **Resumen operativo** | Hasta **4 días hábiles** por concurso/oposición; **máx. 12** por año; con goce; acreditación. |
| **¿Artículo en portal?** | Sí — Patrón B |
| **Patrón saldo** | **B** |
| **`art_*` piloto** | — (alta P2) |
| **Enlace asistencia** | `cubre_inasistencia_total` |
| **Relación SARH** | **63K** |
| **Brecha motor** | Agrupación por concurso: **manual** en bandeja RRHH P2 (sin `id_concurso` en schema) |

**Bloque 4 — Topes**

| Campo | Valor objetivo |
|-------|----------------|
| `unidad_medida_id` | `cfg_uma_dias` |
| `tope_dias_por_evento` | **4** (un **proceso** de concurso = una solicitud con hasta 4 fechas) |
| `cupo_dias_por_ciclo` | **12** |
| `regla_computo_*` | `cfg_rcd_habiles_compuesto` |
| `depende_rda` | **`true`** |
| `reinicio_ciclo_id` | `cfg_rcc_anual` |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |

**Bloques 1–3, 5–7**

| Bloque | Valor objetivo |
|--------|----------------|
| 1 | `codigo` `63-K`, grilla `63-K` |
| 2 | `cfg_js_si_completo` |
| 3 | Elegibilidad estándar piloto |
| 5 | Sin arrastre |
| 6 | Circuito estándar |
| 7 | Llamado / constancia concurso; doc inicial o **5 hábiles** posteriores |

**Bloque grilla**

| Campo | Valor objetivo |
|-------|----------------|
| MDC | Hasta 4 días por solicitud; pila si otros eventos mismo día con conflicto |

**Texto instructivo — Agente:** Máximo 4 días por concurso; respetá cupo anual 12.  
**Texto instructivo — RRHH:** Verificar llamado y acumulado anual.

---

### Art. 63.c — Fuerza mayor

| Campo | Contenido |
|-------|-----------|
| **Referencia** | Decreto 1919/89, Art. 63 inc. **c** — razones de fuerza mayor / fenómenos meteorológicos |
| **Resumen operativo** | Justificación por fuerza mayor (ej. fenómenos meteorológicos); hasta **3 días por evento** y **6 por año**; con goce; workflow estándar. |
| **¿Artículo en portal?** | Sí — Patrón B |
| **Patrón saldo** | **B** |
| **`art_*` piloto** | — (alta P2) |
| **Enlace asistencia** | `cubre_inasistencia_total` — día entero exclusivo |
| **Relación SARH** | **63C** |
| **Brecha motor** | Acreditación del evento (meteorológico): criterio RRHH en bandeja si no hay adjunto estandarizado |

**Bloque 1 — Identidad**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo` | `63-C` |
| `inciso_normativo` | Art. 63 inc. c |
| `nombre` | FUERZA MAYOR / FENOMENOS METEOROLOGICOS (etiqueta institucional) |
| `visualizacion.codigo_grilla` | `63-C` |

**Bloque 2 — Impacto**

| Campo | Valor objetivo |
|-------|----------------|
| `justifica_sueldo_id` | `cfg_js_si_completo` |
| `suma_para_sac` | `true` |
| `afecta_presentismo` | `false` |

**Bloque 3 — Elegibilidad**

| Campo | Valor objetivo |
|-------|----------------|
| `escalafon_ids` | `[]` |
| Otros filtros | Restrictivos según RRHH |

**Bloque 4 — Topes**

| Campo | Valor objetivo |
|-------|----------------|
| `unidad_medida_id` | `cfg_uma_dias` |
| `tope_dias_por_evento` | **3** |
| `cupo_dias_por_ciclo` | **6** |
| `regla_computo_*` | `cfg_rcd_habiles_compuesto` |
| `depende_rda` | **`true`** |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` |

**Bloques 5–7**

| Bloque | Valor objetivo |
|--------|----------------|
| 5 | Sin arrastre |
| 6 | Circuito estándar |
| 7 | Evidencia del evento (certificado municipal, nota interna, etc.); **5 hábiles** posteriores si aplica |

**Bloque grilla**

| Campo | Valor objetivo |
|-------|----------------|
| `codigo_grilla` | `63-C` |
| Fichada | Día entero exclusivo |

**Texto instructivo — Agente:** Solo para situaciones de fuerza mayor acreditables; indicá fechas del evento.  
**Texto instructivo — RRHH:** Validar fenómeno y acumulado 6/año.

---

## Bloque F — Franquicias (Arts. 64–70 bis)

| Art. | Esencia (índice) | Patrón | Estado |
|------|------------------|--------|--------|
| **64 a** | Asuntos particulares **con goce** | **B** | ✅ 64-A [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md) |
| **64 b** | Asuntos particulares **sin goce** | **B** | ✅ 64-B |
| **65** | Lactancia (franjas horarias) | Horas; grilla franja | ⏳ RFC #4 |
| **66–67** | Tardanzas autorizadas | B mensual / minutos | ⏳ |
| **68 a** | Compensación jornadas | C + ventana 30–90 d | ⏳ |
| **68 b** | Compensatorio horas | **C** | ✅ 68-B + guía |
| **69** | Franquicia horaria genérica | Horas | ⏳ |
| **69 bis** | Permiso discapacidad | Horas | ⏳ |
| **69 ter** | Profesionales matriculados | Horas | ⏳ |
| **70** | Jubilatorio 2 h/sem | Horas | ⏳ |
| **70 bis** | Gremial 24 h/mes arrastre | Horas; `meses_arrastre` | ⏳ |

---

## Ayuda contextual por familia normativa

Borrador para checklist **ayuda-copy** (textos finales van en cada ficha).

| Familia | Agente (resumen) |
|---------|------------------|
| LAO Art. 41 | Licencia anual obligatoria; fracciones mín. 5 hábiles; un tramo dic–mar; preaviso 15 d salvo saldos años anteriores |
| Art. 64 | Hasta 1 jornada/mes y 6/año; autorización jefe; elegir 64-A (goce) o 64-B (sin goce) |
| Art. 63.j duelo | Comunicar en las 2 primeras horas; certificado según vínculo; días laborables por tabla |
| Art. 14 médica | Comunicar a personal en plazo; adjuntar certificado; tramos de haberes según duración — validación médica/RRHH |

---

## Criterios de cierre Fase 0

- [ ] Ficha completa (plantilla) para **todos** los artículos con impacto en ausencias de las tablas §5–§10.
- [x] **Oleada 1 Art. 63:** fichas **c, d, i, j, k** (acta RRHH 2026-06-24).
- [x] [`GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md`](./GUIA_POLITICA_DIA_VS_TRAMO_JUSTIFICACIONES_V2.md).
- [ ] Acta RRHH oleada 63 (firma) + tag `1919-p0-doc-g1`.
- [ ] LAO, 64, 68 alineados a [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md).
- [ ] Brechas RFC §2 reflejadas en fichas afectadas.
- [ ] [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) enlaza este MD.
- [ ] Cross-links: [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) §5 y [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) §2.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-24 | Acta RRHH: oleada **63.c–k**; transversal; **63.a** fuera; RFC extensiones configurador; duelo `opciones_consumo_solicitud[]`. |
| 2026-06-24 | P0: guía día vs tramo; fichas Art. 63 con bloques 1–7 + grilla. |
| 2026-06-24 | Creación del documento: índice por bloques A–F, plantilla de ficha, brechas RFC, backlog y matriz cobertura (Fase 0). |
