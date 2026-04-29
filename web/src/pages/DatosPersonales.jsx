import Card from "../components/ui/Card.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { guardarRegistroPersonal, listarColeccionPersonal } from "../services/datosPersonalesService.js";
import { storageV2 } from "../services/firebase.js";
import {
  COLECCIONES_BASE,
  COLECCIONES_CFG,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  HELP,
} from "./datos-personales/constants.js";
import FormHeaderControls from "./datos-personales/sections/FormHeaderControls.jsx";
import ConsentimientosFields from "./datos-personales/sections/ConsentimientosFields.jsx";
import DdjjFields from "./datos-personales/sections/DdjjFields.jsx";
import FormacionFields from "./datos-personales/sections/FormacionFields.jsx";
import PersonaFields from "./datos-personales/sections/PersonaFields.jsx";
import { emptyFamiliar, normalizarWarnings, toOpts } from "./datos-personales/utils.js";

export default function DatosPersonales() {
  const [tipo, setTipo] = useState("personas");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [editId, setEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [rowsByCol, setRowsByCol] = useState({});
  const [loadingByCol, setLoadingByCol] = useState({});
  const [progressByCol, setProgressByCol] = useState({});
  const [durationByCol, setDurationByCol] = useState({});
  const [form, setForm] = useState({
    dni: "",
    nombre: "",
    apellido: "",
    nombre_completo_legal: "",
    cuil: "",
    fecha_nacimiento: "",
    lugar_nacimiento_id: "",
    lugar_nacimiento_texto: "",
    activo: true,
    motivo_baja_id: "",
    sexo_genero_id: "",
    estado_civil_id: "",
    nacionalidad_id: "",
    telefono_celular: "",
    telefono_fijo: "",
    recibe_notificaciones_sms: false,
    email_personal: "",
    calle: "",
    numero: "",
    piso: "",
    departamento: "",
    provincia_id: "",
    pais_id: "",
    localidad_id: "",
    codigo_postal: "",
    referencia: "",
    foto_file: null,
    foto_file_name: "",
    foto_storage_path: "",
    foto_content_type: "",
    foto_download_url: "",
    persona_id: "",
    nivel_estudios_id: "",
    titulo_completo: "",
    duracion_anios: "",
    institucion: "",
    matricula_numero: "",
    especialidad_id: "",
    colegio_id: "",
    matricula_jurisdiccion_id: "",
    estado_declaracion_id: "",
    declaracion_version: "1",
    tipo_consentimiento_id: "",
    version_id: "",
    idioma_id: "",
  });
  const [familiares, setFamiliares] = useState([emptyFamiliar()]);

  const cargar = useCallback(async () => {
    const cols = [...COLECCIONES_BASE, ...COLECCIONES_CFG];
    const init = {};
    cols.forEach((c) => {
      init[c] = true;
    });
    setLoadingByCol(init);
    setProgressByCol({});
    setDurationByCol({});
    await Promise.all(
      cols.map(async (c) => {
        const startedAt = Date.now();
        try {
          const rows = await listarColeccionPersonal(c, null, ({ loaded }) => {
            setProgressByCol((p) => ({ ...p, [c]: loaded }));
          });
          setRowsByCol((p) => ({ ...p, [c]: rows }));
        } finally {
          setLoadingByCol((p) => ({ ...p, [c]: false }));
          setDurationByCol((p) => ({ ...p, [c]: Date.now() - startedAt }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    setModoEdicion(false);
    setEditId("");
    setSaveMsg("");
  }, [tipo]);

  const registros = rowsByCol[tipo] || [];
  const optsSexo = useMemo(() => toOpts(rowsByCol.cfg_sexo_genero), [rowsByCol.cfg_sexo_genero]);
  const optsCivil = useMemo(() => toOpts(rowsByCol.cfg_estado_civil), [rowsByCol.cfg_estado_civil]);
  const optsNac = useMemo(() => toOpts(rowsByCol.cfg_nacionalidad), [rowsByCol.cfg_nacionalidad]);
  const optsProv = useMemo(() => toOpts(rowsByCol.cfg_provincia), [rowsByCol.cfg_provincia]);
  const optsPais = useMemo(() => toOpts(rowsByCol.cfg_pais), [rowsByCol.cfg_pais]);
  const optsLoc = useMemo(() => toOpts(rowsByCol.cfg_localidad), [rowsByCol.cfg_localidad]);
  const optsNivel = useMemo(() => toOpts(rowsByCol.cfg_nivel_estudios), [rowsByCol.cfg_nivel_estudios]);
  const optsTipoConsent = useMemo(
    () => toOpts(rowsByCol.cfg_tipo_consentimiento),
    [rowsByCol.cfg_tipo_consentimiento],
  );
  const optsTextosLegales = useMemo(
    () => toOpts(rowsByCol.cfg_textos_legales),
    [rowsByCol.cfg_textos_legales],
  );
  const optsIdioma = useMemo(() => toOpts(rowsByCol.cfg_idioma), [rowsByCol.cfg_idioma]);
  const optsParentesco = useMemo(() => toOpts(rowsByCol.cfg_parentesco), [rowsByCol.cfg_parentesco]);
  const optsMotivoBaja = useMemo(
    () => toOpts(rowsByCol.cfg_motivo_baja_persona),
    [rowsByCol.cfg_motivo_baja_persona],
  );
  const optsEspecialidad = useMemo(
    () => toOpts(rowsByCol.cfg_especialidad),
    [rowsByCol.cfg_especialidad],
  );
  const optsColegio = useMemo(() => toOpts(rowsByCol.cfg_colegio), [rowsByCol.cfg_colegio]);
  const optsJurisdiccionMatricula = useMemo(
    () => toOpts(rowsByCol.cfg_jurisdiccion_matricula),
    [rowsByCol.cfg_jurisdiccion_matricula],
  );
  const nextDeclaracionVersion = useMemo(() => {
    if (tipo !== "declaraciones_grupo_familiar" || !form.persona_id) return "1";
    const rows = rowsByCol.declaraciones_grupo_familiar || [];
    const versions = rows
      .filter((r) => String(r.titular_persona_id || "") === String(form.persona_id))
      .map((r) => Number(r.declaracion_version))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (versions.length === 0) return "1";
    return String(Math.max(...versions) + 1);
  }, [form.persona_id, rowsByCol.declaraciones_grupo_familiar, tipo]);
  const optsPersonas = useMemo(
    () =>
      (rowsByCol.personas || []).map((p) => ({
        value: String(p.id),
        label: p.nombre || p.apellido ? `${p.apellido || ""} ${p.nombre || ""} (${p.id})` : String(p.id),
      })),
    [rowsByCol.personas],
  );

  function setField(key, value) {
    setForm((p) => {
      const next = { ...p, [key]: value };
      if (key === "nombre" || key === "apellido") {
        const nombre = String(key === "nombre" ? value : next.nombre || "").trim();
        const apellido = String(key === "apellido" ? value : next.apellido || "").trim();
        next.nombre_completo_legal = [nombre, apellido].filter(Boolean).join(" ") || "";
      }
      if (key === "persona_id" && tipo === "declaraciones_grupo_familiar" && !modoEdicion) {
        next.declaracion_version = "1";
      }
      return next;
    });
  }

  function hydrateFrom(r) {
    if (!r || typeof r !== "object") return;
    setForm((p) => ({
      ...p,
      dni: String(r.dni || ""),
      nombre: String(r.nombre || ""),
      apellido: String(r.apellido || ""),
      nombre_completo_legal: [String(r.nombre || "").trim(), String(r.apellido || "").trim()]
        .filter(Boolean)
        .join(" "),
      cuil: String(r.cuil || ""),
      fecha_nacimiento: String(r.fecha_nacimiento || ""),
      lugar_nacimiento_id: String(r.lugar_nacimiento_id || ""),
      lugar_nacimiento_texto: String(r.lugar_nacimiento_texto || ""),
      activo: r.activo !== false,
      motivo_baja_id: String(r.motivo_baja_id || ""),
      sexo_genero_id: String(r.sexo_genero_id || ""),
      estado_civil_id: String(r.estado_civil_id || ""),
      nacionalidad_id: String(r.nacionalidad_id || ""),
      telefono_celular: String((r.contacto && r.contacto.telefono_celular) || ""),
      telefono_fijo: String((r.contacto && r.contacto.telefono_fijo) || ""),
      recibe_notificaciones_sms: r.contacto && r.contacto.recibe_notificaciones_sms === true,
      email_personal: String((r.contacto && r.contacto.email_personal) || ""),
      calle: String((r.domicilio && r.domicilio.calle) || ""),
      numero: String((r.domicilio && r.domicilio.numero) || ""),
      piso: String((r.domicilio && r.domicilio.piso) || ""),
      departamento: String((r.domicilio && r.domicilio.departamento) || ""),
      provincia_id: String((r.domicilio && r.domicilio.provincia_id) || ""),
      pais_id: String((r.domicilio && r.domicilio.pais_id) || ""),
      localidad_id: String((r.domicilio && r.domicilio.localidad_id) || ""),
      codigo_postal: String((r.domicilio && r.domicilio.codigo_postal) || ""),
      referencia: String((r.domicilio && r.domicilio.referencia) || ""),
      foto_file: null,
      foto_file_name: String(
        (r.foto_rostro && (r.foto_rostro.storage_path || r.foto_rostro.content_type)) || "",
      ),
      foto_storage_path: String((r.foto_rostro && r.foto_rostro.storage_path) || ""),
      foto_content_type: String((r.foto_rostro && r.foto_rostro.content_type) || ""),
      foto_download_url: String((r.foto_rostro && r.foto_rostro.download_url) || ""),
      persona_id: String(r.persona_id || r.titular_persona_id || ""),
      nivel_estudios_id: String(r.nivel_estudios_id || ""),
      titulo_completo: String(r.titulo_completo || ""),
      duracion_anios: r.duracion_anios == null ? "" : String(r.duracion_anios),
      institucion: String(r.institucion || ""),
      matricula_numero: String(r.matricula_numero || ""),
      especialidad_id: String(r.especialidad_id || ""),
      colegio_id: String(r.colegio_id || ""),
      matricula_jurisdiccion_id: String(r.matricula_jurisdiccion_id || ""),
      estado_declaracion_id: String(r.estado_declaracion_id || ""),
      tipo_consentimiento_id: String(r.tipo_consentimiento_id || ""),
      version_id: String(r.version_id || ""),
      idioma_id: String(r.idioma_id || r.idioma || ""),
      declaracion_version:
        r.declaracion_version == null ? "1" : String(r.declaracion_version),
    }));
    if (Array.isArray(r.familiares) && r.familiares.length > 0) {
      setFamiliares(
        r.familiares.map((f) => ({
          parentesco_id: String(f.parentesco_id || ""),
          nombre: String(f.nombre || ""),
          apellido: String(f.apellido || ""),
          dni: String(f.dni || ""),
          fecha_nacimiento: String(f.fecha_nacimiento || ""),
          convive: f.convive === true,
          dependiente: f.dependiente === true,
          discapacidad_declarada: f.discapacidad_declarada === true,
          notas_titular: String(f.notas_titular || ""),
        })),
      );
    } else {
      setFamiliares([emptyFamiliar()]);
    }
  }

  function validar() {
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
      if (!String(form.nivel_estudios_id || "").trim()) {
        return "Completá nivel_estudios_id para formación.";
      }
    }
    if (tipo === "declaraciones_grupo_familiar" && !form.persona_id.trim()) {
      return "Completá persona_id titular para DDJJ.";
    }
    if (tipo === "declaraciones_grupo_familiar") {
      const filasConDatos = familiares.filter((f) =>
        [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) => String(v || "").trim()),
      );
      if (filasConDatos.length === 0) {
        return "Debés cargar al menos un familiar en DDJJ.";
      }
      const invalida = filasConDatos.some(
        (f) =>
          !f.parentesco_id.trim() ||
          !f.dni.trim() ||
          !f.nombre.trim() ||
          !f.apellido.trim() ||
          !f.fecha_nacimiento.trim(),
      );
      if (invalida) {
        return "Cada familiar requiere: parentesco_id, dni, nombre, apellido y fecha_nacimiento.";
      }
      const dniInvalido = filasConDatos.some((f) => !/^\d{6,12}$/.test(f.dni.trim()));
      if (dniInvalido) {
        return "Cada familiar debe tener DNI válido (6 a 12 dígitos).";
      }
    }
    if (tipo === "consentimientos" && !form.persona_id.trim()) {
      return "Completá persona_id para consentimiento.";
    }
    if (tipo === "consentimientos" && !form.tipo_consentimiento_id.trim()) {
      return "Seleccioná tipo_consentimiento_id desde catálogo.";
    }
    if (tipo === "consentimientos" && !form.version_id.trim()) {
      return "Seleccioná version_id (texto legal) desde catálogo.";
    }
    return "";
  }

  async function subirFotoRostro(file, dni) {
    const safeDni = String(dni || "sin-dni").replace(/[^\dA-Za-z_-]/g, "") || "sin-dni";
    const safeName = String(file.name || "foto").replace(/[^\w.\-]/g, "_");
    const path = `personas/foto_rostro/${safeDni}/${Date.now()}_${safeName}`;
    const storageRef = ref(storageV2, path);
    const snap = await uploadBytes(storageRef, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "public,max-age=3600",
    });
    const downloadUrl = await getDownloadURL(snap.ref);
    return {
      storage_path: snap.metadata.fullPath || path,
      content_type: snap.metadata.contentType || file.type || null,
      download_url: downloadUrl,
      origen_captura: "adjunto_o_camara",
      subido_en: new Date().toISOString(),
    };
  }

  async function onSave(e) {
    e.preventDefault();
    setSaveMsg("");
    const err = validar();
    if (err) {
      setSaveMsg(err);
      return;
    }
    setSaving(true);
    try {
      let datos = {};
      let warnings = [];
      if (tipo === "personas") {
        let fotoRostro = null;
        if (form.foto_file) {
          fotoRostro = await subirFotoRostro(form.foto_file, form.dni);
        } else if (form.foto_storage_path || form.foto_content_type || form.foto_download_url) {
          fotoRostro = {
            storage_path: form.foto_storage_path || null,
            content_type: form.foto_content_type || null,
            download_url: form.foto_download_url || null,
            origen_captura: "adjunto_o_camara",
          };
        }
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
            [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) =>
              String(v || "").trim(),
            ),
          )
          .map((f) => ({
            parentesco_id: f.parentesco_id || null,
            nombre: f.nombre || null,
            apellido: f.apellido || null,
            dni: f.dni || null,
            fecha_nacimiento: f.fecha_nacimiento || null,
            convive: f.convive === true,
            dependiente: f.dependiente === true,
            discapacidad_declarada: f.discapacidad_declarada === true,
            notas_titular: f.notas_titular || null,
          }));
        datos = {
          titular_persona_id: form.persona_id.trim(),
          estado_declaracion_id: ESTADO_DDJJ_DEFAULT_PERSONALES,
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
      const r = await guardarRegistroPersonal(tipo, datos);
      warnings = normalizarWarnings(r && r.warnings);
      const baseOk = `Guardado OK: ${r.id || "(sin id)"}`;
      if (warnings.length === 0) {
        setSaveMsg(baseOk);
      } else {
        const detalleWarnings = warnings
          .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
          .join(" | ");
        setSaveMsg(`${baseOk} | Advertencias: ${detalleWarnings}`);
      }
      await cargar();
    } catch (ex) {
      setSaveMsg(ex instanceof Error ? ex.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Datos personales</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pantalla operativa de datos personales con conexión directa a Firestore (sin datos ficticios).
          </p>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Carga/edición de registros</p>
          <p className="mt-1 text-sm text-slate-600">
            Elegí colección objetivo y completá los campos requeridos. Los seleccionables se cargan desde
            catálogos en BD.
          </p>
          <form className="mt-4 space-y-4" onSubmit={onSave}>
            <FormHeaderControls
              tipo={tipo}
              setTipo={setTipo}
              modoEdicion={modoEdicion}
              setModoEdicion={setModoEdicion}
              setEditId={setEditId}
              registros={registros}
              hydrateFrom={hydrateFrom}
              editId={editId}
            />

            {(tipo === "personas" || tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos") && (
              <div className="grid gap-3 md:grid-cols-2">
                {tipo === "personas" && (
                  <PersonaFields
                    form={form}
                    setField={setField}
                    HELP={HELP}
                    optsLoc={optsLoc}
                    optsMotivoBaja={optsMotivoBaja}
                    optsSexo={optsSexo}
                    optsCivil={optsCivil}
                    optsNac={optsNac}
                    optsProv={optsProv}
                    optsPais={optsPais}
                  />
                )}

                {(tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">persona_id *</label>
                    <select
                      value={form.persona_id}
                      onChange={(e) => setField("persona_id", e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                    >
                      <option value="">Seleccionar persona...</option>
                      {optsPersonas.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">{HELP.persona_id}</p>
                  </div>
                )}

                {tipo === "formacion_agente" && (
                  <FormacionFields
                    form={form}
                    setField={setField}
                    HELP={HELP}
                    optsNivel={optsNivel}
                    optsEspecialidad={optsEspecialidad}
                    optsColegio={optsColegio}
                    optsJurisdiccionMatricula={optsJurisdiccionMatricula}
                  />
                )}

                {tipo === "declaraciones_grupo_familiar" && (
                  <DdjjFields
                    ESTADO_DDJJ_DEFAULT_PERSONALES={ESTADO_DDJJ_DEFAULT_PERSONALES}
                    HELP={HELP}
                    modoEdicion={modoEdicion}
                    form={form}
                    nextDeclaracionVersion={nextDeclaracionVersion}
                    setFamiliares={setFamiliares}
                    emptyFamiliar={emptyFamiliar}
                    familiares={familiares}
                    optsParentesco={optsParentesco}
                  />
                )}

                {tipo === "consentimientos" && (
                  <ConsentimientosFields
                    form={form}
                    setField={setField}
                    HELP={HELP}
                    optsTipoConsent={optsTipoConsent}
                    optsTextosLegales={optsTextosLegales}
                    optsIdioma={optsIdioma}
                  />
                )}
              </div>
            )}

            {saveMsg && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  saveMsg.startsWith("Guardado OK")
                    ? saveMsg.includes("Advertencias:")
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios en BD" : "Guardar en BD"}
              </button>
            </div>
          </form>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Colecciones y registros (vista rápida)</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {COLECCIONES_BASE.map((c) => (
              <div key={c} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c}</p>
                <p className="mt-1 text-sm text-slate-700">
                  {loadingByCol[c]
                    ? `Cargando...${Number(progressByCol[c] || 0) > 0 ? ` (${progressByCol[c]} cargados)` : ""}`
                    : `Registros: ${(rowsByCol[c] || []).length}${Number(durationByCol[c] || 0) > 0 ? ` · ${durationByCol[c]} ms` : ""}`}
                </p>
                {(rowsByCol[c] || []).slice(0, 3).map((r) => (
                  <div key={r.id} className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <p className="font-mono text-xs text-slate-700">{r.id}</p>
                    {c === "consentimientos" && (
                      <>
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          texto_hash:{" "}
                          <span className="font-mono text-[10px] text-slate-500">
                            {String(r.texto_hash || "—")}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          aceptado_en:{" "}
                          <span className="font-mono text-[10px] text-slate-500">
                            {String(r.aceptado_en || "—")}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
