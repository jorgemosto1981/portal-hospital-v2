import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";

import { storageV2 } from "../../services/firebase.js";

/**
 * @param {{ adjunto: { storage_path: string, nombre_archivo?: string, content_type?: string, es_pdf?: boolean } }} props
 */
export default function VisorPDF({ adjunto }) {
  const storagePath = String(adjunto?.storage_path || "").trim();
  const nombre = String(adjunto?.nombre_archivo || "Certificado médico").trim();
  const esPdf =
    adjunto?.es_pdf === true ||
    String(adjunto?.content_type || "")
      .toLowerCase()
      .includes("pdf") ||
    nombre.toLowerCase().endsWith(".pdf");

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!storagePath) {
      setLoading(false);
      setError("Sin ruta de almacenamiento.");
      return undefined;
    }
    setLoading(true);
    setError("");
    setUrl("");
    (async () => {
      try {
        const downloadUrl = await getDownloadURL(ref(storageV2, storagePath));
        if (!cancelled) setUrl(downloadUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "No se pudo cargar el certificado.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!storagePath) {
    return <p className="text-sm text-slate-500">Sin certificado adjunto.</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Cargando documento…</p>;
  }

  if (error || !url) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        {error || "Error al cargar el adjunto."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{nombre}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-teal-700 underline hover:text-teal-900"
        >
          Abrir en pestaña nueva
        </a>
      </div>
      <div className="h-96 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {esPdf ? (
          <iframe src={url} title={nombre} className="h-full w-full" />
        ) : (
          <img src={url} alt={nombre} className="max-h-96 w-full object-contain" />
        )}
      </div>
    </div>
  );
}
