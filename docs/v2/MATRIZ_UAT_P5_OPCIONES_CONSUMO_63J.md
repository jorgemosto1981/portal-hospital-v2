# Matriz UAT - Paquete P5: Opciones de Consumo Dinámicas (Art. 63.j Duelo)

**Épica:** Decreto 1919 — **P5 opciones de consumo por solicitud**  
**Rama:** `feat/1919-p5-config-rfc`  
**Piloto:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` — DNI **28914247**  
**Artículo referencia:** `63-J` — `art_01KVWVW9Z50VR6T1BC6J0R3YQ8`  
**Cierre UAT:** 2026-06-24 — matriz **100% VERDE** (RRHH configurador + ticketera agente + motor nube)

**Alcance:** Frentes 1 (listado/core), 2 (ticketera Patrón B), 3 (ABM RRHH), motor calendario y Fase S sin bolsa anual para `cupo_dias_por_ciclo === null` (`63-J`, `63-D`).

---

## Casos críticos

| ID | Componente | Escenario de Prueba | Criterio de Aceptación | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **UAT-P5-01** | **Backend / Listado Core** | Solicitud de listado para el agente piloto (DNI 28914247). | El callable `listarArticulosIngresoCore` devuelve `requiere_opcion_consumo: true`, los días/fechas en `null` y el array `opciones_consumo_solicitud` mapeado con las filas activas. | **Aprobado / VERDE** |
| **UAT-P5-02** | **Frontend / Ticketera B** | Ingreso directo al alta de `63-J`. | La UI exige de forma obligatoria seleccionar el vínculo antes de abrir el selector de fechas y bloquea la validación del entorno si el combo está vacío. | **Aprobado / VERDE** |
| **UAT-P5-03** | **Motor / Calendario** | Simulación de opción "Hermanos" (3 días) partiendo del martes `2026-06-02`. | El motor resuelve el `opcion_consumo_id` en la nube, procesa el feriado del `2026-06-03` mediante el calendario institucional y devuelve la `fecha_hasta: "2026-06-05"` (3 días hábiles). | **Aprobado / VERDE** |
| **UAT-P5-04** | **Motor / Fase S (Saldos)** | Envío de solicitudes para artículos sin cupo anual (`63-J` y `63-D`). | La Fase S detecta `cupo_dias_por_ciclo === null` y salta la validación de bolsa anual (`SALDO_EVENTO_SIN_CICLO`), permitiendo el alta sin descontar saldos inexistentes y mostrando la etiqueta violeta en el Check-in. | **Aprobado / VERDE** |
| **UAT-P5-05** | **Frontend / ABM RRHH** | Edición avanzada en `ArticuloConfigTabs`. | Permite agregar, activar/desactivar y modificar filas del array persistiendo bajo el formato regulado de IDs (`oc_*`). Si la versión está bloqueada, inhabilita todos los controles para evitar corrupción. | **Aprobado / VERDE** |

---

## Verificación adicional (smoke piloto post-P5.3b)

- Carga nativa de las 4 causales semilla `oc_63j_*` en pestaña **Avanzado**.
- Alta de causal de prueba *«Tíos Políticos - 1 día laborable»*: persistencia Firestore + aparición inmediata en dropdown del wizard agente.
- Validación visual preventiva (borde rojo, banner ámbar, **Guardar** deshabilitado) ante etiqueta vacía o días por encima de `tope_dias_por_evento`.

---

## Criterio de cierre P5 (cumplido)

- Contrato Zod + rules Firestore + motor Patrón B alineados con `opcion_consumo_id` y `opciones_consumo_solicitud[]`.
- UAT-P5-01 … UAT-P5-05 en **VERDE** en entorno piloto.
- Tag Git previsto: **`1919-p5-config-rfc`** sobre merge a `master`.
