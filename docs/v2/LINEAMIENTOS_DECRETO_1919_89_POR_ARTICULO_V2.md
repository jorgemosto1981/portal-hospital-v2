# Lineamientos Decreto 1919/89 por artículo — Portal Hospital V2

**Propósito:** fichas operativas artículo a artículo para alinear **configurador** (`cfg_articulos` + versiones en 7 bloques), **motores A/B/C**, **ticketera** y **grilla** (`vistas_grilla_mes_agente`) con el Decreto 1919/89. No reemplaza el texto legal.

**Estado:** **índice y convención cerrados** · redacción de fichas **en curso** (Fase 0 doc).

**Plan maestro:** [`PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md`](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md)  
**Handoff:** [`HANDOFF_SESION_2026-06-11_PLAN_LINEAMIENTOS_1919_MOTOR.md`](./HANDOFF_SESION_2026-06-11_PLAN_LINEAMIENTOS_1919_MOTOR.md)  
**Precedencia normativa:** [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md)  
**Schema configurador:** [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) · ABM [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md)  
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
| 1 | Justificaciones | **63** (incisos frecuentes) | Patrón B; ver [§ Bloque E](#bloque-e--justificaciones-art-63) |
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

**Modelo producto:** un `art_*` por **inciso de uso frecuente** (plantilla Patrón B). Tabla índice — completar incisos según práctica hospital + SARH.

| Inciso (ej.) | Tema | Parámetros típicos | Estado |
|--------------|------|-------------------|--------|
| **63.a** | (según texto decreto) | cupo / hábiles | ⏳ |
| **63.d** | Donación sangre | 1 día / evento | ⏳ |
| **63.i** | Día preventivo salud | 1 / año | ⏳ |
| **63.j** | Duelo | 5/3/2 laborables por vínculo | ⏳ |
| **63.k** | Concursos | 4 hábiles; máx 12/año | ⏳ |
| **…** | Resto incisos RRHH | copiar fila | ⏳ |

**Plantilla de alta:** misma estructura que [`GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md`](./GUIA_ALTA_ARTICULO_68B_COMPENSATORIO_V2.md), con Patrón **B**.

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
- [ ] LAO, 64, 68 alineados a [`ARTICULOS_BASICOS_OPERATIVOS_V2.md`](./ARTICULOS_BASICOS_OPERATIVOS_V2.md).
- [ ] Brechas RFC §2 reflejadas en fichas afectadas.
- [ ] [`MATRIZ_ESCENARIOS_ARTICULOS_V2.md`](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) enlaza este MD.
- [ ] Cross-links: [`ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md`](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) §5 y [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) §2.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-24 | Creación del documento: índice por bloques A–F, plantilla de ficha, brechas RFC, backlog y matriz cobertura (Fase 0). |
