# Reglas de Cursor y convenciones de código — Portal V2 (borrador)

**Estado:** borrador de referencia para el equipo y el asistente (abril 2026).  
**Origen:** se tomó lo operativo del [`.cursorrules` de la V1](../../.cursorrules) (v76) y se alineó a la documentación en `docs/v2/` y a `PLAN_DESARROLLO_VERSION2.md`.  
**No sustituye** los módulos `MODULO_*_V2.md`, `RULEBOOK_V2.md` ni `DECISIONES_…`: son la **fuente de verdad** de negocio y datos.

---

## 1. Idioma y lectura obligatoria

- Comunicación y comentarios de código: **español**.
- Antes de implementar una pieza, localizar el contrato en **`docs/v2/`** (índice: [`README.md`](./README.md)).
- Precedencia si hay conflicto: módulos `MODULO_*` + [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) → [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md) → [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) (ver también **A3** en decisiones).

---

## 2. Stack técnico (V2)

- **Frontend:** React, Vite, Hooks. Componentes en **arrow functions** cuando el estilo del repo lo unifique.
- **Backend / datos:** Firebase **modular** (v9+), **proyecto y base de datos dedicados a la V2** (ver §3).
- **Estilos:** según convención del repo (p. ej. CSS por feature); **mobile-first** y feedback claro al usuario.
- **Fechas / zona horaria:** criterio explícito en app (p. ej. `date-fns` + tz), alineado a lo que exijan los módulos.

---

## 3. Independencia absoluta V1 / V2

- **Prohibido:** usar el mismo **proyecto Firebase / Firestore / Auth** en producción que la app V1; migrar datos V1 → V2; leer o escribir colecciones de V1 desde código o despliegue de V2.
- La V1 queda como **referencia de lecciones** ([`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md), [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)).
- Toda la planificación de producto y contratos de la V2: **`docs/v2/`**.

### Código V1 en el mismo monorepo

- Respetar **Zonas Protegidas** del V1 (p. ej. utilidades de árbol marcadas como críticas en V1) **sin modificar** salvo **RFC** y aprobación explícita; el desarrollo **nuevo** de producto V2 no debe depender de parches a esos archivos.

---

## 4. Identidad y anclas (V2)

- **Identificador de sistema entre módulos:** `persona_id` = id del documento `personas/{per_<ULID>}`.
- **Prohibido** como FK entre módulos: DNI, email, `auth_uid` (salvo flujos puntuos de Auth documentados en Login).
- **DNI:** único y normalizado en `personas` según módulo; no “segunda clave de negocio” paralela a `persona_id` en el modelo V2.
- **Correo de acceso:** `usuarios_cuenta.username` (y Auth); no duplicar en `personas` como SSoT ([`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) §2.2).
- **Producto (login V2):** DNI en pantalla; **PIN 6** + correo en primer acceso — [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §1.1.

---

## 5. Firebase: estructura y nombres (V2)

- Respetar **nombres de colecciones y prefijos** de [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) y los módulos, por ejemplo: `personas`, `usuarios_cuenta`, `formacion_agente`, `consentimientos`, `declaraciones_grupo_familiar`, `eventos_ticket`, `grupos_de_trabajo` (`gdt_*`), `efectores` (`efe_*`), `historial_laboral_cargos` (`hlc_*`), `historial_laboral_datos` / `historial_laboral_grupos` (`hld_*` / `hlg_*`), `cfg_*`.
- **No** reutilizar nombres obsoletos de la V1 (p. ej. un solo `grupos` mezclando organigrama y efector) en código **nuevo** V2; ver **A2** en decisiones.

**Lazy loading** y consultas acotadas donde el módulo lo exija; **no** inflar documentos con derivables que tengan su colección (formación, DDJJ, etc.).

---

## 6. Listas de negocio: `cfg_*` (sin hardcoding)

- Toda lista cerrada (estados, tipos, causales, niveles, días de semana, etc.) = **`*_id` → documento en `cfg_*`** o colección de configuración acordada ([`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)).
- **Prohibido** codificar en strings mágicos (`"COMPLETO"`, `"ACTIVO"`) reglas de persistencia; los ids viven en datos y la etiqueta se resuelve por join a catálogo.
- **Gobernanza:** cambios masivos a catálogos o semillas = proceso acordado (equivalente al espíritu de “Configuración de alto impacto” de V1, aplicado a `cfg_*` y seeds en V2).

---

## 7. Integridad de esquema y fuente única (SSoT)

- **No** agregar campos en una colección “por rapidez” si el dato ya vive en el **documento maestro** o se obtiene por **referencia** + lectura (espíritu de las reglas 64 y 76 de la V1).
- Si un valor derivado debe guardarse (auditoría o rendimiento), usar criterio explícito: **inmutable** en el momento del hecho, o **`*_cache`** con actualización **centralizada** (p. ej. Cloud Function), nunca silos inconsistentes.
- **Payloads de `eventos_ticket`:** referencias e ids, **no** copia de ficha completa (**B6**).

---

## 8. Protocolo de cambios estructurales (RFC)

- Si el cambio toca **schema** documentado, **Security Rules**, o lógica de negocio transversal: **detener**, redactar **propuesta** (problema, solución, impacto en datos, riesgo), y **no implementar** hasta aprobación explícita (equivalente a reglas 65 de V1, adaptado a V2 y a `REVISION_ALINEACION_…`).

---

## 9. Implementación escalonada (atomicidad)

- Trabajo por **fases / entregas pequeñas**: estructura de datos → servicios/Callables → UI → pruebas (alineado a [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md)).
- Evitar un único “mega-PR” que mezcle Rules, functions y toda la UI.
- **Validación dual:** reglas y validación en **cliente** y en **backend** (Callable) para operaciones sensibles.

---

## 10. Arquitectura de código (V2)

- **Feature-first** sugerido: `src/features/<modulo>/` con `components`, `hooks`, rutas, sin lógica pesada en un único `App.jsx` (regla 70 de V1, mantenida en espíritu).
- **Service pattern:** la UI no importa `firebase` directo para lógica de negocio; capa en `src/services/` (o equivalente) que aísle el SDK. Si mañana cambia el backend, se reemplaza la capa de servicio.
- **Menú / shell:** composición de bloques condicionados por **rol y estado de cuenta** según se documente en módulo Login y [`CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md`](./CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md); no hardcodear listas de menú que deban ser configurables a medio plazo.

---

## 11. Seguridad: Auth, Rules y transiciones

- Transiciones a **`estado_acceso`** “finales” y **`estado_perfil_datos_id`** a “completo” = **solo servidor** (Admin SDK / Callable) — **D2**, [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md), [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §5.
- El **cliente** no debe poder ponerse a sí mismo *activo portal* ni alterar `auth_uid` arbitrariamente.
- **Rules:** deny by default; tests en emulador antes de producción (Fase 2 del orden de desarrollo).
- **PIN 6, rate limit,** mensajes genéricos ante error en primer acceso: módulo Login y flujo V2.

---

## 12. Módulo datos laborales (V2) — enlace al contrato, no a la V1

- **No** replicar la redacción antigua “tres niveles + sync a `usuarios`” de la V1 en código V2; el contrato V2 es [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) (`gdt_*` / `efe_*` / `hlc_*` / `hld_*` / `hlg_*`, **C10**: nivel de jerarquía **por grupo** en `hlg_*`, `carga_por_dia_semana`, coherencia con `carga_horaria_total` en `hlc_*`).

---

## 13. Módulo datos personales, Login, Ticket (lectura cruzada)

- Flujo y gating: [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md).
- Personas y DDJJ: [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) + plan unificado.
- Unificación con Ticket otra PC: [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md).

---

## 14. Qué **no** se re-exporta del V1 en listado fijo

Las reglas 1–56 (y similares) de la V1 recogen **reglas de negocio muy específicas** (avisos, artículos, liquidación, guardias, etc.). **No** se duplican aquí; cuando exista módulo/colección equivalente en V2, vivirá en su `MODULO_*_V2.md` o en `PLAN_DESARROLLO_VERSION2.md`. Hasta entonces, **no** asumir en código V2 que un comportamiento de V1 sigue idéntico.

---

## 15. Changelog de este documento

| Fecha | Cambio |
|-------|--------|
| 2026-04-23 | Borrador inicial: basado en espíritu de `.cursorrules` V1 v76 + documentación V2. |

---

## Referencia rápida: documentos a citar con frecuencia

| Tema | Documento |
|------|-----------|
| Marco e independencia V1/V2 | [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) |
| Flujo A–E y gating | [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) |
| Orden de implementación | [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) |
| Reglas y Callables | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) |
| Decisiones A–E | [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) |
| Reglas de negocio transversales (IDs, etc.) | [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) |
