# 📋 PROPUESTA V2: Sistema de Estados de Usuario (Impacto sobre DNI)

**Fecha:** 2025-01-15  
**Versión:** v76  
**Módulo:** Agentes Registrados  
**Estado:** ✅ **PROPUESTA APROBADA - LISTA PARA IMPLEMENTACIÓN**

---

## 🎯 CAMBIO FUNDAMENTAL

**Las acciones impactan sobre el DNI del usuario completo, NO sobre cargos individuales.**

---

## 📊 ESTADOS DE USUARIO

### Estados Definidos

| Estado | Descripción | Condición | Visibilidad |
|--------|-------------|-----------|-------------|
| **REGISTRADO** | Usuario sin cargo asignado | `cargos.length === 0` | Listado principal |
| **ACTIVO** | Usuario con cargo activo | `cargos.some(c => !c.fecha_fin_cargo)` | Listado principal |
| **NO_ACTIVO** | Usuario con todos los cargos finalizados | `cargos.length > 0 && cargos.every(c => c.fecha_fin_cargo && c.fecha_fin_cargo < fecha_actual)` | Listado principal |
| **ARCHIVADO** | Usuario archivado (todos los cargos cumplen condición) | `usuario.archivado === true` | Listado "Agentes Archivados" |
| **ELIMINADO** | Usuario deshabilitado por error | `usuario.estado_registro === 'ELIMINADO'` | Oculto (puede reutilizar DNI) |

---

## 🗄️ CAMBIOS PROPUESTOS EN SCHEMA

### 1. Campo `archivado` en `usuarios`

**Ubicación:** `usuarios.archivado`

```json
{
  "archivado": "boolean", // true si el usuario está archivado
  "fecha_archivado": "Timestamp | null", // Fecha en que se archivó
  "archivado_por": "string (ref usuarios) | null", // Usuario que archivó
  "motivo_archivo": "string | null", // Motivo del archivo (opcional, máx. 200 caracteres)
  "fecha_desarchivado": "Timestamp | null", // Fecha en que se desarchivó (si aplica)
  "desarchivado_por": "string (ref usuarios) | null", // Usuario que desarchivó
  
  // === HISTORIAL DE ARCHIVO/DESARCHIVO ===
  "historial_archivo": [
    {
      "accion": "string", // 'ARCHIVAR' | 'DESARCHIVAR'
      "fecha": "Timestamp",
      "usuario": "string (ref usuarios)",
      "motivo": "string | null",
      "comentarios": "string | null"
    }
  ] // Historial completo de acciones de archivo/desarchivo
}
```

### 2. Campos de eliminación en `usuarios`

**Ubicación:** `usuarios`

```json
{
  "fecha_eliminacion": "Timestamp | null", // Fecha en que se eliminó
  "eliminado_por": "string (ref usuarios) | null", // Usuario que eliminó
  "motivo_eliminacion": "string | null", // Motivo de eliminación (obligatorio al eliminar, máx. 200 caracteres)
  
  // NOTA: NO hay campo fecha_restauracion ni restaurar_usuario
  // La eliminación es IRREVERSIBLE
}
```

### 3. Campo `estado_registro` actualizado

**Ubicación:** `usuarios.estado_registro`

```json
{
  "estado_registro": "string", // 'PENDIENTE' | 'REGISTRADO' | 'ELIMINADO'
  // NOTA: 'ARCHIVADO' NO es un estado_registro, es un campo booleano separado
  // Los usuarios archivados mantienen estado_registro = 'REGISTRADO'
}
```

---

## 🔘 BOTONES DE ACCIONES PROPUESTOS

### 1. **Botón "Archivar Usuario"** 📦

**Ubicación:** En el header de cada agente (en `AgentesRegistradosView.jsx`)

**Condiciones de Visibilidad:**
- Solo visible si el usuario NO está archivado (`usuario.archivado !== true`)
- Solo visible si el usuario NO está eliminado (`usuario.estado_registro !== 'ELIMINADO'`)
- Solo visible para usuarios con rol `RRHH_ADMIN`

**Validación Previa (CRÍTICA):**
```javascript
function puedeArchivarUsuario(usuario) {
  const cargos = usuario.datos_laborales?.cargos || [];
  
  // Si no tiene cargos, NO puede archivarse
  if (cargos.length === 0) {
    return {
      puede: false,
      motivo: 'El usuario no tiene cargos asignados. No se puede archivar.'
    };
  }
  
  const fechaActual = new Date();
  
  // Verificar que TODOS los cargos tengan fecha_fin_cargo
  const todosTienenFechaFin = cargos.every(c => c.fecha_fin_cargo !== null && c.fecha_fin_cargo !== undefined);
  if (!todosTienenFechaFin) {
    return {
      puede: false,
      motivo: 'No se puede archivar. El usuario tiene cargos activos (sin fecha de finalización).'
    };
  }
  
  // Verificar que TODOS los cargos tengan el plazo cumplido (fecha_fin_cargo < fecha_actual)
  const todosPlazosCumplidos = cargos.every(c => {
    const fechaFin = c.fecha_fin_cargo.toDate(); // Convertir Timestamp a Date
    return fechaFin < fechaActual;
  });
  
  if (!todosPlazosCumplidos) {
    return {
      puede: false,
      motivo: 'No se puede archivar. Algunos cargos aún no han cumplido su plazo de finalización.'
    };
  }
  
  return {
    puede: true,
    motivo: null
  };
}
```

**Funcionalidad:**
- Al hacer clic, primero valida que se cumplan las condiciones
- Si NO se cumplen, muestra modal de error con el motivo
- Si se cumplen, abre modal `ModalArchivarUsuario` con:
  - Confirmación del usuario a archivar
  - Lista de cargos (solo lectura, mostrando que todos tienen fecha_fin y plazo cumplido)
  - Campo opcional "Motivo del archivo" (máx. 200 caracteres)
  - Checkbox de confirmación: "Confirmo que este usuario debe ser archivado"
- Al confirmar:
  - Marca `usuario.archivado = true`
  - Establece `usuario.fecha_archivado = Timestamp actual`
  - Establece `usuario.archivado_por = userInfo.uid`
  - Guarda `usuario.motivo_archivo` si se proporciona
  - Agrega entrada a `usuario.historial_archivo[]`
  - Guarda cambios en Firestore
  - El usuario desaparece del listado principal y aparece en "Agentes Archivados"

**Icono:** `Archive` (lucide-react)  
**Color:** `#f59e0b` (amarillo/naranja)  
**Estilo:** Botón secundario con icono

---

### 2. **Botón "Desarchivar Usuario"** 📤

**Ubicación:** En el listado "Agentes Archivados" (nueva vista)

**Condiciones de Visibilidad:**
- Solo visible si el usuario está archivado (`usuario.archivado === true`)
- Solo visible para usuarios con rol `RRHH_ADMIN`

**Funcionalidad:**
- Abre modal `ModalDesarchivarUsuario` con:
  - Confirmación del usuario a desarchivar
  - Campo opcional "Motivo del desarchivo" (máx. 200 caracteres)
  - Checkbox de confirmación: "Confirmo que este usuario debe ser desarchivado"
- Al confirmar:
  - Marca `usuario.archivado = false`
  - Establece `usuario.fecha_desarchivado = Timestamp actual`
  - Establece `usuario.desarchivado_por = userInfo.uid`
  - Agrega entrada a `usuario.historial_archivo[]`
  - Guarda cambios en Firestore
  - El usuario vuelve al listado principal

**Icono:** `ArchiveRestore` (lucide-react)  
**Color:** `#10b981` (verde)  
**Estilo:** Botón secundario con icono

---

### 3. **Botón "Eliminar Usuario"** 🗑️

**Ubicación:** En el header de cada agente (en `AgentesRegistradosView.jsx`)

**Condiciones de Visibilidad:**
- Solo visible si el usuario NO está eliminado (`usuario.estado_registro !== 'ELIMINADO'`)
- Solo visible para usuarios con rol `RRHH_ADMIN`

**Funcionalidad:**
- Abre modal `ModalEliminarUsuario` con **ADVERTENCIAS PREVIAS**:
  - ⚠️ **ADVERTENCIA 1:** "Esta acción deshabilitará el usuario. El DNI podrá reutilizarse para crear un nuevo usuario."
  - ⚠️ **ADVERTENCIA 2:** "Los datos del usuario quedarán ocultos en la base de datos pero NO se eliminarán."
  - ⚠️ **ADVERTENCIA 3:** "Esta acción es IRREVERSIBLE. No podrá restaurar el usuario después de eliminarlo."
  - Lista de cargos del usuario (solo lectura, colapsable)
  - Campo **OBLIGATORIO:** "Motivo de eliminación" (máx. 200 caracteres)
  - Checkbox de confirmación: "He leído y comprendo las advertencias. Confirmo que este usuario debe ser eliminado."
- Al confirmar:
  - Establece `usuario.estado_registro = 'ELIMINADO'`
  - Establece `usuario.fecha_eliminacion = Timestamp actual`
  - Establece `usuario.eliminado_por = userInfo.uid`
  - Establece `usuario.motivo_eliminacion = motivo`
  - Agrega entrada a `usuario.historial_cambios[]`
  - Guarda cambios en Firestore
  - El usuario desaparece de todos los listados (oculto en DB)
  - El DNI queda disponible para crear nuevo usuario

**Icono:** `Trash2` (lucide-react)  
**Color:** `#ef4444` (rojo)  
**Estilo:** Botón de acción peligrosa con icono

**NOTA:** NO existe botón "Restaurar Usuario". La eliminación es IRREVERSIBLE.

---

## 🆕 NUEVO MENÚ: "Agentes Archivados"

### Ubicación en Menú

**Menú:** RRHH → Gestión de Usuarios → Agentes Archivados

**Archivo a modificar:** `src/components/menu/MenuRRHH.jsx`

```jsx
{menuGestionAbierto && (
  <ul className="submenu">
    <MenuItem 
      icon={<UserPlus size={18} />} 
      text="Autorizar Nuevos" 
      active={activeTab === 'autorizar'}
      onClick={() => setActiveTab('autorizar')}
      isSubmenu={true}
    />
    <MenuItem 
      icon={<Users size={18} />} 
      text="Agentes Registrados" 
      active={activeTab === 'registrados'}
      onClick={() => setActiveTab('registrados')}
      isSubmenu={true}
    />
    {/* NUEVO ITEM */}
    <MenuItem 
      icon={<Archive size={18} />} 
      text="Agentes Archivados" 
      active={activeTab === 'archivados'}
      onClick={() => setActiveTab('archivados')}
      isSubmenu={true}
    />
  </ul>
)}
```

### Nueva Vista: `AgentesArchivadosView.jsx`

**Ubicación:** `src/views/AgentesArchivadosView.jsx`

**Funcionalidad:**
- Lista SOLO usuarios con `archivado === true`
- Muestra SOLO:
  - DNI
  - Nombre completo
  - Botón "Desarchivar" (para ver más datos)
- Al hacer clic en "Desarchivar":
  - Abre modal `ModalDesarchivarUsuario`
  - Al confirmar desarchivo, el usuario vuelve a "Agentes Registrados" y se puede ver todos sus datos

**Diseño:**
```jsx
<div className="agentes-archivados-lista">
  {agentesArchivados.map(agente => (
    <div key={agente.id} className="agente-archivado-card">
      <div>
        <strong>DNI: {agente.dni}</strong>
        <div>{agente.nombre_completo || 'Sin nombre'}</div>
      </div>
      <button onClick={() => handleDesarchivar(agente.id)}>
        <ArchiveRestore size={16} />
        Desarchivar
      </button>
    </div>
  ))}
</div>
```

---

## 🔒 VALIDACIONES PROPUESTAS

### 1. Validación en `ModalAutorizarManual.jsx` (Crear Usuario)

**Ubicación:** Antes de crear un nuevo usuario

**Validación:**
```javascript
// Verificar si el DNI ya existe y está en estado que impide reutilización
async function validarDNIParaNuevoUsuario(dni) {
  const usuarioExistente = await obtenerUsuarioPorDNI(dni);
  
  if (!usuarioExistente) {
    return { valido: true, mensaje: null };
  }
  
  // Si el usuario está eliminado, PERMITE reutilizar DNI
  if (usuarioExistente.estado_registro === 'ELIMINADO') {
    return { 
      valido: true, 
      mensaje: '⚠️ Este DNI pertenece a un usuario eliminado. Se creará un nuevo usuario con este DNI.' 
    };
  }
  
  // Si el usuario está archivado, NO permite reutilizar DNI
  if (usuarioExistente.archivado === true) {
    return { 
      valido: false, 
      mensaje: '❌ Este DNI pertenece a un usuario archivado. Debe desarchivar el usuario antes de crear uno nuevo con este DNI.' 
    };
  }
  
  // Si el usuario está activo o registrado, NO permite reutilizar DNI
  if (usuarioExistente.estado_registro === 'REGISTRADO' || 
      usuarioExistente.estado_registro === 'PENDIENTE') {
    return { 
      valido: false, 
      mensaje: '❌ Este DNI ya está registrado en el sistema.' 
    };
  }
  
  return { valido: true, mensaje: null };
}
```

---

## 📐 PLAN DE IMPLEMENTACIÓN

### Fase 1: Actualización de Schema y Utilidades

1. **Actualizar `SCHEMA.md`**
   - Agregar campos `archivado`, `fecha_archivado`, `archivado_por`, `motivo_archivo`, `fecha_desarchivado`, `desarchivado_por`, `historial_archivo` a `usuarios`
   - Agregar campos `fecha_eliminacion`, `eliminado_por`, `motivo_eliminacion` a `usuarios`
   - Documentar que eliminación es IRREVERSIBLE

2. **Crear `src/utils/estadoUsuarioUtils.js`**
   - Función `puedeArchivarUsuario(usuario)` - Valida condiciones para archivar
   - Función `calcularEstadoUsuario(usuario)` - Calcula estado basado en cargos y archivado
   - Función `obtenerUsuariosArchivados(usuarios)` - Filtra usuarios archivados
   - Función `validarDNIParaNuevoUsuario(dni)` - Valida DNI según reglas

---

### Fase 2: Modales de Acción

1. **Crear `src/components/modales/ModalArchivarUsuario.jsx`**
   - Validación previa de condiciones
   - Formulario con motivo opcional
   - Validación de confirmación
   - Guardar cambios en usuario

2. **Crear `src/components/modales/ModalDesarchivarUsuario.jsx`**
   - Formulario con motivo opcional
   - Validación de confirmación
   - Guardar cambios en usuario

3. **Crear `src/components/modales/ModalEliminarUsuario.jsx`**
   - **ADVERTENCIAS PREVIAS** (3 advertencias claras)
   - Formulario con motivo obligatorio
   - Validación de confirmación (checkbox con texto de advertencia)
   - Guardar cambios en usuario

---

### Fase 3: Nueva Vista y Menú

1. **Crear `src/views/AgentesArchivadosView.jsx`**
   - Lista usuarios archivados
   - Muestra solo DNI y nombre completo
   - Botón "Desarchivar" en cada usuario

2. **Actualizar `src/components/menu/MenuRRHH.jsx`**
   - Agregar item "Agentes Archivados" en submenú "Gestión de Usuarios"

3. **Actualizar `src/components/routing/AppRouter.jsx`**
   - Agregar ruta para `activeTab === 'archivados'`
   - Renderizar `AgentesArchivadosView`

---

### Fase 4: Actualización de Componentes Existentes

1. **Actualizar `AgentesRegistradosView.jsx`**
   - Agregar botón "Archivar Usuario" en header de agente
   - Agregar botón "Eliminar Usuario" en header de agente
   - Filtrar usuarios archivados del listado principal
   - Filtrar usuarios eliminados del listado principal

2. **Actualizar `ModalAutorizarManual.jsx`**
   - Integrar validación `validarDNIParaNuevoUsuario()`
   - Mostrar mensajes de error apropiados
   - Permitir crear usuario si DNI pertenece a usuario eliminado

---

### Fase 5: Servicios

1. **Actualizar `src/services/usuariosService.js`**
   - Agregar función `archivarUsuario(usuarioId, motivo, userInfo)`
   - Agregar función `desarchivarUsuario(usuarioId, motivo, userInfo)`
   - Agregar función `eliminarUsuario(usuarioId, motivo, userInfo)`
   - Agregar función `obtenerUsuariosArchivados()`

---

## 🎨 DISEÑO VISUAL PROPUESTO

### Badge de Estado en Header del Agente

```jsx
// ARCHIVADO
{usuario.archivado && (
  <span style={{
    padding: '4px 8px',
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  }}>
    <Archive size={12} />
    ARCHIVADO
  </span>
)}
```

### Vista "Agentes Archivados"

```jsx
<div style={{
  padding: '20px',
  background: '#fff',
  borderRadius: '8px',
  border: '1px solid var(--border)'
}}>
  <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <Archive size={24} />
    Agentes Archivados
  </h2>
  <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
    Lista de usuarios archivados. Para ver más datos, debe desarchivar el usuario.
  </p>
  <div className="agentes-archivados-lista">
    {/* Lista de usuarios */}
  </div>
</div>
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### 1. **Validación de Archivo (CRÍTICA)**
- Debe validar que TODOS los cargos tengan `fecha_fin_cargo`
- Debe validar que TODOS los cargos tengan el plazo cumplido (`fecha_fin_cargo < fecha_actual`)
- Si no se cumplen, mostrar error y NO permitir archivar

### 2. **Eliminación IRREVERSIBLE**
- NO existe botón "Restaurar Usuario"
- Las advertencias deben ser MUY claras
- El checkbox de confirmación debe incluir texto de advertencia

### 3. **Vista "Agentes Archivados"**
- Muestra SOLO DNI y nombre completo
- Para ver más datos, debe desarchivar
- Botón "Desarchivar" visible en cada usuario

### 4. **Regla 74: Principio de Identificación Única (DNI)**
- Los DNI de usuarios archivados NO pueden reutilizarse
- Los DNI de usuarios eliminados SÍ pueden reutilizarse
- La validación debe hacerse en `ModalAutorizarManual.jsx`

### 5. **Auditoría**
- Todas las acciones (archivar, desarchivar, eliminar) deben registrarse en `historial_archivo` o `historial_cambios`
- Incluir usuario que realizó la acción, fecha y motivo

---

## ✅ DECISIONES CONFIRMADAS

1. **¿En "Agentes Archivados", el botón "Desarchivar" debe abrir el modal directamente o primero mostrar un resumen de datos?**
   - ✅ **CONFIRMADO:** Abrir modal directamente

2. **¿Los usuarios archivados deben aparecer con algún indicador visual diferente en "Agentes Registrados" si se filtran?**
   - ✅ **CONFIRMADO:** NO aparecen en "Agentes Registrados" (solo en su vista separada)

3. **¿El historial de archivo debe ser ilimitado o tiene un máximo?**
   - ✅ **CONFIRMADO:** Sin límite

4. **¿Se debe permitir archivar un usuario que tiene cargos activos (sin fecha_fin) si se fuerza el cierre de esos cargos primero?**
   - ✅ **CONFIRMADO:** NO, primero debe finalizar todos los cargos, luego archivar

5. **¿Los usuarios eliminados deben tener alguna vista especial o simplemente no aparecen en ningún listado?**
   - ✅ **CONFIRMADO:** No aparecen en ningún listado (ocultos en DB)

6. **¿El campo "motivo_eliminacion" debe ser obligatorio o opcional?**
   - ✅ **CONFIRMADO:** OBLIGATORIO

---

## ✅ CONCLUSIÓN

Esta propuesta establece un sistema de gestión de estados de usuario basado en el DNI completo, con capacidad de archivar/desarchivar y eliminar usuarios, cumpliendo con todas las condiciones especificadas:

- ✅ Archivar usuario requiere todos los cargos con fecha_fin y plazo cumplido
- ✅ Desarchivar usuario para visualizar datos
- ✅ Eliminar usuario deshabilita DNI, datos ocultos, IRREVERSIBLE
- ✅ NO existe restaurar usuario
- ✅ Nuevo menú "Agentes Archivados" con vista simplificada

**¿Aprobado para implementación?**

