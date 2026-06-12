import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import FichadasImportPreviewTabla from "../../features/fichadas/FichadasImportPreviewTabla.jsx";
import {
  contenidoTxtDesdeFilasPreview,
  mapaIncluirInicialDesdePreview,
} from "../../features/fichadas/fichadasImportTxt.js";
import {
  enriquecerEnrolamientoConPersonas,
  useRelojBiometricoCatalogo,
} from "../../features/fichadas/useRelojBiometricoCatalogo.js";
import {
  callAplicarImportFichadasReloj,
  callPrevisualizarImportFichadasReloj,
} from "../../services/callables.js";
import { listarColeccion } from "../../services/configuracionCatalogosService.js";

function politicaDesdeReloj(reloj) {
  const p = reloj?.politica_validacion;
  if (p && typeof p === "object") {
    return {
      umbral: p.umbral_duplicado_minutos ?? 2,
      duplicados: p.duplicados || "EXCLUIR_SEGUNDA",
    };
  }
  return { umbral: 2, duplicados: "EXCLUIR_SEGUNDA" };
}

export default function FichadasImportRrhhPage() {
  const { relojes, enrolPorReloj, loading: loadingCat, error: errorCat } = useRelojBiometricoCatalogo();
  const [relojId, setRelojId] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [contenidoTxt, setContenidoTxt] = useState("");
  const [preview, setPreview] = useState(null);
  const [incluirPorLinea, setIncluirPorLinea] = useState({});
  const [procesando, setProcesando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const relojSel = useMemo(
    () => relojes.find((r) => String(r.id) === relojId) || null,
    [relojes, relojId],
  );
  const politica = useMemo(() => politicaDesdeReloj(relojSel), [relojSel]);
  const grupoId = String(relojSel?.grupo_trabajo_id || relojSel?.grupo_id || "").trim();

  const onArchivo = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setContenidoTxt(typeof reader.result === "string" ? reader.result : "");
      setPreview(null);
      setIncluirPorLinea({});
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const ejecutarPreview = useCallback(async () => {
    if (!relojId || !contenidoTxt.trim()) {
      toast.error("Seleccioná reloj y archivo TXT.");
      return;
    }
    setProcesando(true);
    try {
      let enrolamiento_por_tarjeta = {};
      const tarjetasMap = enrolPorReloj.get(relojId);
      if (tarjetasMap?.size) {
        const personas = await listarColeccion("personas");
        enrolamiento_por_tarjeta = enriquecerEnrolamientoConPersonas(tarjetasMap, personas);
      }
      const res = await callPrevisualizarImportFichadasReloj({
        contenido_txt: contenidoTxt,
        umbral_duplicado_minutos: politica.umbral,
        politica_duplicados: politica.duplicados,
        enrolamiento_por_tarjeta,
      });
      const data = res.data;
      setPreview(data);
      setIncluirPorLinea(mapaIncluirInicialDesdePreview(data?.filas || []));
      toast.success(
        `Preview: ${data?.resumen?.lineas_validas ?? 0} válidas · ${data?.resumen?.sin_persona ?? 0} sin persona`,
      );
    } catch (err) {
      toast.error(err?.message || "Error al previsualizar.");
    } finally {
      setProcesando(false);
    }
  }, [relojId, contenidoTxt, enrolPorReloj, politica]);

  const aplicarLote = useCallback(async () => {
    if (!preview || !grupoId) {
      toast.error("Falta grupo de trabajo del reloj o preview.");
      return;
    }
    if (preview.resumen?.bloquear_aplicar) {
      toast.error("Política BLOQUEAR_APLICAR: resolvé duplicados antes de aplicar.");
      return;
    }
    const txtLimpio = contenidoTxtDesdeFilasPreview(preview.filas || [], incluirPorLinea);
    if (!txtLimpio.trim()) {
      toast.error("No hay líneas incluidas para aplicar.");
      return;
    }
    setAplicando(true);
    try {
      const res = await callAplicarImportFichadasReloj({
        reloj_id: relojId,
        grupo_trabajo_id: grupoId,
        contenido_txt: txtLimpio,
        umbral_duplicado_minutos: politica.umbral,
      });
      const d = res.data || {};
      toast.success(
        `Lote aplicado: ${d.vis_documentos_tocados ?? 0} vis tocados · ${d.huerfanas_insertadas ?? 0} huérfanas en cola`,
        { duration: 6000 },
      );
      setPreview(null);
      setContenidoTxt("");
      setArchivoNombre("");
    } catch (err) {
      toast.error(err?.message || "Error al aplicar lote.");
    } finally {
      setAplicando(false);
    }
  }, [preview, grupoId, incluirPorLinea, relojId, politica]);

  const toggleIncluir = useCallback((numeroLinea, incluir) => {
    setIncluirPorLinea((prev) => ({ ...prev, [numeroLinea]: incluir }));
  }, []);

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-24 md:px-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Importar fichadas (TXT)</h1>
        <p className="text-sm text-slate-500">
          Preview en memoria · apply atómico.{" "}
          <Link to="/portal/rrhh/fichadas-huerfanas" className="text-blue-600 hover:underline">
            Bandeja huérfanas
          </Link>
        </p>
      </header>

      {errorCat ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{errorCat}</p>
      ) : null}

      <Card className="space-y-4 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Reloj / sector
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={relojId}
            onChange={(e) => {
              setRelojId(e.target.value);
              setPreview(null);
            }}
            disabled={loadingCat}
          >
            <option value="">— Seleccionar —</option>
            {relojes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre || r.id}
              </option>
            ))}
          </select>
        </label>
        {relojSel ? (
          <p className="text-xs text-slate-500">
            Grupo: <span className="font-mono">{grupoId || "sin gdt en cfg"}</span> · Política duplicados:{" "}
            <strong>{politica.duplicados}</strong> · Umbral {politica.umbral} min
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Archivo .txt
          <input
            type="file"
            accept=".txt,text/plain"
            className="mt-1 w-full text-sm"
            onChange={onArchivo}
          />
          {archivoNombre ? <span className="mt-1 block text-xs text-slate-500">{archivoNombre}</span> : null}
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={ejecutarPreview}
            disabled={procesando || !relojId || !contenidoTxt.trim()}
          >
            {procesando ? "Procesando…" : "Previsualizar"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={aplicarLote}
            disabled={
              aplicando || !preview || preview.resumen?.bloquear_aplicar || !grupoId
            }
          >
            {aplicando ? "Aplicando…" : "Aplicar lote"}
          </button>
        </div>
      </Card>

      {preview ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span>Válidas: {preview.resumen?.lineas_validas}</span>
            <span>Inválidas: {preview.resumen?.lineas_invalidas}</span>
            <span>Duplicados: {preview.resumen?.duplicados_probables}</span>
            <span>Sin persona: {preview.resumen?.sin_persona}</span>
          </div>
          <FichadasImportPreviewTabla
            filas={preview.filas}
            incluirPorLinea={incluirPorLinea}
            onToggleIncluir={toggleIncluir}
            politicaDuplicados={preview.politica_duplicados}
          />
        </Card>
      ) : null}
    </div>
  );
}
