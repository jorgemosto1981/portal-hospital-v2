import Card from "../components/ui/Card.jsx";
import { DATOS_LABORALES_COLECCIONES } from "../constants/datosLaboralesSchema.js";
import { guardarRegistroLaboral, listarColeccionLaboral } from "../services/datosLaboralesService.js";
import { useCallback, useEffect, useState } from "react";

function BadgeCampo({ campo }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {campo}
    </span>
  );
}

function formatValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{...}";
  return String(v);
}

function formatCargaPorDia(v) {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((x) => (x == null ? "-" : String(x))).join(" / ");
}

function isoToDateInput(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function takeFirst(items, max = 5) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

const COLECCIONES_FORM = [
  "personas",
  "cfg_estado_asignacion_laboral",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_categorias",
  "cfg_rol",
  "cfg_cargo_funcional",
];

const AYUDA_CAMPOS = {
  persona_id: "Identificador único de persona (per_*). Ancla principal del legajo.",
  grupo_de_trabajo_id: "Unidad operativa del organigrama donde se desempeña.",
  efector_designacion_id: "Efector donde fue designado formalmente.",
  efector_cumplimiento_id: "Efector donde cumple funciones efectivamente.",
  estado_asignacion_id: "Estado administrativo actual de la asignación.",
  cargo_funcional_id: "Cargo funcional del puesto (desde catálogo).",
  categoria_id: "Categoría laboral del cargo (desde catálogo).",
  carga_horaria_total: "Carga horaria total del cargo (en horas).",
  fecha_desde: "Fecha de inicio de vigencia del registro.",
  fecha_hasta: "Fecha de fin de vigencia (vacío = abierto).",
  cargo_id: "Referencia al registro HLc base del puesto.",
  rol_id: "Rol funcional del agente en ese cargo.",
  escalafon_id: "Escalafón administrativo/laboral del cargo.",
  agrupamiento_id: "Agrupamiento laboral del cargo.",
  funcion_real_id: "Función real desempeñada.",
  nivel_jerarquico: "Nivel jerárquico numérico (1 a 99).",
  dato_laboral_id: "Referencia al registro HLd del que depende este subnivel.",
  carga_por_dia_semana: "Carga distribuida por día (Lun..Dom) separada por coma. Ej: 6,6,6,6,6,0,0",
};

function crearIndicePorId(rows) {
  const idx = new Map();
  (rows || []).forEach((row) => {
    if (row && row.id) idx.set(String(row.id), row);
  });
  return idx;
}

function labelDesdeIndice(idx, id, campo = "nombre") {
  if (!id) return "—";
  const row = idx.get(String(id));
  if (!row) return String(id);
  return row[campo] ? String(row[campo]) : String(id);
}

export default function DatosLaborales() {
  const [rowsByCollection, setRowsByCollection] = useState({});
  const [loadingByCollection, setLoadingByCollection] = useState({});
  const [errorByCollection, setErrorByCollection] = useState({});
  const [tipoAlta, setTipoAlta] = useState("historial_laboral_cargos");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [registroEditId, setRegistroEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [formData, setFormData] = useState({
    persona_id: "",
    grupo_de_trabajo_id: "",
    efector_designacion_id: "",
    efector_cumplimiento_id: "",
    estado_asignacion_id: "",
    carga_horaria_total: "",
    fecha_desde: "",
    fecha_hasta: "",
    cargo_id: "",
    cargo_funcional_id: "",
    categoria_id: "",
    rol_id: "",
    escalafon_id: "",
    agrupamiento_id: "",
    funcion_real_id: "",
    nivel_jerarquico: "",
    dato_laboral_id: "",
    carga_por_dia_semana: "",
  });

  const cargarTodo = useCallback(async () => {
    const initialLoading = {};
    const collections = [
      ...DATOS_LABORALES_COLECCIONES.map((item) => item.collectionName),
      ...COLECCIONES_FORM,
    ];
    collections.forEach((collectionName) => {
      initialLoading[collectionName] = true;
    });
    setLoadingByCollection(initialLoading);

    await Promise.all(
      collections.map(async (collectionName) => {
        try {
          const rows = await listarColeccionLaboral(collectionName, 80);
          setRowsByCollection((prev) => ({ ...prev, [collectionName]: rows }));
          setErrorByCollection((prev) => ({ ...prev, [collectionName]: "" }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error de lectura.";
          setRowsByCollection((prev) => ({ ...prev, [collectionName]: [] }));
          setErrorByCollection((prev) => ({ ...prev, [collectionName]: msg }));
        } finally {
          setLoadingByCollection((prev) => ({ ...prev, [collectionName]: false }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await cargarTodo();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [cargarTodo]);

  const hlcRows = rowsByCollection.historial_laboral_cargos || [];
  const hldRows = rowsByCollection.historial_laboral_datos || [];
  const hlgRows = rowsByCollection.historial_laboral_grupos || [];
  const idxEfectores = crearIndicePorId(rowsByCollection.cfg_efectores || []);
  const idxGrupos = crearIndicePorId(rowsByCollection.grupos_de_trabajo || []);
  const idxHlc = crearIndicePorId(hlcRows);
  const idxHld = crearIndicePorId(hldRows);
  const opcionesGrupos = rowsByCollection.grupos_de_trabajo || [];
  const opcionesPersonas = rowsByCollection.personas || [];
  const opcionesEfectores = rowsByCollection.cfg_efectores || [];
  const opcionesEstadoAsignacion = rowsByCollection.cfg_estado_asignacion_laboral || [];
  const opcionesEscalafon = rowsByCollection.cfg_escalafon || [];
  const opcionesAgrupamiento = rowsByCollection.cfg_agrupamiento || [];
  const opcionesRol = rowsByCollection.cfg_rol || [];
  const opcionesCategorias = rowsByCollection.cfg_categorias || [];
  const opcionesFuncion = rowsByCollection.cfg_cargo_funcional || [];
  const registrosPorTipo = rowsByCollection[tipoAlta] || [];
  const hldSinCargo = hldRows.filter((row) => !idxHlc.has(String(row.cargo_id || "")));
  const hlgSinDato = hlgRows.filter((row) => !idxHld.has(String(row.dato_laboral_id || "")));
  const hlcConGrupoInvalido = hlcRows.filter(
    (row) => row.grupo_de_trabajo_id && !idxGrupos.has(String(row.grupo_de_trabajo_id)),
  );
  const hlcConEfectorDesignacionInvalido = hlcRows.filter(
    (row) => row.efector_designacion_id && !idxEfectores.has(String(row.efector_designacion_id)),
  );
  const hlcConEfectorCumplimientoInvalido = hlcRows.filter(
    (row) => row.efector_cumplimiento_id && !idxEfectores.has(String(row.efector_cumplimiento_id)),
  );
  const totalAlertasIntegridad =
    hldSinCargo.length +
    hlgSinDato.length +
    hlcConGrupoInvalido.length +
    hlcConEfectorDesignacionInvalido.length +
    hlcConEfectorCumplimientoInvalido.length;

  function onChangeField(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    setModoEdicion(false);
    setRegistroEditId("");
  }, [tipoAlta]);

  function cargarRegistroEnFormulario(record) {
    if (!record || typeof record !== "object") return;
    const datoRef = idxHld.get(String(record.dato_laboral_id || ""));
    setFormData((prev) => ({
      ...prev,
      persona_id: String(record.persona_id || ""),
      grupo_de_trabajo_id: String(record.grupo_de_trabajo_id || ""),
      efector_designacion_id: String(record.efector_designacion_id || ""),
      efector_cumplimiento_id: String(record.efector_cumplimiento_id || ""),
      estado_asignacion_id: String(record.estado_asignacion_id || ""),
      carga_horaria_total:
        record.carga_horaria_total == null ? "" : String(record.carga_horaria_total),
      fecha_desde: isoToDateInput(String(record.fecha_desde || "")),
      fecha_hasta: isoToDateInput(String(record.fecha_hasta || "")),
      cargo_id: String(record.cargo_id || (datoRef && datoRef.cargo_id) || ""),
      cargo_funcional_id: String(record.cargo_funcional_id || ""),
      categoria_id: String(record.categoria_id || ""),
      rol_id: String(record.rol_id || ""),
      escalafon_id: String(record.escalafon_id || ""),
      agrupamiento_id: String(record.agrupamiento_id || ""),
      funcion_real_id: String(record.funcion_real_id || ""),
      nivel_jerarquico: record.nivel_jerarquico == null ? "" : String(record.nivel_jerarquico),
      dato_laboral_id: String(record.dato_laboral_id || ""),
      carga_por_dia_semana: Array.isArray(record.carga_por_dia_semana)
        ? record.carga_por_dia_semana.join(",")
        : "",
    }));
  }

  function camposRequeridosSegunTipo() {
    if (tipoAlta === "historial_laboral_cargos") {
      return ["persona_id", "efector_designacion_id", "efector_cumplimiento_id"];
    }
    return ["persona_id", "cargo_id", "grupo_de_trabajo_id"];
  }

  function validarFormulario() {
    const faltantes = camposRequeridosSegunTipo().filter((k) => !String(formData[k] || "").trim());
    if (faltantes.length > 0) {
      return `Completá los campos obligatorios: ${faltantes.join(", ")}`;
    }
    if (formData.persona_id && !/^per_/i.test(formData.persona_id.trim())) {
      return "persona_id debe comenzar con per_.";
    }
    if (formData.carga_horaria_total) {
      const n = Number(formData.carga_horaria_total);
      if (!Number.isFinite(n) || n < 0 || n > 168) {
        return "carga_horaria_total debe ser un número entre 0 y 168.";
      }
    }
    if (formData.nivel_jerarquico) {
      const n = Number(formData.nivel_jerarquico);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        return "nivel_jerarquico debe ser un entero entre 1 y 99.";
      }
    }
    if (formData.fecha_desde && formData.fecha_hasta && formData.fecha_desde > formData.fecha_hasta) {
      return "fecha_hasta no puede ser menor que fecha_desde.";
    }
    if (tipoAlta === "historial_laboral_grupos" && formData.carga_por_dia_semana) {
      const vals = String(formData.carga_por_dia_semana)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (vals.length !== 7) {
        return "carga_por_dia_semana debe tener 7 valores (Lun..Dom).";
      }
      const invalido = vals.some((x) => !Number.isFinite(Number(x)) || Number(x) < 0 || Number(x) > 24);
      if (invalido) {
        return "Cada valor de carga_por_dia_semana debe estar entre 0 y 24.";
      }
    }
    return "";
  }

  async function onGuardarRegistro(e) {
    e.preventDefault();
    setSaveMsg("");
    const errorValidacion = validarFormulario();
    if (errorValidacion) {
      setSaveMsg(errorValidacion);
      return;
    }
    setSaving(true);
    try {
      let r;
      if (tipoAlta === "historial_laboral_cargos") {
        const payload = {
          persona_id: formData.persona_id,
          efector_designacion_id: formData.efector_designacion_id,
          efector_cumplimiento_id: formData.efector_cumplimiento_id,
          estado_asignacion_id: formData.estado_asignacion_id || null,
          escalafon_id: formData.escalafon_id || null,
          agrupamiento_id: formData.agrupamiento_id || null,
          cargo_funcional_id: formData.cargo_funcional_id || null,
          categoria_id: formData.categoria_id || null,
          carga_horaria_total: formData.carga_horaria_total || null,
          fecha_desde: formData.fecha_desde || null,
          fecha_hasta: formData.fecha_hasta || null,
        };
        if (modoEdicion && registroEditId) payload.id = registroEditId;
        r = await guardarRegistroLaboral("historial_laboral_cargos", payload);
      } else {
        const payloadHld = {
          persona_id: formData.persona_id,
          cargo_id: formData.cargo_id,
          rol_id: formData.rol_id || null,
          funcion_real_id: formData.funcion_real_id || null,
          nivel_jerarquico: formData.nivel_jerarquico || null,
          fecha_inicio: formData.fecha_desde || null,
          fecha_fin: formData.fecha_hasta || null,
        };
        if (modoEdicion && registroEditId && formData.dato_laboral_id) {
          payloadHld.id = formData.dato_laboral_id;
        }
        const hld = await guardarRegistroLaboral("historial_laboral_datos", payloadHld);
        const payloadHlg = {
          persona_id: formData.persona_id,
          dato_laboral_id: hld.id,
          grupo_de_trabajo_id: formData.grupo_de_trabajo_id,
          nivel_jerarquico: formData.nivel_jerarquico || null,
          fecha_inicio: formData.fecha_desde || null,
          fecha_fin: formData.fecha_hasta || null,
        };
        if (modoEdicion && registroEditId) payloadHlg.id = registroEditId;
        r = await guardarRegistroLaboral("historial_laboral_grupos", payloadHlg);
      }
      setSaveMsg(`Registro guardado correctamente: ${r.id || "(sin id)"}`);
      await cargarTodo();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Datos laborales</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vista de referencia del contrato vigente en V2 para las colecciones y campos del modulo
            laboral. Esta pantalla consulta Firestore en vivo.
          </p>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Guía rápida de niveles (uso recomendado)</p>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Nivel 1 · Cargo (HLc):</span> define el cargo principal del usuario
              (efectores, estado, escalafón, agrupamiento, cargo funcional y carga total).
            </p>
            <p>
              <span className="font-semibold">Nivel 2 · Grupo de trabajo (HLg):</span> define la asignación
              operativa por grupo/burbuja (cargo base, rol, función real, nivel jerárquico y vigencia).
            </p>
            <p>
              <span className="font-semibold">Detalle técnico (HLd):</span> se gestiona en segundo plano para
              sostener trazabilidad técnica entre cargo y asignaciones por grupo.
            </p>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Orden sugerido de carga: HLc {"->"} HLg. La app crea/actualiza HLd cuando corresponde, sin
              perder trazabilidad.
            </p>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">
            Alta de Datos Laborales (BD real, sin datos ficticios)
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Completá la información por nivel (`HLc` o `HLg`). Los campos seleccionables se cargan
            desde colecciones reales de Firestore.
          </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Criterio operativo: <span className="font-semibold">cargo_funcional_id</span> representa la
              función por normativa/designación formal, mientras que{" "}
              <span className="font-semibold">funcion_real_id</span> representa la función efectivamente
              ejercida. Pueden diferir temporalmente sin que eso implique error.
            </p>
          <form className="mt-4 space-y-4" onSubmit={onGuardarRegistro}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nivel de registro
              </label>
              <select
                value={tipoAlta}
                onChange={(e) => setTipoAlta(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
              >
                <option value="historial_laboral_cargos">HLc · historial_laboral_cargos</option>
                <option value="historial_laboral_grupos">HLg · historial_laboral_grupos (con vínculo a cargo)</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={modoEdicion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModoEdicion(checked);
                    setRegistroEditId("");
                    if (!checked) return;
                    const first = registrosPorTipo[0];
                    if (first && first.id) {
                      setRegistroEditId(String(first.id));
                      cargarRegistroEnFormulario(first);
                    }
                  }}
                />
                Editar registro existente
              </label>
              {modoEdicion && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Registro a editar</label>
                  <select
                    value={registroEditId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setRegistroEditId(id);
                      const target = registrosPorTipo.find((x) => String(x.id) === String(id));
                      if (target) cargarRegistroEnFormulario(target);
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar registro...</option>
                    {registrosPorTipo.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">persona_id *</label>
                <select
                  value={formData.persona_id}
                  onChange={(e) => onChangeField("persona_id", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                >
                  <option value="">Seleccionar persona...</option>
                  {opcionesPersonas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.apellido ? `${p.apellido || ""} ${p.nombre || ""} (${p.id})` : p.id}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.persona_id}</p>
              </div>

              {tipoAlta === "historial_laboral_grupos" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">grupo_de_trabajo_id *</label>
                  <select
                    value={formData.grupo_de_trabajo_id}
                    onChange={(e) => onChangeField("grupo_de_trabajo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar grupo...</option>
                    {opcionesGrupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre || g.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.grupo_de_trabajo_id}</p>
                </div>
              )}
            </div>

            {tipoAlta === "historial_laboral_cargos" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">efector_designacion_id *</label>
                  <select
                    value={formData.efector_designacion_id}
                    onChange={(e) => onChangeField("efector_designacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar efector...</option>
                    {opcionesEfectores.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.efector_designacion_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">efector_cumplimiento_id *</label>
                  <select
                    value={formData.efector_cumplimiento_id}
                    onChange={(e) => onChangeField("efector_cumplimiento_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar efector...</option>
                    {opcionesEfectores.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.efector_cumplimiento_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">estado_asignacion_id</label>
                  <select
                    value={formData.estado_asignacion_id}
                    onChange={(e) => onChangeField("estado_asignacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar estado...</option>
                    {opcionesEstadoAsignacion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.estado_asignacion_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">escalafon_id</label>
                  <select
                    value={formData.escalafon_id}
                    onChange={(e) => onChangeField("escalafon_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar escalafón...</option>
                    {opcionesEscalafon.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.escalafon_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">agrupamiento_id</label>
                  <select
                    value={formData.agrupamiento_id}
                    onChange={(e) => onChangeField("agrupamiento_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar agrupamiento...</option>
                    {opcionesAgrupamiento.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.agrupamiento_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">categoria_id</label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => onChangeField("categoria_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar categoría...</option>
                    {opcionesCategorias.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.categoria_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">cargo_funcional_id</label>
                  <select
                    value={formData.cargo_funcional_id}
                    onChange={(e) => onChangeField("cargo_funcional_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar cargo funcional...</option>
                    {opcionesFuncion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.cargo_funcional_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">carga_horaria_total</label>
                  <input
                    value={formData.carga_horaria_total}
                    onChange={(e) => onChangeField("carga_horaria_total", e.target.value)}
                    placeholder="36"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.carga_horaria_total}</p>
                </div>
              </div>
            )}

            {tipoAlta === "historial_laboral_grupos" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">cargo_id *</label>
                  <select
                    value={formData.cargo_id}
                    onChange={(e) => onChangeField("cargo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar cargo HLc...</option>
                    {hlcRows.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.cargo_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">rol_id</label>
                  <select
                    value={formData.rol_id}
                    onChange={(e) => onChangeField("rol_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar rol...</option>
                    {opcionesRol.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.rol_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">funcion_real_id</label>
                  <select
                    value={formData.funcion_real_id}
                    onChange={(e) => onChangeField("funcion_real_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar función...</option>
                    {opcionesFuncion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.funcion_real_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">nivel_jerarquico</label>
                  <input
                    value={formData.nivel_jerarquico}
                    onChange={(e) => onChangeField("nivel_jerarquico", e.target.value)}
                    placeholder="1..99"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.nivel_jerarquico}</p>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tipoAlta === "historial_laboral_cargos"
                    ? "fecha_desde (cargo)"
                    : "fecha_desde (asignación en grupo)"}
                </label>
                <input
                  type="date"
                  value={formData.fecha_desde}
                  onChange={(e) => onChangeField("fecha_desde", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.fecha_desde}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tipoAlta === "historial_laboral_cargos"
                    ? "fecha_hasta (cargo)"
                    : "fecha_hasta (asignación en grupo)"}
                </label>
                <input
                  type="date"
                  value={formData.fecha_hasta}
                  onChange={(e) => onChangeField("fecha_hasta", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.fecha_hasta}</p>
              </div>
            </div>

            {saveMsg && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  saveMsg.startsWith("Registro guardado")
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios en BD" : "Guardar en BD"}
              </button>
            </div>
          </form>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 4/5 (Integridad referencial)</p>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                totalAlertasIntegridad > 0
                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              {totalAlertasIntegridad > 0
                ? `${totalAlertasIntegridad} alerta(s)`
                : "Sin alertas de integridad"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Control de cruces entre `hlc_*`, `hld_*`, `hlg_*`, `grupos_de_trabajo` y `cfg_efectores`.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HLd sin HLc (cargo_id)</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{hldSinCargo.length}</p>
              {takeFirst(hldSinCargo).map((row) => (
                <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
                  {row.id} {"->"} cargo_id: {formatValue(row.cargo_id)}
                </p>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                HLg sin HLd (dato_laboral_id)
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{hlgSinDato.length}</p>
              {takeFirst(hlgSinDato).map((row) => (
                <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
                  {row.id} {"->"} dato_laboral_id: {formatValue(row.dato_laboral_id)}
                </p>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                HLc con grupo no resoluble
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{hlcConGrupoInvalido.length}</p>
              {takeFirst(hlcConGrupoInvalido).map((row) => (
                <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
                  {row.id} {"->"} grupo: {formatValue(row.grupo_de_trabajo_id)}
                </p>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                HLc con efector no resoluble
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {hlcConEfectorDesignacionInvalido.length + hlcConEfectorCumplimientoInvalido.length}
              </p>
              {takeFirst(hlcConEfectorDesignacionInvalido).map((row) => (
                <p key={`${row.id}-des`} className="mt-1 font-mono text-xs text-slate-600">
                  {row.id} {"->"} efector_designacion_id: {formatValue(row.efector_designacion_id)}
                </p>
              ))}
              {takeFirst(hlcConEfectorCumplimientoInvalido).map((row) => (
                <p key={`${row.id}-cum`} className="mt-1 font-mono text-xs text-slate-600">
                  {row.id} {"->"} efector_cumplimiento_id: {formatValue(row.efector_cumplimiento_id)}
                </p>
              ))}
            </div>
          </div>
        </Card>

        {DATOS_LABORALES_COLECCIONES.map((item) => (
          <Card key={item.id} className="px-4 py-4 md:px-5">
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-slate-900">{item.titulo}</p>
              <p className="text-sm text-slate-600">{item.descripcion}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {item.campos.map((campo) => (
                  <BadgeCampo key={campo} campo={campo} />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Coleccion: {item.collectionName}
                </p>
                {loadingByCollection[item.collectionName] ? (
                  <p className="mt-2 text-sm text-slate-600">Cargando registros...</p>
                ) : errorByCollection[item.collectionName] ? (
                  <p className="mt-2 text-sm text-rose-700">
                    Error al leer: {errorByCollection[item.collectionName]}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-slate-700">
                      Registros encontrados:{" "}
                      <span className="font-semibold">
                        {(rowsByCollection[item.collectionName] || []).length}
                      </span>
                    </p>
                    {(rowsByCollection[item.collectionName] || []).length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {(rowsByCollection[item.collectionName] || []).slice(0, 3).map((row, idx) => (
                          <div
                            key={row.id || `${item.collectionName}-row-${idx}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
                          >
                            <p className="font-mono text-[11px] text-slate-500">{row.id}</p>
                            <p className="mt-1">
                              {item.campos
                                .slice(1, 4)
                                .map((campo) => `${campo}: ${formatValue(row[campo])}`)
                                .join(" | ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Sin documentos cargados aun.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 1 (HLc + FK resueltas)</p>
          <p className="mt-1 text-sm text-slate-600">
            Vista operativa inicial de cargos laborales con resolución de grupo y efectores.
          </p>
          {loadingByCollection.historial_laboral_cargos ? (
            <p className="mt-3 text-sm text-slate-500">Cargando cargos...</p>
          ) : errorByCollection.historial_laboral_cargos ? (
            <p className="mt-3 text-sm text-rose-700">
              Error en `historial_laboral_cargos`: {errorByCollection.historial_laboral_cargos}
            </p>
          ) : hlcRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No hay cargos para mostrar.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Cargo ID</th>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Grupo</th>
                    <th className="px-3 py-2">Efector designación</th>
                    <th className="px-3 py-2">Efector cumplimiento</th>
                    <th className="px-3 py-2">Estado asignación</th>
                    <th className="px-3 py-2">Carga total</th>
                    <th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Hasta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {hlcRows.slice(0, 30).map((row, idx) => (
                    <tr key={row.id || `hlc-row-${idx}`}>
                      <td className="px-3 py-2 font-mono">{row.id}</td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                      <td className="px-3 py-2">
                        {labelDesdeIndice(idxGrupos, row.grupo_de_trabajo_id)}
                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                          ({formatValue(row.grupo_de_trabajo_id)})
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {labelDesdeIndice(idxEfectores, row.efector_designacion_id)}
                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                          ({formatValue(row.efector_designacion_id)})
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {labelDesdeIndice(idxEfectores, row.efector_cumplimiento_id)}
                        <span className="ml-1 font-mono text-[10px] text-slate-400">
                          ({formatValue(row.efector_cumplimiento_id)})
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{formatValue(row.estado_asignacion_id)}</td>
                      <td className="px-3 py-2">{formatValue(row.carga_horaria_total)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_desde)}</td>
                      <td className="px-3 py-2">{formatValue(row.fecha_hasta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 2 (HLd + cruce con HLc)</p>
          <p className="mt-1 text-sm text-slate-600">
            Segundo nivel laboral (`historial_laboral_datos`) vinculado al cargo base por `cargo_id`.
          </p>
          {loadingByCollection.historial_laboral_datos ? (
            <p className="mt-3 text-sm text-slate-500">Cargando datos laborales...</p>
          ) : errorByCollection.historial_laboral_datos ? (
            <p className="mt-3 text-sm text-rose-700">
              Error en `historial_laboral_datos`: {errorByCollection.historial_laboral_datos}
            </p>
          ) : hldRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No hay datos laborales (hld_*) para mostrar.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Dato ID</th>
                    <th className="px-3 py-2">Cargo ID</th>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Grupo (desde HLc)</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Escalafón</th>
                    <th className="px-3 py-2">Función real</th>
                    <th className="px-3 py-2">Nivel jerárquico</th>
                    <th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Hasta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {hldRows.slice(0, 40).map((row, idx) => {
                    const cargo = idxHlc.get(String(row.cargo_id || ""));
                    return (
                      <tr key={row.id || `hld-row-${idx}`}>
                        <td className="px-3 py-2 font-mono">{row.id}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.cargo_id)}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                        <td className="px-3 py-2">
                          {cargo
                            ? labelDesdeIndice(idxGrupos, cargo.grupo_de_trabajo_id)
                            : "Cargo no encontrado"}
                          {cargo && (
                            <span className="ml-1 font-mono text-[10px] text-slate-400">
                              ({formatValue(cargo.grupo_de_trabajo_id)})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.rol_id)}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.escalafon_id)}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.funcion_real_id)}</td>
                        <td className="px-3 py-2">{formatValue(row.nivel_jerarquico)}</td>
                        <td className="px-3 py-2">{formatValue(row.fecha_inicio)}</td>
                        <td className="px-3 py-2">{formatValue(row.fecha_fin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 3 (HLg + cruce con HLd/Grupo)</p>
          <p className="mt-1 text-sm text-slate-600">
            Tercer nivel laboral (`historial_laboral_grupos`) vinculado al dato laboral (`dato_laboral_id`) y
            resolución de grupo operativo.
          </p>
          {loadingByCollection.historial_laboral_grupos ? (
            <p className="mt-3 text-sm text-slate-500">Cargando grupos laborales...</p>
          ) : errorByCollection.historial_laboral_grupos ? (
            <p className="mt-3 text-sm text-rose-700">
              Error en `historial_laboral_grupos`: {errorByCollection.historial_laboral_grupos}
            </p>
          ) : hlgRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No hay datos de grupos laborales (hlg_*) para mostrar.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Grupo laboral ID</th>
                    <th className="px-3 py-2">Dato laboral ID</th>
                    <th className="px-3 py-2">Cargo ID (desde HLd)</th>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Grupo (HLg)</th>
                    <th className="px-3 py-2">Grupo (desde HLc)</th>
                    <th className="px-3 py-2">Nivel jerárquico</th>
                    <th className="px-3 py-2">Carga por día</th>
                    <th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Hasta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {hlgRows.slice(0, 40).map((row, idx) => {
                    const datoLaboral = idxHld.get(String(row.dato_laboral_id || ""));
                    const cargo = datoLaboral ? idxHlc.get(String(datoLaboral.cargo_id || "")) : null;
                    return (
                      <tr key={row.id || `hlg-row-${idx}`}>
                        <td className="px-3 py-2 font-mono">{row.id}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.dato_laboral_id)}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(datoLaboral && datoLaboral.cargo_id)}</td>
                        <td className="px-3 py-2 font-mono">{formatValue(row.persona_id)}</td>
                        <td className="px-3 py-2">
                          {labelDesdeIndice(idxGrupos, row.grupo_de_trabajo_id)}
                          <span className="ml-1 font-mono text-[10px] text-slate-400">
                            ({formatValue(row.grupo_de_trabajo_id)})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {cargo ? labelDesdeIndice(idxGrupos, cargo.grupo_de_trabajo_id) : "Sin cruce HLc"}
                          {cargo && (
                            <span className="ml-1 font-mono text-[10px] text-slate-400">
                              ({formatValue(cargo.grupo_de_trabajo_id)})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{formatValue(row.nivel_jerarquico)}</td>
                        <td className="px-3 py-2 font-mono">{formatCargaPorDia(row.carga_por_dia_semana)}</td>
                        <td className="px-3 py-2">{formatValue(row.fecha_inicio)}</td>
                        <td className="px-3 py-2">{formatValue(row.fecha_fin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
