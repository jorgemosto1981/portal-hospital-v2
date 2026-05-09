import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import {
  actualizarArticuloCfg,
  crearArticuloCfg,
  obtenerArticuloCfgPorId,
} from "../../services/articulosCfgService.js";
import {
  applyDuplicacionLimpia,
  articuloCfgDocToFormState,
  canPublishArticulo,
  createArticuloFormUpdate,
  createInitialArticuloFormState,
  getArticuloBorradorFlattenErrors,
  parseArticuloBorrador,
  parseArticuloPublicable,
} from "../../utils/articulos/index.js";
import { useArticuloGeneralCatalogos } from "./hooks/useArticuloGeneralCatalogos.js";
import ArticuloFormReadinessBadge from "./ArticuloFormReadinessBadge.jsx";
import DocumentacionTab from "./tabs/DocumentacionTab.jsx";
import ElegibilidadTab from "./tabs/ElegibilidadTab.jsx";
import GeneralTab from "./tabs/GeneralTab.jsx";
import PlazosTab from "./tabs/PlazosTab.jsx";
import WorkflowTab from "./tabs/WorkflowTab.jsx";

const TABS = [
  { id: "general", label: "General" },
  { id: "elegibilidad", label: "Elegibilidad" },
  { id: "plazos", label: "Plazos" },
  { id: "workflow", label: "Workflow" },
  { id: "documentacion", label: "Documentación" },
];

export default function ArticuloFormConfig() {
  const { articuloId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const personaId =
    typeof claims?.persona_id === "string" ? claims.persona_id.trim() : "";

  const [data, setData] = useState(() => createInitialArticuloFormState());
  const [tabId, setTabId] = useState("general");
  const [cargandoDoc, setCargandoDoc] = useState(Boolean(articuloId));

  const update = useMemo(() => createArticuloFormUpdate(setData), []);

  const erroresBorrador = useMemo(
    () => getArticuloBorradorFlattenErrors(data),
    [data],
  );

  const puedePublicar = useMemo(() => canPublishArticulo(data), [data]);

  const { catalogos, recargarCatalogos } = useArticuloGeneralCatalogos();

  const cargar = useCallback(async () => {
    if (!articuloId) {
      setCargandoDoc(false);
      return;
    }
    setCargandoDoc(true);
    try {
      const snap = await obtenerArticuloCfgPorId(articuloId);
      const normalizado = articuloCfgDocToFormState(snap);
      if (!normalizado) {
        toast.error("No se encontró el artículo.");
        navigate("/portal/rrhh/configuracion-articulos", { replace: true });
        setData(createInitialArticuloFormState());
        return;
      }
      setData(normalizado);
    } catch (e) {
      toast.error(e?.message || "Error al cargar el artículo.");
    } finally {
      setCargandoDoc(false);
    }
  }, [articuloId, navigate]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const persistirOpciones = useMemo(
    () => ({ personaId: personaId || undefined }),
    [personaId],
  );

  const resolverIdDocumento = () => {
    const desdeForm =
      typeof data.id === "string" && data.id.startsWith("art_") ? data.id : null;
    return desdeForm || articuloId || null;
  };

  const guardarBorrador = async () => {
    const parsed = parseArticuloBorrador(data);
    if (!parsed.success) {
      toast.error("Revisá los campos marcados (borrador inválido).");
      return;
    }
    const payload = parsed.data;
    try {
      const idDoc = resolverIdDocumento();
      if (idDoc) {
        await actualizarArticuloCfg(idDoc, payload, persistirOpciones);
        toast.success("Borrador guardado.");
      } else {
        const { id } = await crearArticuloCfg(payload, persistirOpciones);
        update.field("id", id);
        navigate(`/portal/rrhh/configuracion-articulos/${id}`, { replace: true });
        toast.success("Artículo creado.");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar (Firestore).");
    }
  };

  const publicar = async () => {
    const b = parseArticuloBorrador(data);
    const p = parseArticuloPublicable(data);
    if (!b.success || !p.success) {
      toast.error("Publicación bloqueada: revisá borrador y requisitos normativos.");
      return;
    }
    const payload = b.data;
    try {
      const idDoc = resolverIdDocumento();
      if (idDoc) {
        await actualizarArticuloCfg(idDoc, payload, persistirOpciones);
      } else {
        const { id } = await crearArticuloCfg(payload, persistirOpciones);
        update.field("id", id);
        navigate(`/portal/rrhh/configuracion-articulos/${id}`, { replace: true });
      }
      toast.success("Publicación persistida.");
    } catch (e) {
      toast.error(e?.message || "No se pudo publicar (Firestore).");
    }
  };

  const duplicar = () => {
    const siguiente = applyDuplicacionLimpia(data, {
      personaId: personaId || undefined,
    });
    setData(siguiente);
    navigate("/portal/rrhh/configuracion-articulos", { replace: true });
    toast.success("Copia cargada en el formulario. Guardá como nuevo documento.");
  };

  const deshabilitar = () => {
    update.field("activo", false);
    toast("Marcado como inactivo. Guardá para persistir.", { icon: "ℹ️" });
  };

  const contenidoTab =
    tabId === "general" ? (
      <GeneralTab
        data={data}
        update={update}
        errors={erroresBorrador}
        catalogoTipoArticulo={catalogos.tipoArticulo}
        catalogoUnidadMedida={catalogos.unidadMedida}
        catalogoNormaPrincipalTipo={catalogos.normaPrincipalTipo}
        onRecargarCatalogos={recargarCatalogos}
      />
    ) : tabId === "elegibilidad" ? (
      <ElegibilidadTab data={data} update={update} errors={erroresBorrador} />
    ) : tabId === "plazos" ? (
      <PlazosTab data={data} update={update} errors={erroresBorrador} />
    ) : tabId === "workflow" ? (
      <WorkflowTab data={data} update={update} errors={erroresBorrador} />
    ) : (
      <DocumentacionTab data={data} update={update} errors={erroresBorrador} />
    );

  return (
    <div className="min-h-[calc(100dvh-6rem)] bg-slate-50 px-3 py-6 md:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-100 bg-white p-4 shadow-xl md:p-8">
        <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {typeof data.titulo === "string" ? data.titulo : "Artículo"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Configuración <span className="font-mono text-slate-600">cfg_articulos</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ArticuloFormReadinessBadge data={data} />
            <button
              type="button"
              onClick={guardarBorrador}
              disabled={cargandoDoc}
              className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={publicar}
              disabled={cargandoDoc || !puedePublicar}
              className="min-h-11 touch-manipulation rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm outline-none ring-blue-500 focus-visible:ring-2 active:bg-blue-700 disabled:opacity-40"
            >
              Publicar
            </button>
            <button
              type="button"
              onClick={duplicar}
              className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-100"
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={deshabilitar}
              className="min-h-11 touch-manipulation rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 outline-none ring-amber-500 focus-visible:ring-2 active:bg-amber-100"
            >
              Deshabilitar
            </button>
          </div>
        </header>

        <nav
          className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-100 pb-px"
          aria-label="Secciones del artículo"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabId(t.id)}
              className={`min-h-11 shrink-0 touch-manipulation rounded-t-lg px-4 py-2 text-sm font-medium outline-none ring-blue-500 focus-visible:ring-2 ${
                tabId === t.id
                  ? "border border-b-0 border-slate-200 bg-white text-slate-900"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 min-h-[12rem]">
          {cargandoDoc ? (
            <p className="text-sm text-slate-500">Cargando documento…</p>
          ) : (
            contenidoTab
          )}
        </div>

        {!puedePublicar ? (
          <p className="mt-6 text-xs text-slate-500">
            El botón Publicar exige borrador válido y requisitos normativos completos (doble validación).
          </p>
        ) : null}
      </div>
    </div>
  );
}
