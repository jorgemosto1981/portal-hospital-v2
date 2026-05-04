import Card from "../components/ui/Card.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import {
  guardarRegistroPersonal,
  listarColeccionPersonal,
} from "../services/datosPersonalesService.js";
import { storageV2 } from "../services/firebase.js";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import {
  COLECCIONES_BASE,
  COLECCIONES_CFG,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  HELP,
  INITIAL_FORM_DATA_PERSONALES,
  TIPOS_DATOS_PERSONALES_URL,
} from "./datos-personales/constants.js";
import FormHeaderControls from "./datos-personales/sections/FormHeaderControls.jsx";
import ConsentimientosFields from "./datos-personales/sections/ConsentimientosFields.jsx";
import DdjjFields from "./datos-personales/sections/DdjjFields.jsx";
import FormacionFields from "./datos-personales/sections/FormacionFields.jsx";
import PersonaFields from "./datos-personales/sections/PersonaFields.jsx";
import { emptyFamiliar, normalizarWarnings, toOpts } from "./datos-personales/utils.js";
import {
  buildDatosPayload,
  hydrateDatosPersonales,
  updateDatosPersonalesField,
  validateDatosPersonales,
} from "./datos-personales/formLogic.js";
import {
  eventoEnRangoAuditoria,
  mesEnCursoRangoLocal,
  normalizarDesdeHasta,
  parseYmd,
} from "./datos-personales/fechaFiltroUtils.js";

const TIPOS_URL_SET = new Set(TIPOS_DATOS_PERSONALES_URL);
const EMPTY_ROWS = [];

function isEventoAuditoriaDatosPersonales(evento) {
  const tipoCfgId = String(evento?.tipo_evento_cfg_id || "").trim().toLowerCase();
  return tipoCfgId.startsWith("cfg_tev_datos_");
}

function formatFechaEventoDdMmAaaa(value) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function toEpochMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortRegistrosVigentes(a, b, tipo) {
  if (tipo === "declaraciones_grupo_familiar") {
    const va = Number(a?.declaracion_version) || 0;
    const vb = Number(b?.declaracion_version) || 0;
    if (vb !== va) return vb - va;
  }
  const ta = toEpochMs(a?.actualizado_en) || toEpochMs(a?.creado_en);
  const tb = toEpochMs(b?.actualizado_en) || toEpochMs(b?.creado_en);
  if (tb !== ta) return tb - ta;
  return String(b?.id || "").localeCompare(String(a?.id || ""));
}

function mapEstadoDdjjToUiLabel(estadoIdRaw) {
  const estadoId = String(estadoIdRaw || "").trim().toUpperCase();
  if (estadoId === "CFG_DDJJ_03_PRESENTADA") return "Presentada";
  return "Pendiente de presentación";
}

function readTipoFromSearchOnce() {
  if (typeof window === "undefined") return "personas";
  const t = new URLSearchParams(window.location.search).get("tipo");
  return t && TIPOS_URL_SET.has(t) ? t : "personas";
}

function readCurrentSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function DatosPersonales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims, hasPortalRoles } = useAuthClaims(user);
  const personaIdClaim = String((claims && claims.persona_id) || "").trim();
  const isRrhh = hasPortalRoles(["rrhh", "admin"]);
  const [tipo, setTipo] = useState(readTipoFromSearchOnce);
  const [modoEdicion, setModoEdicion] = useState(false);
  const readOnlyByDefault = !modoEdicion;
  const [editId, setEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [rowsByCol, setRowsByCol] = useState({});
  const [loadingByCol, setLoadingByCol] = useState({});
  const [progressByCol, setProgressByCol] = useState({});
  const [durationByCol, setDurationByCol] = useState({});
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM_DATA_PERSONALES }));
  const [familiares, setFamiliares] = useState([emptyFamiliar()]);
  const autoHydratedPersonaIdRef = useRef("");

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

  /** RRHH: `persona_id` en URL (solo lectura de query; no aplicable a agente). */
  useEffect(() => {
    if (!isRrhh) return;
    const pid = String(searchParams.get("persona_id") || "").trim();
    if (!pid || !/^per_/i.test(pid)) return;
    setForm((prev) => (String(prev.persona_id || "").trim() === pid ? prev : { ...prev, persona_id: pid }));
  }, [searchParams, isRrhh]);

  /** Escribe `?tipo=`, `persona_id` (RRHH), `desde` y `hasta` (mes en curso por defecto). */
  useEffect(() => {
    const current = readCurrentSearchParams();
    const def = mesEnCursoRangoLocal();
    const wantTipo = tipo;
    const wantPid =
      isRrhh && String(form.persona_id || "").trim() ? String(form.persona_id).trim() : null;
    let wantDesde = parseYmd(current.get("desde")) ?? def.desde;
    let wantHasta = parseYmd(current.get("hasta")) ?? def.hasta;
    const nh = normalizarDesdeHasta(wantDesde, wantHasta);
    if (nh) {
      wantDesde = nh.desde;
      wantHasta = nh.hasta;
    }

    const hasTipo = current.get("tipo");
    const hasPid = current.get("persona_id") || null;
    const hasDesde = current.get("desde");
    const hasHasta = current.get("hasta");

    if (
      hasTipo === wantTipo &&
      (wantPid === null ? !hasPid : hasPid === wantPid) &&
      hasDesde === wantDesde &&
      hasHasta === wantHasta
    ) {
      return;
    }

    const next = new URLSearchParams();
    next.set("tipo", wantTipo);
    if (wantPid) next.set("persona_id", wantPid);
    next.set("desde", wantDesde);
    next.set("hasta", wantHasta);
    const nextKey = next.toString();
    if (nextKey === current.toString()) return;
    setSearchParams(next, { replace: true });
  }, [tipo, form.persona_id, isRrhh, setSearchParams]);

  const rangoEventos = useMemo(() => {
    const def = mesEnCursoRangoLocal();
    const d = parseYmd(searchParams.get("desde")) ?? def.desde;
    const h = parseYmd(searchParams.get("hasta")) ?? def.hasta;
    return normalizarDesdeHasta(d, h) ?? def;
  }, [searchParams]);

  const commitEventosQuery = useCallback(
    (/** @type {{ desde?: string, hasta?: string }} */ partial) => {
      const current = readCurrentSearchParams();
      const def = mesEnCursoRangoLocal();
      const next = new URLSearchParams(current);
      next.set("tipo", tipo);
      if (isRrhh && String(form.persona_id || "").trim()) {
        next.set("persona_id", String(form.persona_id).trim());
      } else {
        next.delete("persona_id");
      }
      const desde = partial.desde ?? parseYmd(current.get("desde")) ?? def.desde;
      const hasta = partial.hasta ?? parseYmd(current.get("hasta")) ?? def.hasta;
      const n = normalizarDesdeHasta(desde, hasta);
      if (n) {
        next.set("desde", n.desde);
        next.set("hasta", n.hasta);
      }
      if (next.toString() === current.toString()) return;
      setSearchParams(next, { replace: true });
    },
    [form.persona_id, isRrhh, setSearchParams, tipo],
  );

  useEffect(() => {
    setModoEdicion(false);
    setEditId("");
    setSaveMsg("");
  }, [tipo]);

  useEffect(() => {
    setEditId("");
  }, [form.persona_id, tipo]);

  useEffect(() => {
    if (tipo !== "personas") return;
    const pid = String(form.persona_id || "").trim();
    if (!pid) {
      autoHydratedPersonaIdRef.current = "";
      return;
    }
    if (autoHydratedPersonaIdRef.current === pid) return;
    const target = (rowsByCol.personas || []).find((p) => String(p.id || "") === pid);
    if (!target) return;
    let nextFamiliares = null;
    setForm((prev) => {
      const next = hydrateDatosPersonales({ record: target, prevForm: prev, emptyFamiliar });
      if (!next) return prev;
      nextFamiliares = next.familiares;
      return next.form;
    });
    if (nextFamiliares) setFamiliares(nextFamiliares);
    autoHydratedPersonaIdRef.current = pid;
  }, [tipo, form.persona_id, rowsByCol.personas]);

  useEffect(() => {
    if (tipo === "personas") return;
    autoHydratedPersonaIdRef.current = "";
  }, [tipo]);

  useEffect(() => {
    if (isRrhh) return;
    if (!personaIdClaim) return;
    setForm((prev) => (String(prev.persona_id || "").trim() ? prev : { ...prev, persona_id: personaIdClaim }));
  }, [isRrhh, personaIdClaim]);

  const registros = useMemo(() => rowsByCol[tipo] ?? EMPTY_ROWS, [rowsByCol, tipo]);
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
  const estadoDeclaracionIdActual = useMemo(
    () => String(form.estado_declaracion_id || ESTADO_DDJJ_DEFAULT_PERSONALES || "").trim(),
    [form.estado_declaracion_id],
  );
  const estadoDeclaracionUiLabel = useMemo(
    () => mapEstadoDdjjToUiLabel(estadoDeclaracionIdActual),
    [estadoDeclaracionIdActual],
  );
  const optsPersonas = useMemo(
    () =>
      (rowsByCol.personas || []).map((p) => ({
        value: String(p.id),
        label: p.nombre || p.apellido ? `${p.apellido || ""} ${p.nombre || ""} (${p.id})` : String(p.id),
      })),
    [rowsByCol.personas],
  );
  const personaDataById = useMemo(() => {
    const m = new Map();
    (rowsByCol.personas || []).forEach((p) => {
      const id = String(p.id || "").trim();
      if (!id) return;
      const nombre = String(p.nombre || "").trim();
      const apellido = String(p.apellido || "").trim();
      const dni = String(p.dni || "").trim();
      const nombreCompleto = [apellido, nombre].filter(Boolean).join(" ").trim() || id;
      m.set(id, { nombreCompleto, dni: dni || "—" });
    });
    return m;
  }, [rowsByCol.personas]);
  const tipoEventoLabelById = useMemo(() => {
    const m = new Map();
    (rowsByCol.cfg_tipo_evento || []).forEach((r) => {
      const id = String(r.id || "").trim().toLowerCase();
      if (!id) return;
      const label = String(r.nombre || r.titulo_ui || r.codigo_interno || r.id || "").trim();
      m.set(id, label || id);
    });
    return m;
  }, [rowsByCol.cfg_tipo_evento]);
  const estadoBandejaLabelById = useMemo(() => {
    const m = new Map();
    (rowsByCol.cfg_estado_bandeja_rrhh || []).forEach((r) => {
      const id = String(r.id || "").trim().toLowerCase();
      if (!id) return;
      const label = String(r.nombre || r.titulo_ui || r.codigo_interno || r.id || "").trim();
      m.set(id, label || id);
    });
    return m;
  }, [rowsByCol.cfg_estado_bandeja_rrhh]);
  const registrosFiltradosPorPersona = useMemo(() => {
    const pid = String(form.persona_id || "").trim();
    if (!pid) return [];
    if (tipo === "personas") {
      return registros.filter((r) => String(r.id || "") === pid);
    }
    const filtrados =
      tipo === "declaraciones_grupo_familiar"
        ? registros.filter((r) => String(r.titular_persona_id || "") === pid)
        : registros.filter((r) => String(r.persona_id || "") === pid);
    return [...filtrados].sort((a, b) => sortRegistrosVigentes(a, b, tipo));
  }, [registros, tipo, form.persona_id]);

  const eventosPersona = useMemo(() => {
    if (!form.persona_id) return [];
    const all = rowsByCol.eventos_ticket || [];
    const { desde, hasta } = rangoEventos;
    return all
      .filter((e) => String(e.persona_id || "") === String(form.persona_id || ""))
      .filter((e) => isEventoAuditoriaDatosPersonales(e))
      .filter((e) => eventoEnRangoAuditoria(e, desde, hasta))
      .sort((a, b) => String(b.ocurrido_en || "").localeCompare(String(a.ocurrido_en || "")))
      .slice(0, 80);
  }, [rowsByCol.eventos_ticket, form.persona_id, rangoEventos]);

  function setField(key, value) {
    setForm((p) => updateDatosPersonalesField({ prevForm: p, key, value, tipo, modoEdicion }));
  }

  function hydrateFrom(r) {
    const next = hydrateDatosPersonales({ record: r, prevForm: form, emptyFamiliar });
    if (!next) return;
    setForm(next.form);
    setFamiliares(next.familiares);
  }

  function validar() {
    return validateDatosPersonales({ tipo, form, familiares });
  }

  async function subirFotoRostro(file, dni) {
    const safeDni = String(dni || "sin-dni").replace(/[^\dA-Za-z_-]/g, "") || "sin-dni";
    const safeName = String(file.name || "foto").replace(/[^\w.-]/g, "_");
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
      let datos;
      let warnings = [];
      let fotoRostro = null;
      if (tipo === "personas") {
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
      }
      datos = buildDatosPayload({
        tipo,
        form,
        familiares,
        modoEdicion,
        editId,
        estadoDdjjDefault: ESTADO_DDJJ_DEFAULT_PERSONALES,
        fotoRostro,
      });
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
      const msg = ex instanceof Error ? ex.message : "No se pudo guardar.";
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="perfil-screen min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Datos personales</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pantalla operativa de datos personales con conexión directa a Firestore (sin datos ficticios).
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            <p><strong>Objetivo:</strong> mantener ficha personal, formación, DDJJ y consentimientos.</p>
            <p><strong>Resultado:</strong> perfil actualizado y validado según catálogos V2.</p>
            <p><strong>Cuándo usar:</strong> alta, actualización o corrección de datos personales por persona_id.</p>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Carga/edición de registros</p>
          <p className="mt-1 text-sm text-slate-600">
            Elegí colección objetivo y completá los campos requeridos. Los seleccionables se cargan desde
            catálogos en BD.
          </p>
          <form className="perfil-form mt-4 space-y-4" onSubmit={onSave}>
            <FormHeaderControls
              tipo={tipo}
              setTipo={setTipo}
              personaId={form.persona_id}
              setPersonaId={(value) => setField("persona_id", value)}
              personaOptions={optsPersonas}
              showPersonaSelector={isRrhh}
              modoEdicion={modoEdicion}
              setModoEdicion={setModoEdicion}
              setEditId={setEditId}
              registros={registrosFiltradosPorPersona}
              hydrateFrom={hydrateFrom}
            />

            {(tipo === "personas" || tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos") && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                {tipo === "personas" && (
                  <PersonaFields
                    form={form}
                    setField={setField}
                    lockSensitiveFields={readOnlyByDefault}
                    readOnly={readOnlyByDefault}
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

                {tipo === "formacion_agente" && (
                  <FormacionFields
                    form={form}
                    setField={setField}
                    disabled={readOnlyByDefault}
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
                    estadoDeclaracionIdActual={estadoDeclaracionIdActual}
                    estadoDeclaracionUiLabel={estadoDeclaracionUiLabel}
                    HELP={HELP}
                    modoEdicion={modoEdicion}
                    form={form}
                    nextDeclaracionVersion={nextDeclaracionVersion}
                    setFamiliares={setFamiliares}
                    emptyFamiliar={emptyFamiliar}
                    familiares={familiares}
                    optsParentesco={optsParentesco}
                    disabled={readOnlyByDefault}
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
                    disabled={readOnlyByDefault}
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
              <button type="submit" disabled={saving || !modoEdicion} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar datos en Base de Datos"}
              </button>
            </div>
          </form>
        </Card>

        {isRrhh && (
        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Colecciones y registros (vista rápida)</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {COLECCIONES_BASE.map((c) => (
              <div key={c} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c}</p>
                {(() => {
                  const pid = String(form.persona_id || "").trim();
                  const baseRows = rowsByCol[c] || [];
                  let rowsFiltradas = [];
                  if (pid) {
                    if (c === "personas") {
                      rowsFiltradas = baseRows.filter((r) => String(r.id || "") === pid);
                    } else if (c === "declaraciones_grupo_familiar") {
                      rowsFiltradas = baseRows.filter((r) => String(r.titular_persona_id || "") === pid);
                    } else {
                      rowsFiltradas = baseRows.filter((r) => String(r.persona_id || "") === pid);
                    }
                  }
                  return (
                    <p className="mt-1 text-sm text-slate-700">
                      {!pid
                        ? "Seleccioná PERSONA (persona_id) para cargar datos."
                        : loadingByCol[c]
                          ? `Cargando...${Number(progressByCol[c] || 0) > 0 ? ` (${progressByCol[c]} cargados)` : ""}`
                          : `Registros persona: ${rowsFiltradas.length}${Number(durationByCol[c] || 0) > 0 ? ` · ${durationByCol[c]} ms` : ""}`}
                    </p>
                  );
                })()}
                {(() => {
                  const pid = String(form.persona_id || "").trim();
                  const baseRows = rowsByCol[c] || [];
                  if (!pid) return [];
                  if (c === "personas") return baseRows.filter((r) => String(r.id || "") === pid).slice(0, 3);
                  if (c === "declaraciones_grupo_familiar") {
                    return baseRows
                      .filter((r) => String(r.titular_persona_id || "") === pid)
                      .slice(0, 3);
                  }
                  return baseRows.filter((r) => String(r.persona_id || "") === pid).slice(0, 3);
                })().map((r) => (
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
        )}
        {tipo === "personas" && form.persona_id && (
          <Card className="px-4 py-4 md:px-5">
            <p className="text-base font-semibold text-slate-900">Eventos recientes de auditoría</p>
            <p className="mt-1 text-sm text-slate-600">
              Últimos cambios informados por acción (valor anterior y nuevo por campo).
            </p>
            {isRrhh ? (
              <p className="mt-1 text-xs text-slate-500">
                Mostrando eventos vinculados a este <span className="font-semibold">persona_id</span>. La vista total RRHH se concentra en la bandeja de notificaciones.
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Desde
                <input
                  type="date"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                  value={rangoEventos.desde}
                  onChange={(e) => {
                    const def = mesEnCursoRangoLocal();
                    commitEventosQuery({
                      desde: e.target.value || def.desde,
                      hasta: rangoEventos.hasta,
                    });
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Hasta
                <input
                  type="date"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                  value={rangoEventos.hasta}
                  onChange={(e) => {
                    const def = mesEnCursoRangoLocal();
                    commitEventosQuery({
                      desde: rangoEventos.desde,
                      hasta: e.target.value || def.hasta,
                    });
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => commitEventosQuery(mesEnCursoRangoLocal())}
              >
                Mes en curso
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {eventosPersona.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Sin eventos en el rango de fechas seleccionado (por defecto, mes en curso).
                </p>
              ) : (
                eventosPersona.map((evt) => (
                  <div key={evt.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    {(() => {
                      const persona = personaDataById.get(String(evt.persona_id || "").trim()) || {
                        nombreCompleto: String(evt.persona_id || "—"),
                        dni: "—",
                      };
                      const actorPersonaId = String(evt.actor_persona_id || evt.persona_id || "").trim();
                      const actorPersona = personaDataById.get(actorPersonaId) || {
                        nombreCompleto: actorPersonaId || "—",
                        dni: "—",
                      };
                      const tipoEventoId = String(evt.tipo_evento_cfg_id || "").trim().toLowerCase();
                      const tipoEventoLabel = tipoEventoLabelById.get(tipoEventoId) || tipoEventoId || "—";
                      const estadoId = String(evt.estado_bandeja_rrhh_id || "").trim().toLowerCase();
                      const estadoLabel = estadoBandejaLabelById.get(estadoId) || estadoId || "—";
                      return (
                        <>
                    <p className="text-slate-700">
                      {formatFechaEventoDdMmAaaa(evt.ocurrido_en)} · {persona.nombreCompleto} · DNI: {persona.dni}
                    </p>
                    <p className="text-slate-600">
                      {tipoEventoLabel} · Estado: {estadoLabel} ({estadoId || "—"})
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-slate-500">({String(evt.id || "—")})</p>
                    <p className="text-slate-700">
                      Por el USUARIO: {actorPersona.nombreCompleto} · DNI: {actorPersona.dni}
                    </p>
                    {Array.isArray(evt.payload?.cambios) &&
                      evt.payload.cambios.length > 0 &&
                      evt.payload.cambios.map((c, i) => (
                        <p key={`${evt.id}-${i}`} className="text-slate-600">
                          {String(c.campo || "campo")}: {String(c.anterior ?? "null")} {"->"}{" "}
                          {String(c.nuevo ?? "null")}
                        </p>
                      ))}
                    {(!Array.isArray(evt.payload?.cambios) || evt.payload.cambios.length === 0) && (
                      <p className="text-slate-500">Sin campos actualizados informados en este evento.</p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
