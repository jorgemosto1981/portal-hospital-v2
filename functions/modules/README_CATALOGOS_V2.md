# Catalogos V2 - Mapa tecnico rapido

Este documento resume la modularizacion de `catalogos` para facilitar mantenimiento en V2.

## Estructura actual

- `catalogos.js`
  - Fachada de compatibilidad.
  - Exporta los mismos callables historicos.
  - No contiene logica de negocio.

- `catalogosCore.js`
  - Callables de catalogo general y lectura:
    - `listarColeccion`
    - `guardarOpcion`
    - `listarCatalogoOnboarding`
    - `listarColeccionPublicaTemporal`

- `catalogosLaborales.js`
  - Callable de escritura laboral:
    - `guardarRegistroLaboralTemporal`
  - Validaciones de HLc/HLd/HLg, rango, cruces y warnings.

- `catalogosPersonales.js`
  - Callable de escritura personal:
    - `guardarRegistroPersonalTemporal`
  - Validaciones de personas, formacion, DDJJ y consentimientos.

- `catalogosShared.js`
  - Constantes compartidas.
  - Helpers de normalizacion.
  - Validaciones reutilizables.
  - Helpers de warnings.

## Contrato de compatibilidad

- Los nombres exportados en `catalogos.js` se mantienen:
  - `listarColeccion`
  - `guardarOpcion`
  - `listarCatalogoOnboarding`
  - `listarColeccionPublicaTemporal`
  - `guardarRegistroLaboralTemporal`
  - `guardarRegistroPersonalTemporal`

- `functions/index.js` no requiere cambios mientras se respete este contrato.

## Guia de cambios (donde tocar)

- Cambios en CRUD de catalogos RRHH/configuracion:
  - editar `catalogosCore.js`

- Reglas laborales (HLc/HLd/HLg):
  - editar `catalogosLaborales.js`
  - mover helper comun a `catalogosShared.js` si se reutiliza

- Reglas personales (personas/formacion/DDJJ/consentimientos):
  - editar `catalogosPersonales.js`
  - mover helper comun a `catalogosShared.js` si se reutiliza

- Reglas transversales (parseo, rangos, warnings, colecciones permitidas):
  - editar `catalogosShared.js`

## Convencion de warnings

- Los warnings son no bloqueantes y se devuelven como:
  - `warnings: [{ code, severity: "warning", message, details? }]`

- Usar helper compartido:
  - `pushWarning(warnings, code, message, details?)`

## Verificacion minima sugerida

Despues de cambios en estos archivos, correr:

- `node --check functions/modules/catalogos.js`
- `node --check functions/modules/catalogosCore.js`
- `node --check functions/modules/catalogosLaborales.js`
- `node --check functions/modules/catalogosPersonales.js`
- `node --check functions/modules/catalogosShared.js`

Y revisar lints del directorio `functions/modules`.
