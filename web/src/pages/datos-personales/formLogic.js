const PARENTESCO_OTROS_ID = "CFG_PAR_OTROS";

export function updateDatosPersonalesField({ prevForm, key, value, tipo, modoEdicion }) {
  const next = { ...prevForm, [key]: value };
  if (key === "nombre" || key === "apellido") {
    const nombre = String(key === "nombre" ? value : next.nombre || "").trim();
    const apellido = String(key === "apellido" ? value : next.apellido || "").trim();
    next.nombre_completo_legal = [nombre, apellido].filter(Boolean).join(" ") || "";
  }
  if (key === "persona_id" && tipo === "declaraciones_grupo_familiar" && !modoEdicion) {
    next.declaracion_version = "1";
  }
  return next;
}

export function hydrateDatosPersonales({ record, prevForm, emptyFamiliar }) {
  if (!record || typeof record !== "object") return null;
  const nextForm = {
    ...prevForm,
    dni: String(record.dni || ""),
    nombre: String(record.nombre || ""),
    apellido: String(record.apellido || ""),
    nombre_completo_legal: [String(record.nombre || "").trim(), String(record.apellido || "").trim()]
      .filter(Boolean)
      .join(" "),
    cuil: String(record.cuil || ""),
    fecha_nacimiento: String(record.fecha_nacimiento || ""),
    lugar_nacimiento_id: String(record.lugar_nacimiento_id || ""),
    lugar_nacimiento_texto: String(record.lugar_nacimiento_texto || ""),
    activo: record.activo !== false,
    motivo_baja_id: String(record.motivo_baja_id || ""),
    sexo_genero_id: String(record.sexo_genero_id || ""),
    estado_civil_id: String(record.estado_civil_id || ""),
    nacionalidad_id: String(record.nacionalidad_id || ""),
    telefono_celular: String((record.contacto && record.contacto.telefono_celular) || ""),
    telefono_fijo: String((record.contacto && record.contacto.telefono_fijo) || ""),
    recibe_notificaciones_sms: record.contacto && record.contacto.recibe_notificaciones_sms === true,
    email_personal: String((record.contacto && record.contacto.email_personal) || ""),
    calle: String((record.domicilio && record.domicilio.calle) || ""),
    numero: String((record.domicilio && record.domicilio.numero) || ""),
    piso: String((record.domicilio && record.domicilio.piso) || ""),
    departamento: String((record.domicilio && record.domicilio.departamento) || ""),
    provincia_id: String((record.domicilio && record.domicilio.provincia_id) || ""),
    pais_id: String((record.domicilio && record.domicilio.pais_id) || ""),
    localidad_id: String((record.domicilio && record.domicilio.localidad_id) || ""),
    codigo_postal: String((record.domicilio && record.domicilio.codigo_postal) || ""),
    referencia: String((record.domicilio && record.domicilio.referencia) || ""),
    foto_file: null,
    foto_file_name: String(
      (record.foto_rostro && (record.foto_rostro.storage_path || record.foto_rostro.content_type)) || "",
    ),
    foto_storage_path: String((record.foto_rostro && record.foto_rostro.storage_path) || ""),
    foto_content_type: String((record.foto_rostro && record.foto_rostro.content_type) || ""),
    foto_download_url: String((record.foto_rostro && record.foto_rostro.download_url) || ""),
    persona_id: String(record.persona_id || record.titular_persona_id || ""),
    nivel_estudios_id: String(record.nivel_estudios_id || ""),
    titulo_completo: String(record.titulo_completo || ""),
    duracion_anios: record.duracion_anios == null ? "" : String(record.duracion_anios),
    institucion: String(record.institucion || ""),
    matricula_numero: String(record.matricula_numero || ""),
    especialidad_id: String(record.especialidad_id || ""),
    colegio_id: String(record.colegio_id || ""),
    matricula_jurisdiccion_id: String(record.matricula_jurisdiccion_id || ""),
    estado_declaracion_id: String(record.estado_declaracion_id || ""),
    tipo_consentimiento_id: String(record.tipo_consentimiento_id || ""),
    version_id: String(record.version_id || ""),
    idioma_id: String(record.idioma_id || record.idioma || ""),
    declaracion_version: record.declaracion_version == null ? "1" : String(record.declaracion_version),
  };
  const nextFamiliares =
    Array.isArray(record.familiares) && record.familiares.length > 0
      ? record.familiares.map((f) => ({
          parentesco_id: String(f.parentesco_id || ""),
          parentesco_otro_detalle: String(f.parentesco_otro_detalle || ""),
          nombre: String(f.nombre || ""),
          apellido: String(f.apellido || ""),
          dni: String(f.dni || ""),
          fecha_nacimiento: String(f.fecha_nacimiento || ""),
          convive: f.convive !== false,
          domicilio_familiar: String(f.domicilio_familiar || ""),
          dependiente: f.dependiente === true,
          detalle_dependencia: String(f.detalle_dependencia || ""),
          discapacidad_declarada: f.discapacidad_declarada === true,
          notas_titular: String(f.notas_titular || ""),
        }))
      : [emptyFamiliar()];
  return { form: nextForm, familiares: nextFamiliares };
}

export function validateDatosPersonales({ tipo, form, familiares }) {
  if (tipo === "personas") {
    const obligatorios = [
      ["dni", form.dni],
      ["nombre", form.nombre],
      ["apellido", form.apellido],
      ["fecha_nacimiento", form.fecha_nacimiento],
      ["lugar_nacimiento_id", form.lugar_nacimiento_id],
      ["sexo_genero_id", form.sexo_genero_id],
      ["estado_civil_id", form.estado_civil_id],
      ["nacionalidad_id", form.nacionalidad_id],
      ["contacto.telefono_celular", form.telefono_celular],
      ["contacto.email_personal", form.email_personal],
      ["domicilio.calle", form.calle],
      ["domicilio.numero", form.numero],
      ["domicilio.provincia_id", form.provincia_id],
      ["domicilio.pais_id", form.pais_id],
      ["domicilio.localidad_id", form.localidad_id],
      ["domicilio.codigo_postal", form.codigo_postal],
    ].filter(([, v]) => !String(v || "").trim());
    if (obligatorios.length > 0) {
      return `Completá campos obligatorios en personas: ${obligatorios.map(([k]) => k).join(", ")}.`;
    }
    if (!/^\d{6,12}$/.test(form.dni.trim())) return "DNI inválido (6 a 12 dígitos).";
    if (!form.activo && !String(form.motivo_baja_id || "").trim()) {
      return "Si activo=false, motivo_baja_id es obligatorio.";
    }
  }
  if (tipo === "formacion_agente") {
    if (!form.persona_id.trim()) return "Completá persona_id para formación.";
    if (!String(form.nivel_estudios_id || "").trim()) return "Completá nivel_estudios_id para formación.";
  }
  if (tipo === "declaraciones_grupo_familiar" && !form.persona_id.trim()) {
    return "Completá persona_id titular para DDJJ.";
  }
  if (tipo === "declaraciones_grupo_familiar") {
    const filasConDatos = familiares.filter((f) =>
      [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) => String(v || "").trim()),
    );
    if (filasConDatos.length === 0) return "Debés cargar al menos un familiar en DDJJ.";
    const invalida = filasConDatos.some(
      (f) =>
        !f.parentesco_id.trim() ||
        !f.dni.trim() ||
        !f.nombre.trim() ||
        !f.apellido.trim() ||
        !f.fecha_nacimiento.trim(),
    );
    if (invalida) return "Cada familiar requiere: parentesco_id, dni, nombre, apellido y fecha_nacimiento.";
    const dniInvalido = filasConDatos.some((f) => !/^\d{6,12}$/.test(f.dni.trim()));
    if (dniInvalido) return "Cada familiar debe tener DNI válido (6 a 12 dígitos).";
    const parentescoOtrosInvalido = filasConDatos.some(
      (f) =>
        String(f.parentesco_id || "").toUpperCase() === PARENTESCO_OTROS_ID &&
        !String(f.parentesco_otro_detalle || "").trim(),
    );
    if (parentescoOtrosInvalido) {
      return "Si parentesco_id es CFG_PAR_OTROS, debés completar detalle de parentesco.";
    }
    const conviveInvalido = filasConDatos.some(
      (f) => f.convive === false && !String(f.domicilio_familiar || "").trim(),
    );
    if (conviveInvalido) {
      return "Si no convive, debés informar domicilio_familiar del integrante.";
    }
    const dependienteInvalido = filasConDatos.some(
      (f) => f.dependiente === true && !String(f.detalle_dependencia || "").trim(),
    );
    if (dependienteInvalido) {
      return "Si es dependiente, debés informar detalle_dependencia.";
    }
  }
  if (tipo === "consentimientos" && !form.persona_id.trim()) return "Completá persona_id para consentimiento.";
  if (tipo === "consentimientos" && !form.tipo_consentimiento_id.trim()) {
    return "Seleccioná tipo_consentimiento_id desde catálogo.";
  }
  if (tipo === "consentimientos" && !form.version_id.trim()) {
    return "Seleccioná version_id (texto legal) desde catálogo.";
  }
  return "";
}

export function buildDatosPayload({
  tipo,
  form,
  familiares,
  modoEdicion,
  editId,
  estadoDdjjDefault,
  fotoRostro,
}) {
  let datos;
  if (tipo === "personas") {
    datos = {
      dni: form.dni.trim(),
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      nombre_completo_legal: [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(" ") || null,
      cuil: form.cuil.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      lugar_nacimiento_id: form.lugar_nacimiento_id || null,
      lugar_nacimiento_texto: form.lugar_nacimiento_texto || null,
      activo: form.activo === true,
      motivo_baja_id: form.activo ? null : form.motivo_baja_id || null,
      sexo_genero_id: form.sexo_genero_id || null,
      estado_civil_id: form.estado_civil_id || null,
      nacionalidad_id: form.nacionalidad_id || null,
      contacto: {
        telefono_celular: form.telefono_celular || null,
        telefono_fijo: form.telefono_fijo || null,
        recibe_notificaciones_sms: form.recibe_notificaciones_sms === true,
        email_personal: form.email_personal || null,
      },
      domicilio: {
        calle: form.calle || null,
        numero: form.numero || null,
        piso: form.piso || null,
        departamento: form.departamento || null,
        provincia_id: form.provincia_id || null,
        pais_id: form.pais_id || null,
        localidad_id: form.localidad_id || null,
        codigo_postal: form.codigo_postal || null,
        referencia: form.referencia || null,
      },
      foto_rostro: fotoRostro,
    };
  } else if (tipo === "formacion_agente") {
    datos = {
      persona_id: form.persona_id.trim(),
      nivel_estudios_id: form.nivel_estudios_id || null,
      titulo_completo: form.titulo_completo || null,
      duracion_anios: form.duracion_anios || null,
      institucion: form.institucion || null,
      matricula_numero: form.matricula_numero || null,
      especialidad_id: form.especialidad_id || null,
      colegio_id: form.colegio_id || null,
      matricula_jurisdiccion_id: form.matricula_jurisdiccion_id || null,
    };
  } else if (tipo === "declaraciones_grupo_familiar") {
    const familiaresPayload = familiares
      .filter((f) =>
        [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) => String(v || "").trim()),
      )
      .map((f) => ({
        parentesco_id: f.parentesco_id || null,
        parentesco_otro_detalle:
          String(f.parentesco_id || "").toUpperCase() === PARENTESCO_OTROS_ID
            ? f.parentesco_otro_detalle || null
            : null,
        nombre: f.nombre || null,
        apellido: f.apellido || null,
        dni: f.dni || null,
        fecha_nacimiento: f.fecha_nacimiento || null,
        convive: f.convive === true,
        domicilio_familiar: f.convive === false ? f.domicilio_familiar || null : null,
        dependiente: f.dependiente === true,
        detalle_dependencia: f.dependiente === true ? f.detalle_dependencia || null : null,
        discapacidad_declarada: f.discapacidad_declarada === true,
        notas_titular: f.notas_titular || null,
      }));
    datos = {
      titular_persona_id: form.persona_id.trim(),
      estado_declaracion_id: estadoDdjjDefault,
      declaracion_version: modoEdicion ? Number(form.declaracion_version || 1) : null,
      familiares: familiaresPayload,
    };
  } else {
    datos = {
      persona_id: form.persona_id.trim(),
      tipo_consentimiento_id: form.tipo_consentimiento_id,
      version_id: form.version_id,
      idioma_id: form.idioma_id || null,
      aceptado: true,
    };
  }
  if (modoEdicion && editId) datos.id = editId;
  return datos;
}
