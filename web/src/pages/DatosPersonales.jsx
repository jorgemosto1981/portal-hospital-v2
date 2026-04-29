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
  INITIAL_FORM_DATA_PERSONALES,
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
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM_DATA_PERSONALES }));
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
