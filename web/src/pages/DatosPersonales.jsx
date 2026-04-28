import Card from "../components/ui/Card.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";

import { guardarRegistroPersonal, listarColeccionPersonal } from "../services/datosPersonalesService.js";
const ESTADO_DDJJ_DEFAULT_PERSONALES = "CFG_DDJJ_03_PRESENTADA";

const COLECCIONES_BASE = [
  "personas",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
];

const COLECCIONES_CFG = [
  "cfg_estado_civil",
  "cfg_nacionalidad",
  "cfg_sexo_genero",
  "cfg_provincia",
  "cfg_localidad",
  "cfg_nivel_estudios",
  "cfg_parentesco",
  "cfg_estado_declaracion_ddjj",
  "cfg_tipo_consentimiento",
  "cfg_textos_legales",
  "cfg_idioma",
];

const HELP = {
  dni: "Documento del agente (solo números).",
  nombre: "Nombre legal del agente.",
  apellido: "Apellido legal del agente.",
  sexo_genero_id: "Identidad de género del catálogo oficial.",
  estado_civil_id: "Estado civil vigente del catálogo.",
  nacionalidad_id: "Nacionalidad según catálogo.",
  telefono_celular: "Teléfono principal para contacto operativo.",
  email_personal: "Correo personal de contacto (no reemplaza cuenta de acceso).",
  calle: "Calle del domicilio.",
  numero: "Altura / número del domicilio.",
  provincia_id: "Provincia del domicilio.",
  localidad_id: "Localidad del domicilio (coherente con provincia).",
  codigo_postal: "Código postal del domicilio.",
  persona_id: "Identificador per_* del titular.",
  nivel_estudios_id: "Nivel de estudios desde catálogo.",
  titulo_completo: "Título alcanzado.",
  duracion_anios: "Duración total de la carrera/formación.",
  institucion: "Institución donde cursó o egresó.",
  estado_declaracion_id:
    "Estado DDJJ fijado en este módulo para alta operativa (presentada).",
  tipo_consentimiento_id: "Tipo de consentimiento desde catálogo.",
  version_id: "Versión de texto legal (catálogo de textos legales).",
  idioma_id: "Idioma del consentimiento (catálogo).",
  declaracion_version: "Versión del trámite DDJJ (número).",
  declaracion_jurada_aceptada: "Indica si el titular marcó aceptación de la DDJJ.",
  aceptada_en: "Fecha/hora de aceptación (si aplica).",
  parentesco_id: "Parentesco del familiar desde catálogo.",
  familiar_nombre: "Nombre del familiar declarado.",
  familiar_apellido: "Apellido del familiar declarado.",
  familiar_dni: "DNI del familiar (si corresponde).",
  familiar_fecha_nacimiento: "Fecha de nacimiento del familiar.",
};

function emptyFamiliar() {
  return {
    parentesco_id: "",
    nombre: "",
    apellido: "",
    dni: "",
    fecha_nacimiento: "",
    convive: false,
    dependiente: false,
    discapacidad_declarada: false,
    notas_titular: "",
  };
}

function toOpts(rows) {
  return (rows || []).map((r) => ({ value: String(r.id), label: String(r.nombre || r.id) }));
}

export default function DatosPersonales() {
  const [tipo, setTipo] = useState("personas");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [editId, setEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [rowsByCol, setRowsByCol] = useState({});
  const [loadingByCol, setLoadingByCol] = useState({});
  const [form, setForm] = useState({
    dni: "",
    nombre: "",
    apellido: "",
    sexo_genero_id: "",
    estado_civil_id: "",
    nacionalidad_id: "",
    telefono_celular: "",
    email_personal: "",
    calle: "",
    numero: "",
    provincia_id: "",
    localidad_id: "",
    codigo_postal: "",
    persona_id: "",
    nivel_estudios_id: "",
    titulo_completo: "",
    duracion_anios: "",
    institucion: "",
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
    await Promise.all(
      cols.map(async (c) => {
        try {
          const rows = await listarColeccionPersonal(c, 120);
          setRowsByCol((p) => ({ ...p, [c]: rows }));
        } finally {
          setLoadingByCol((p) => ({ ...p, [c]: false }));
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
      sexo_genero_id: String(r.sexo_genero_id || ""),
      estado_civil_id: String(r.estado_civil_id || ""),
      nacionalidad_id: String(r.nacionalidad_id || ""),
      telefono_celular: String((r.contacto && r.contacto.telefono_celular) || ""),
      email_personal: String((r.contacto && r.contacto.email_personal) || ""),
      calle: String((r.domicilio && r.domicilio.calle) || ""),
      numero: String((r.domicilio && r.domicilio.numero) || ""),
      provincia_id: String((r.domicilio && r.domicilio.provincia_id) || ""),
      localidad_id: String((r.domicilio && r.domicilio.localidad_id) || ""),
      codigo_postal: String((r.domicilio && r.domicilio.codigo_postal) || ""),
      persona_id: String(r.persona_id || r.titular_persona_id || ""),
      nivel_estudios_id: String(r.nivel_estudios_id || ""),
      titulo_completo: String(r.titulo_completo || ""),
      duracion_anios: r.duracion_anios == null ? "" : String(r.duracion_anios),
      institucion: String(r.institucion || ""),
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
      if (!form.dni.trim() || !form.nombre.trim() || !form.apellido.trim()) {
        return "Completá dni, nombre y apellido.";
      }
      if (!/^\d{6,12}$/.test(form.dni.trim())) return "DNI inválido (6 a 12 dígitos).";
    }
    if (tipo === "formacion_agente" && !form.persona_id.trim()) {
      return "Completá persona_id para formación.";
    }
    if (tipo === "declaraciones_grupo_familiar" && !form.persona_id.trim()) {
      return "Completá persona_id titular para DDJJ.";
    }
    if (tipo === "declaraciones_grupo_familiar") {
      const hayFilaValida = familiares.some(
        (f) => f.parentesco_id.trim() || f.nombre.trim() || f.apellido.trim(),
      );
      if (hayFilaValida) {
        const invalida = familiares.some(
          (f) =>
            (f.parentesco_id.trim() || f.nombre.trim() || f.apellido.trim()) &&
            (!f.parentesco_id.trim() || !f.nombre.trim() || !f.apellido.trim()),
        );
        if (invalida) {
          return "Cada familiar cargado requiere parentesco_id, nombre y apellido.";
        }
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
      if (tipo === "personas") {
        datos = {
          dni: form.dni.trim(),
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          sexo_genero_id: form.sexo_genero_id || null,
          estado_civil_id: form.estado_civil_id || null,
          nacionalidad_id: form.nacionalidad_id || null,
          contacto: {
            telefono_celular: form.telefono_celular || null,
            email_personal: form.email_personal || null,
          },
          domicilio: {
            calle: form.calle || null,
            numero: form.numero || null,
            provincia_id: form.provincia_id || null,
            localidad_id: form.localidad_id || null,
            codigo_postal: form.codigo_postal || null,
          },
        };
      } else if (tipo === "formacion_agente") {
        datos = {
          persona_id: form.persona_id.trim(),
          nivel_estudios_id: form.nivel_estudios_id || null,
          titulo_completo: form.titulo_completo || null,
          duracion_anios: form.duracion_anios || null,
          institucion: form.institucion || null,
        };
      } else if (tipo === "declaraciones_grupo_familiar") {
        const familiaresPayload = familiares
          .filter((f) => f.parentesco_id.trim() || f.nombre.trim() || f.apellido.trim())
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
          texto_hash: form.version_id || "pendiente",
          aceptado: false,
        };
      }
      if (modoEdicion && editId) datos.id = editId;
      const r = await guardarRegistroPersonal(tipo, datos);
      setSaveMsg(`Guardado OK: ${r.id || "(sin id)"}`);
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
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Colección</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                >
                  <option value="personas">personas</option>
                  <option value="formacion_agente">formacion_agente</option>
                  <option value="declaraciones_grupo_familiar">declaraciones_grupo_familiar</option>
                  <option value="consentimientos">consentimientos</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={modoEdicion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModoEdicion(checked);
                    setEditId("");
                    if (!checked) return;
                    const first = registros[0];
                    if (first && first.id) {
                      setEditId(String(first.id));
                      hydrateFrom(first);
                    }
                  }}
                />
                Editar existente
              </label>
            </div>

            {modoEdicion && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Registro</label>
                <select
                  value={editId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEditId(id);
                    const item = registros.find((x) => String(x.id) === String(id));
                    if (item) hydrateFrom(item);
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                >
                  <option value="">Seleccionar registro...</option>
                  {registros.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(tipo === "personas" || tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos") && (
              <div className="grid gap-3 md:grid-cols-2">
                {tipo === "personas" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">dni *</label>
                      <input value={form.dni} onChange={(e) => setField("dni", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.dni}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">nombre *</label>
                      <input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.nombre}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">apellido *</label>
                      <input value={form.apellido} onChange={(e) => setField("apellido", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.apellido}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">sexo_genero_id</label>
                      <select value={form.sexo_genero_id} onChange={(e) => setField("sexo_genero_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsSexo.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.sexo_genero_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">estado_civil_id</label>
                      <select value={form.estado_civil_id} onChange={(e) => setField("estado_civil_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsCivil.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.estado_civil_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">nacionalidad_id</label>
                      <select value={form.nacionalidad_id} onChange={(e) => setField("nacionalidad_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsNac.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.nacionalidad_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">telefono_celular</label>
                      <input value={form.telefono_celular} onChange={(e) => setField("telefono_celular", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.telefono_celular}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">email_personal</label>
                      <input value={form.email_personal} onChange={(e) => setField("email_personal", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.email_personal}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">calle</label>
                      <input value={form.calle} onChange={(e) => setField("calle", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.calle}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">numero</label>
                      <input value={form.numero} onChange={(e) => setField("numero", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.numero}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">provincia_id</label>
                      <select value={form.provincia_id} onChange={(e) => setField("provincia_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsProv.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.provincia_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">localidad_id</label>
                      <select value={form.localidad_id} onChange={(e) => setField("localidad_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsLoc.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.localidad_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">codigo_postal</label>
                      <input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.codigo_postal}</p>
                    </div>
                  </>
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
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">nivel_estudios_id</label>
                      <select value={form.nivel_estudios_id} onChange={(e) => setField("nivel_estudios_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
                        <option value="">Seleccionar...</option>
                        {optsNivel.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.nivel_estudios_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">titulo_completo</label>
                      <input value={form.titulo_completo} onChange={(e) => setField("titulo_completo", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.titulo_completo}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">duracion_anios</label>
                      <input value={form.duracion_anios} onChange={(e) => setField("duracion_anios", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.duracion_anios}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">institucion</label>
                      <input value={form.institucion} onChange={(e) => setField("institucion", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
                      <p className="mt-1 text-xs text-slate-500">{HELP.institucion}</p>
                    </div>
                  </>
                )}

                {tipo === "declaraciones_grupo_familiar" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">estado_declaracion_id (fijo)</label>
                      <input
                        value={ESTADO_DDJJ_DEFAULT_PERSONALES}
                        disabled
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                      />
                      <p className="mt-1 text-xs text-slate-500">{HELP.estado_declaracion_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">declaracion_version (automática)</label>
                      <input
                        value={modoEdicion ? form.declaracion_version : nextDeclaracionVersion}
                        disabled
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                      />
                      <p className="mt-1 text-xs text-slate-500">{HELP.declaracion_version}</p>
                    </div>
                    <p className="md:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      `declaracion_jurada_aceptada` y `aceptada_en` no se cargan manualmente en esta pantalla.
                      Se resuelven por el flujo de validación/aceptación posterior según el estado DDJJ.
                    </p>

                    <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Familiares declarados</p>
                        <button
                          type="button"
                          onClick={() => setFamiliares((prev) => [...prev, emptyFamiliar()])}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                        >
                          Agregar familiar
                        </button>
                      </div>
                      <div className="space-y-3">
                        {familiares.map((f, idx) => (
                          <div key={`fam-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Familiar {idx + 1}
                              </p>
                              {familiares.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFamiliares((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="text-xs font-semibold text-rose-600"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="block text-sm font-medium text-slate-700">parentesco_id</label>
                                <select
                                  value={f.parentesco_id}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, parentesco_id: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                >
                                  <option value="">Seleccionar...</option>
                                  {optsParentesco.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700">dni</label>
                                <input
                                  value={f.dni}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, dni: e.target.value } : x)),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700">nombre</label>
                                <input
                                  value={f.nombre}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700">apellido</label>
                                <input
                                  value={f.apellido}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, apellido: e.target.value } : x)),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700">fecha_nacimiento</label>
                                <input
                                  type="date"
                                  value={f.fecha_nacimiento}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, fecha_nacimiento: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700">notas_titular</label>
                                <input
                                  value={f.notas_titular}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, notas_titular: e.target.value } : x,
                                      ),
                                    )
                                  }
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                                />
                              </div>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={f.convive}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, convive: e.target.checked } : x)),
                                    )
                                  }
                                />
                                Convive
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={f.dependiente}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, dependiente: e.target.checked } : x,
                                      ),
                                    )
                                  }
                                />
                                Dependiente
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={f.discapacidad_declarada}
                                  onChange={(e) =>
                                    setFamiliares((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? { ...x, discapacidad_declarada: e.target.checked }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                Discapacidad declarada
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tipo === "consentimientos" && (
                  <>
                    <p className="md:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Etapa base: esta pantalla registra referencia de consentimiento (persona/tipo/versión/idioma).
                      La aceptación legal completa (`aceptado`, `aceptado_en`, hash final del texto) se desarrollará
                      en un módulo específico en la siguiente etapa.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">tipo_consentimiento_id *</label>
                      <select
                        value={form.tipo_consentimiento_id}
                        onChange={(e) => setField("tipo_consentimiento_id", e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                      >
                        <option value="">Seleccionar...</option>
                        {optsTipoConsent.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.tipo_consentimiento_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">version_id *</label>
                      <select
                        value={form.version_id}
                        onChange={(e) => setField("version_id", e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                      >
                        <option value="">Seleccionar...</option>
                        {optsTextosLegales.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.version_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">idioma_id</label>
                      <select
                        value={form.idioma_id}
                        onChange={(e) => setField("idioma_id", e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                      >
                        <option value="">Seleccionar...</option>
                        {optsIdioma.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{HELP.idioma_id}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {saveMsg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${saveMsg.startsWith("Guardado OK") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
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
                  {loadingByCol[c] ? "Cargando..." : `Registros: ${(rowsByCol[c] || []).length}`}
                </p>
                {(rowsByCol[c] || []).slice(0, 3).map((r) => (
                  <p key={r.id} className="mt-1 font-mono text-xs text-slate-600">
                    {r.id}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
