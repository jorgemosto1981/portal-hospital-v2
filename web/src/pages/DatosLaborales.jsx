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

function emptyCargaDia() {
  return { dia_semana_id: "", horas: "" };
}

function normalizeCargaRowsFromRecord(rawCarga) {
  if (!Array.isArray(rawCarga)) return [emptyCargaDia()];
  if (rawCarga.length === 0) return [emptyCargaDia()];
  return rawCarga.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return {
        dia_semana_id: String(item.dia_semana_id || ""),
        horas: item.horas == null ? "" : String(item.horas),
      };
    }
    return {
      dia_semana_id: "",
      horas: item == null ? "" : String(item),
    };
  });
}

function normalizarWarnings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const code = typeof w.code === "string" ? w.code.trim() : "";
      const message = typeof w.message === "string" ? w.message.trim() : "";
      if (!code && !message) return null;
      return { code, message };
    })
    .filter(Boolean);
}

const COLECCIONES_FORM = [
  "personas",
  "cfg_estado_asignacion_laboral",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_categorias",
  "cfg_rol",
  "cfg_cargo_funcional",
  "cfg_tipo_vinculo_laboral",
  "cfg_modalidad_jornada",
  "cfg_causal_fin_asignacion_laboral",
  "cfg_tipo_acto_designacion",
  "cfg_dia_semana",
];

const AYUDA_CAMPOS = {
  persona_id: "Identificador único de persona (per_*). Ancla principal del legajo.",
  grupo_de_trabajo_id: "Unidad operativa del organigrama donde se desempeña.",
  efector_designacion_id: "Efector donde fue designado formalmente.",
  efector_cumplimiento_id: "Efector donde cumple funciones efectivamente.",
  estado_asignacion_id: "Estado administrativo actual de la asignación.",
  cargo_funcional_id: "Cargo funcional del puesto (desde catálogo).",
  tipo_vinculo_id: "Tipo de vínculo laboral del cargo según normativa.",
  modalidad_jornada_id: "Modalidad de jornada aplicable al cargo.",
  causal_fin_asignacion_id: "Motivo de finalización; obligatorio cuando se informa fecha_hasta.",
  referencias_normativa_designacion: "Referencia legal del acto de designación del cargo.",
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
  carga_por_dia_semana: "Carga distribuida por día (seleccionar dia_semana_id + horas por fila).",
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
  const [cargaPorDiaRows, setCargaPorDiaRows] = useState([emptyCargaDia()]);
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
    tipo_vinculo_id: "",
    modalidad_jornada_id: "",
    causal_fin_asignacion_id: "",
    referencia_tipo_acto_id: "",
    referencia_numero: "",
    referencia_fecha: "",
    referencia_detalle: "",
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
  const opcionesTipoVinculo = rowsByCollection.cfg_tipo_vinculo_laboral || [];
  const opcionesModalidadJornada = rowsByCollection.cfg_modalidad_jornada || [];
  const opcionesCausalFinAsignacion = rowsByCollection.cfg_causal_fin_asignacion_laboral || [];
  const opcionesTipoActo = rowsByCollection.cfg_tipo_acto_designacion || [];
  const opcionesDiaSemana = rowsByCollection.cfg_dia_semana || [];
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
  const hldByCargo = new Map();
  hldRows.forEach((row) => {
    const cargoId = String(row.cargo_id || "");
    if (!cargoId) return;
    const list = hldByCargo.get(cargoId) || [];
    list.push(String(row.id));
    hldByCargo.set(cargoId, list);
  });
  const hlgByHld = new Map();
  hlgRows.forEach((row) => {
    const hldId = String(row.dato_laboral_id || "");
    if (!hldId) return;
    hlgByHld.set(hldId, true);
  });
  const hlcActivosSinGrupo = hlcRows.filter((row) => {
    const activo = row.activo !== false && !row.fecha_hasta;
    if (!activo) return false;
    const hldIds = hldByCargo.get(String(row.id || "")) || [];
    if (hldIds.length === 0) return true;
    return !hldIds.some((id) => hlgByHld.get(id));
  });

  function onChangeField(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function onChangeCargaRow(idx, key, value) {
    setCargaPorDiaRows((prev) =>
      prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, [key]: value } : row)),
    );
  }

  function onAddCargaRow() {
    setCargaPorDiaRows((prev) => [...prev, emptyCargaDia()]);
  }

  function onRemoveCargaRow(idx) {
    setCargaPorDiaRows((prev) => {
      const next = prev.filter((_, rowIdx) => rowIdx !== idx);
      return next.length > 0 ? next : [emptyCargaDia()];
    });
  }

  useEffect(() => {
    setModoEdicion(false);
    setRegistroEditId("");
    setCargaPorDiaRows([emptyCargaDia()]);
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
      fecha_desde: isoToDateInput(
        String(
          record.fecha_desde ||
            record.fecha_inicio ||
            (datoRef && datoRef.fecha_inicio) ||
            "",
        ),
      ),
      fecha_hasta: isoToDateInput(
        String(
          record.fecha_hasta ||
            record.fecha_fin ||
            (datoRef && datoRef.fecha_fin) ||
            "",
        ),
      ),
      cargo_id: String(record.cargo_id || (datoRef && datoRef.cargo_id) || ""),
      cargo_funcional_id: String(record.cargo_funcional_id || ""),
      tipo_vinculo_id: String(record.tipo_vinculo_id || ""),
      modalidad_jornada_id: String(record.modalidad_jornada_id || ""),
      causal_fin_asignacion_id: String(record.causal_fin_asignacion_id || ""),
      referencia_tipo_acto_id: String(
        (Array.isArray(record.referencias_normativa_designacion) &&
          record.referencias_normativa_designacion[0] &&
          record.referencias_normativa_designacion[0].tipo_acto_id) ||
          "",
      ),
      referencia_numero: String(
        (Array.isArray(record.referencias_normativa_designacion) &&
          record.referencias_normativa_designacion[0] &&
          record.referencias_normativa_designacion[0].numero) ||
          "",
      ),
      referencia_fecha: isoToDateInput(
        String(
          (Array.isArray(record.referencias_normativa_designacion) &&
            record.referencias_normativa_designacion[0] &&
            record.referencias_normativa_designacion[0].fecha) ||
            "",
        ),
      ),
      referencia_detalle: String(
        (Array.isArray(record.referencias_normativa_designacion) &&
          record.referencias_normativa_designacion[0] &&
          record.referencias_normativa_designacion[0].detalle) ||
          "",
      ),
      categoria_id: String(record.categoria_id || ""),
      rol_id: String(record.rol_id || (datoRef && datoRef.rol_id) || ""),
      escalafon_id: String(record.escalafon_id || ""),
      agrupamiento_id: String(record.agrupamiento_id || ""),
      funcion_real_id: String(record.funcion_real_id || (datoRef && datoRef.funcion_real_id) || ""),
      nivel_jerarquico: record.nivel_jerarquico == null ? "" : String(record.nivel_jerarquico),
      dato_laboral_id: String(record.dato_laboral_id || ""),
      carga_por_dia_semana: Array.isArray(record.carga_por_dia_semana)
        ? record.carga_por_dia_semana.join(",")
        : "",
    }));
    setCargaPorDiaRows(normalizeCargaRowsFromRecord(record.carga_por_dia_semana));
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
    if (
      tipoAlta === "historial_laboral_cargos" &&
      formData.fecha_hasta &&
      !String(formData.causal_fin_asignacion_id || "").trim()
    ) {
      return "Si informás fecha_hasta en HLc, causal_fin_asignacion_id es obligatorio.";
    }
    if (tipoAlta === "historial_laboral_cargos") {
      if (!String(formData.referencia_tipo_acto_id || "").trim()) {
        return "En HLc, referencia normativa requiere tipo_acto_id.";
      }
      if (!String(formData.referencia_numero || "").trim()) {
        return "En HLc, referencia normativa requiere número.";
      }
      if (!String(formData.referencia_fecha || "").trim()) {
        return "En HLc, referencia normativa requiere fecha.";
      }
    }
    if (tipoAlta === "historial_laboral_grupos") {
      const rowsValidas = cargaPorDiaRows
        .map((row) => ({
          dia_semana_id: String(row.dia_semana_id || "").trim(),
          horas: String(row.horas || "").trim(),
        }))
        .filter((row) => row.dia_semana_id || row.horas);
      if (rowsValidas.length === 0) {
        return "Completá al menos una fila de carga_por_dia_semana (día + horas).";
      }
      const seen = new Set();
      for (const row of rowsValidas) {
        if (!row.dia_semana_id) return "Cada fila de carga_por_dia_semana requiere dia_semana_id.";
        if (seen.has(row.dia_semana_id)) return `dia_semana_id duplicado en carga_por_dia_semana: ${row.dia_semana_id}.`;
        seen.add(row.dia_semana_id);
        if (!Number.isFinite(Number(row.horas)) || Number(row.horas) < 0 || Number(row.horas) > 24) {
          return `Horas inválidas para ${row.dia_semana_id}. Debe estar entre 0 y 24.`;
        }
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
      let warnings = [];
      if (tipoAlta === "historial_laboral_cargos") {
        const payload = {
          persona_id: formData.persona_id,
          efector_designacion_id: formData.efector_designacion_id,
          efector_cumplimiento_id: formData.efector_cumplimiento_id,
          estado_asignacion_id: formData.estado_asignacion_id || null,
          escalafon_id: formData.escalafon_id || null,
          agrupamiento_id: formData.agrupamiento_id || null,
          cargo_funcional_id: formData.cargo_funcional_id || null,
          tipo_vinculo_id: formData.tipo_vinculo_id || null,
          modalidad_jornada_id: formData.modalidad_jornada_id || null,
          causal_fin_asignacion_id: formData.causal_fin_asignacion_id || null,
          referencias_normativa_designacion: [
            {
              tipo_acto_id: formData.referencia_tipo_acto_id || null,
              numero: formData.referencia_numero || null,
              fecha: formData.referencia_fecha || null,
              detalle: formData.referencia_detalle || null,
            },
          ],
          categoria_id: formData.categoria_id || null,
          carga_horaria_total: formData.carga_horaria_total || null,
          fecha_desde: formData.fecha_desde || null,
          fecha_hasta: formData.fecha_hasta || null,
        };
        if (modoEdicion && registroEditId) payload.id = registroEditId;
        r = await guardarRegistroLaboral("historial_laboral_cargos", payload);
        warnings = normalizarWarnings(r && r.warnings);
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
        warnings = warnings.concat(normalizarWarnings(hld && hld.warnings));
        const payloadHlg = {
          persona_id: formData.persona_id,
          dato_laboral_id: hld.id,
          grupo_de_trabajo_id: formData.grupo_de_trabajo_id,
          nivel_jerarquico: formData.nivel_jerarquico || null,
          carga_por_dia_semana: cargaPorDiaRows
            .map((row) => ({
              dia_semana_id: String(row.dia_semana_id || "").trim() || null,
              horas: row.horas === "" ? null : Number(row.horas),
            }))
            .filter((row) => row.dia_semana_id && Number.isFinite(row.horas)),
          fecha_inicio: formData.fecha_desde || null,
          fecha_fin: formData.fecha_hasta || null,
        };
        if (modoEdicion && registroEditId) payloadHlg.id = registroEditId;
        r = await guardarRegistroLaboral("historial_laboral_grupos", payloadHlg);
        warnings = warnings.concat(normalizarWarnings(r && r.warnings));
      }
      const baseOk = `Registro guardado correctamente: ${r.id || "(sin id)"}`;
      if (warnings.length === 0) {
        setSaveMsg(baseOk);
      } else {
        const detalleWarnings = warnings
          .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
          .join(" | ");
        setSaveMsg(`${baseOk} | Advertencias: ${detalleWarnings}`);
      }
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
                  <label className="block text-sm font-medium text-slate-700">tipo_vinculo_id</label>
                  <select
                    value={formData.tipo_vinculo_id}
                    onChange={(e) => onChangeField("tipo_vinculo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar tipo de vínculo...</option>
                    {opcionesTipoVinculo.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.tipo_vinculo_id}</p>
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
                  <label className="block text-sm font-medium text-slate-700">modalidad_jornada_id</label>
                  <select
                    value={formData.modalidad_jornada_id}
                    onChange={(e) => onChangeField("modalidad_jornada_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar modalidad...</option>
                    {opcionesModalidadJornada.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.modalidad_jornada_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · tipo_acto_id *
                  </label>
                  <select
                    value={formData.referencia_tipo_acto_id}
                    onChange={(e) => onChangeField("referencia_tipo_acto_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar tipo de acto...</option>
                    {opcionesTipoActo.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.referencias_normativa_designacion}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · número *
                  </label>
                  <input
                    value={formData.referencia_numero}
                    onChange={(e) => onChangeField("referencia_numero", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · fecha *
                  </label>
                  <input
                    type="date"
                    value={formData.referencia_fecha}
                    onChange={(e) => onChangeField("referencia_fecha", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · detalle
                  </label>
                  <input
                    value={formData.referencia_detalle}
                    onChange={(e) => onChangeField("referencia_detalle", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
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
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">carga_por_dia_semana</label>
                    <button
                      type="button"
                      onClick={onAddCargaRow}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      Agregar día
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-slate-500">{AYUDA_CAMPOS.carga_por_dia_semana}</p>
                  <div className="space-y-2">
                    {cargaPorDiaRows.map((row, idx) => (
                      <div key={`carga-dia-${idx}`} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
                        <select
                          value={row.dia_semana_id}
                          onChange={(e) => onChangeCargaRow(idx, "dia_semana_id", e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                        >
                          <option value="">Seleccionar día...</option>
                          {opcionesDiaSemana.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nombre || x.id}
                            </option>
                          ))}
                        </select>
                        <input
                          value={row.horas}
                          onChange={(e) => onChangeCargaRow(idx, "horas", e.target.value)}
                          placeholder="Horas (0..24)"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveCargaRow(idx)}
                          className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
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
              {tipoAlta === "historial_laboral_cargos" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">causal_fin_asignacion_id</label>
                  <select
                    value={formData.causal_fin_asignacion_id}
                    onChange={(e) => onChangeField("causal_fin_asignacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar causal...</option>
                    {opcionesCausalFinAsignacion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.causal_fin_asignacion_id}</p>
                </div>
              )}
            </div>

            {saveMsg && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  saveMsg.startsWith("Registro guardado")
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

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                HLc activos sin grupo asignado (advertencia)
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-800">{hlcActivosSinGrupo.length}</p>
              {takeFirst(hlcActivosSinGrupo).map((row) => (
                <p key={row.id} className="mt-1 font-mono text-xs text-amber-700">
                  {row.id} {"->"} persona_id: {formatValue(row.persona_id)}
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
