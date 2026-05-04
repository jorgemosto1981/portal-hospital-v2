import Card from "../components/ui/Card.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import {
  guardarRegistroPersonal,
  listarColeccionPersonal,
  registrarNotificacionCambioDatosPersonales,
} from "../services/datosPersonalesService.js";
import { storageV2 } from "../services/firebase.js";
import { useAuthClaims } from "../features/auth/useAuthClaims.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import {
  ACCIONES_PERMITIDAS_USUARIO,
  ACCION_CAMBIO_DOMICILIO,
  ACCION_CAMBIO_TELEFONOS,
  COLECCIONES_BASE,
  COLECCIONES_CFG,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  HELP,
  INITIAL_FORM_DATA_PERSONALES,
  MSG_CAMPO_NO_EDITABLE_ROL,
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

function readTipoFromSearchOnce() {
  if (typeof window === "undefined") return "personas";
  const t = new URLSearchParams(window.location.search).get("tipo");
  return t && TIPOS_URL_SET.has(t) ? t : "personas";
}

export default function DatosPersonales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims, hasPortalRoles } = useAuthClaims(user);
  const personaIdClaim = String((claims && claims.persona_id) || "").trim();
  const isRrhh = hasPortalRoles(["rrhh", "admin"]);
  const [accionHabilitada, setAccionHabilitada] = useState("");
  /** Usuario: siempre; RRHH: solo en modo “acción” (mismo circuito de notificación que usuario). */
  const lockSensitivePersonaFields = !isRrhh || Boolean(accionHabilitada);
  const [tipo, setTipo] = useState(readTipoFromSearchOnce);
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

  /** Sincroniza `tipo` si el usuario usa atrás/adelante del navegador. */
  useEffect(() => {
    const t = searchParams.get("tipo");
    if (t && TIPOS_URL_SET.has(t) && t !== tipo) {
      setTipo(t);
    }
  }, [searchParams, tipo]);

  /** RRHH: `persona_id` en URL (solo lectura de query; no aplicable a agente). */
  useEffect(() => {
    if (!isRrhh) return;
    const pid = String(searchParams.get("persona_id") || "").trim();
    if (!pid || !/^per_/i.test(pid)) return;
    setForm((prev) => (String(prev.persona_id || "").trim() === pid ? prev : { ...prev, persona_id: pid }));
  }, [searchParams, isRrhh]);

  /** Escribe `?tipo=`, `persona_id` (RRHH), `desde` y `hasta` (mes en curso por defecto). */
  useEffect(() => {
    const def = mesEnCursoRangoLocal();
    const wantTipo = tipo;
    const wantPid =
      isRrhh && String(form.persona_id || "").trim() ? String(form.persona_id).trim() : null;
    let wantDesde = parseYmd(searchParams.get("desde")) ?? def.desde;
    let wantHasta = parseYmd(searchParams.get("hasta")) ?? def.hasta;
    const nh = normalizarDesdeHasta(wantDesde, wantHasta);
    if (nh) {
      wantDesde = nh.desde;
      wantHasta = nh.hasta;
    }

    const hasTipo = searchParams.get("tipo");
    const hasPid = searchParams.get("persona_id") || null;
    const hasDesde = searchParams.get("desde");
    const hasHasta = searchParams.get("hasta");

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
    setSearchParams(next, { replace: true });
  }, [tipo, form.persona_id, isRrhh, searchParams, setSearchParams]);

  const rangoEventos = useMemo(() => {
    const def = mesEnCursoRangoLocal();
    const d = parseYmd(searchParams.get("desde")) ?? def.desde;
    const h = parseYmd(searchParams.get("hasta")) ?? def.hasta;
    return normalizarDesdeHasta(d, h) ?? def;
  }, [searchParams]);

  const commitEventosQuery = useCallback(
    (/** @type {{ desde?: string, hasta?: string }} */ partial) => {
      const def = mesEnCursoRangoLocal();
      const next = new URLSearchParams(searchParams);
      next.set("tipo", tipo);
      if (isRrhh && String(form.persona_id || "").trim()) {
        next.set("persona_id", String(form.persona_id).trim());
      } else {
        next.delete("persona_id");
      }
      const desde = partial.desde ?? parseYmd(searchParams.get("desde")) ?? def.desde;
      const hasta = partial.hasta ?? parseYmd(searchParams.get("hasta")) ?? def.hasta;
      const n = normalizarDesdeHasta(desde, hasta);
      if (n) {
        next.set("desde", n.desde);
        next.set("hasta", n.hasta);
      }
      setSearchParams(next, { replace: true });
    },
    [form.persona_id, isRrhh, searchParams, setSearchParams, tipo],
  );

  useEffect(() => {
    setModoEdicion(false);
    setEditId("");
    setSaveMsg("");
    setAccionHabilitada("");
  }, [tipo]);

  useEffect(() => {
    setEditId("");
  }, [form.persona_id, tipo]);

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
  const optsPersonas = useMemo(
    () =>
      (rowsByCol.personas || []).map((p) => ({
        value: String(p.id),
        label: p.nombre || p.apellido ? `${p.apellido || ""} ${p.nombre || ""} (${p.id})` : String(p.id),
      })),
    [rowsByCol.personas],
  );
  const personaLabelById = useMemo(() => {
    const m = new Map();
    optsPersonas.forEach((o) => m.set(String(o.value), String(o.label)));
    return m;
  }, [optsPersonas]);
  const registrosFiltradosPorPersona = useMemo(() => {
    const pid = String(form.persona_id || "").trim();
    if (!pid) return [];
    if (tipo === "personas") {
      return registros.filter((r) => String(r.id || "") === pid);
    }
    if (tipo === "declaraciones_grupo_familiar") {
      return registros.filter((r) => String(r.titular_persona_id || "") === pid);
    }
    return registros.filter((r) => String(r.persona_id || "") === pid);
  }, [registros, tipo, form.persona_id]);
  const registrosFiltradosOptions = useMemo(() => {
    return registrosFiltradosPorPersona.map((r) => {
      const pidRaw =
        tipo === "personas"
          ? String(r.id || "")
          : tipo === "declaraciones_grupo_familiar"
            ? String(r.titular_persona_id || "")
            : String(r.persona_id || "");
      const personaLabel = personaLabelById.get(pidRaw) || pidRaw || "sin persona";
      return {
        id: String(r.id || ""),
        label: `${String(r.id || "")} · ${personaLabel}`,
      };
    });
  }, [registrosFiltradosPorPersona, tipo, personaLabelById]);

  const camposEditablesPorAccion = useMemo(() => {
    if (accionHabilitada === ACCION_CAMBIO_DOMICILIO) {
      return new Set([
        "calle",
        "numero",
        "piso",
        "departamento",
        "provincia_id",
        "pais_id",
        "localidad_id",
        "codigo_postal",
        "referencia",
      ]);
    }
    if (accionHabilitada === ACCION_CAMBIO_TELEFONOS) {
      return new Set(["telefono_celular", "telefono_fijo", "recibe_notificaciones_sms"]);
    }
    return new Set();
  }, [accionHabilitada]);

  const eventosPersona = useMemo(() => {
    if (!form.persona_id) return [];
    const all = rowsByCol.eventos_ticket || [];
    const { desde, hasta } = rangoEventos;
    return all
      .filter((e) => String(e.persona_id || "") === String(form.persona_id || ""))
      .filter(
        (e) =>
          String(e.tipo_evento_id || "").startsWith("EVT_DATOS_CAMBIO_") ||
          String(e.tipo_evento_id || "").startsWith("EVT_DATOS_NOTIF_"),
      )
      .filter((e) => eventoEnRangoAuditoria(e, desde, hasta))
      .sort((a, b) => String(b.ocurrido_en || "").localeCompare(String(a.ocurrido_en || "")))
      .slice(0, 80);
  }, [rowsByCol.eventos_ticket, form.persona_id, rangoEventos]);

  async function onNotificarCambio(coleccionObjetivo, accion) {
    setSaveMsg("");
    if (!form.persona_id) {
      setSaveMsg("Seleccioná persona_id antes de notificar cambios.");
      return;
    }
    try {
      await registrarNotificacionCambioDatosPersonales({
        persona_id: form.persona_id,
        coleccion_objetivo: coleccionObjetivo,
        accion,
      });
      setSaveMsg("Notificación registrada para toma de conocimiento RRHH.");
      await cargar();
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "No se pudo registrar la notificación.";
      setSaveMsg(msg);
    }
  }

  function canEditPersonaField(field) {
    if (isRrhh && !accionHabilitada) return true;
    if (!accionHabilitada) return false;
    return camposEditablesPorAccion.has(field);
  }

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
    if (!isRrhh && (tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos")) {
      setSaveMsg("Esta colección es de solo visualización para rol usuario. Usá el botón de notificación a RRHH.");
      return;
    }
    if (tipo === "personas" && !isRrhh && !accionHabilitada) {
      setSaveMsg("Primero seleccioná una acción para habilitar la edición de datos personales.");
      return;
    }
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
        accionHabilitada: tipo === "personas" ? accionHabilitada : null,
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
      if (tipo === "personas" && accionHabilitada) {
        setAccionHabilitada("");
      }
      await cargar();
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "No se pudo guardar.";
      if (String(msg).includes("[AUTH-PER-001]")) {
        setSaveMsg(MSG_CAMPO_NO_EDITABLE_ROL);
      } else if (String(msg).includes("[AUTH-PER-004]") || String(msg).includes("[AUTH-PER-005]")) {
        setSaveMsg(
          "Acción no válida para guardar cambios. Primero habilitá la acción correspondiente y editá solo los campos permitidos.",
        );
      } else {
        setSaveMsg(msg);
      }
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
          {lockSensitivePersonaFields && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {!isRrhh ? `Perfil usuario: ${MSG_CAMPO_NO_EDITABLE_ROL}` : `Modo acción (igual que usuario): ${MSG_CAMPO_NO_EDITABLE_ROL}`}
            </p>
          )}
          {tipo === "personas" && (
            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-800">
              <p className="font-semibold">Acciones para solicitar cambios (con notificación a bandeja)</p>
              <p className="mt-1">
                Elegí una acción para editar solo esos datos y disparar el circuito de novedades. Personal de RRHH también
                puede usarlo para sus propios datos particulares; si preferís editar todo sin restricción, activá edición
                administrativa (solo RRHH).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACCIONES_PERMITIDAS_USUARIO.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccionHabilitada(acc.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      accionHabilitada === acc.id
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-blue-300 bg-white text-blue-700"
                    }`}
                  >
                    Habilitar: {acc.titulo}
                  </button>
                ))}
                {isRrhh ? (
                  <button
                    type="button"
                    onClick={() => setAccionHabilitada("")}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      !accionHabilitada
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-300 bg-white text-emerald-800"
                    }`}
                  >
                    Edición administrativa (todos los campos)
                  </button>
                ) : null}
              </div>
              <p className="mt-2">
                Acción activa:{" "}
                <span className="font-semibold">
                  {accionHabilitada
                    ? ACCIONES_PERMITIDAS_USUARIO.find((x) => x.id === accionHabilitada)?.titulo || accionHabilitada
                    : isRrhh
                      ? "ninguna (edición completa RRHH)"
                      : "ninguna"}
                </span>
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onNotificarCambio("personas", "notificar_cambio_foto_rostro")}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700"
                >
                  Notificar cambio de foto de rostro
                </button>
              </div>
            </div>
          )}
          {tipo === "formacion_agente" && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <p className="font-semibold">
                {isRrhh
                  ? "Formación: como RRHH podés editar el formulario o registrar una notificación (p. ej. datos propios)."
                  : "Formación del agente: solo visualización para usuario."}
              </p>
              <button
                type="button"
                onClick={() => onNotificarCambio("formacion_agente", "notificar_cambio_formacion")}
                className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-800"
              >
                Notificar cambio de formación a RRHH
              </button>
            </div>
          )}
          {tipo === "declaraciones_grupo_familiar" && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <p className="font-semibold">
                {isRrhh
                  ? "DDJJ familiar: como RRHH podés editar o registrar una notificación según corresponda."
                  : "DDJJ familiar: solo visualización para usuario."}
              </p>
              <button
                type="button"
                onClick={() =>
                  onNotificarCambio("declaraciones_grupo_familiar", "notificar_actualizacion_ddjj_familiar")
                }
                className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-800"
              >
                Notificar actualización DDJJ a RRHH
              </button>
            </div>
          )}
          {tipo === "consentimientos" && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
              {isRrhh ? (
                <p>
                  Consentimientos: como RRHH podés editarlos en el formulario. Los usuarios solo consultan; si necesitan
                  cambios deben gestionarlo con RRHH.
                </p>
              ) : (
                <p>Consentimientos visibles para consulta. Si necesitás cambios, comunicate con RRHH.</p>
              )}
            </div>
          )}
          <form className="mt-4 space-y-4" onSubmit={onSave}>
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
              registrosOptions={registrosFiltradosOptions}
              hydrateFrom={hydrateFrom}
              editId={editId}
            />

            {(tipo === "personas" || tipo === "formacion_agente" || tipo === "declaraciones_grupo_familiar" || tipo === "consentimientos") && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                {tipo === "personas" && (
                  <PersonaFields
                    form={form}
                    setField={setField}
                    lockSensitiveFields={lockSensitivePersonaFields}
                    canEditField={canEditPersonaField}
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
                    disabled={!isRrhh}
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
                    disabled={!isRrhh}
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
                    disabled={!isRrhh}
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

        {isRrhh && (
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
                    <p className="font-mono text-slate-700">{evt.id}</p>
                    <p className="text-slate-600">
                      {String(evt.tipo_evento_id || "—")} · {String(evt.ocurrido_en || "—")}
                    </p>
                    {Array.isArray(evt.payload?.cambios) &&
                      evt.payload.cambios.slice(0, 5).map((c, i) => (
                        <p key={`${evt.id}-${i}`} className="text-slate-600">
                          {String(c.campo || "campo")}: {String(c.anterior ?? "null")} {"->"}{" "}
                          {String(c.nuevo ?? "null")}
                        </p>
                      ))}
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
