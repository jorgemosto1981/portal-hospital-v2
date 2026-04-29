import { useCallback, useEffect, useState } from "react";

import { DATOS_LABORALES_COLECCIONES } from "../../constants/datosLaboralesSchema.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import { COLECCIONES_FORM } from "./constants.js";

export function useDatosLaboralesCollections() {
  const [rowsByCollection, setRowsByCollection] = useState({});
  const [loadingByCollection, setLoadingByCollection] = useState({});
  const [progressByCollection, setProgressByCollection] = useState({});
  const [durationByCollection, setDurationByCollection] = useState({});
  const [errorByCollection, setErrorByCollection] = useState({});

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
    setProgressByCollection({});
    setDurationByCollection({});

    await Promise.all(
      collections.map(async (collectionName) => {
        const startedAt = Date.now();
        try {
          const rows = await listarColeccionLaboral(collectionName, null, ({ loaded }) => {
            setProgressByCollection((prev) => ({ ...prev, [collectionName]: loaded }));
          });
          setRowsByCollection((prev) => ({ ...prev, [collectionName]: rows }));
          setErrorByCollection((prev) => ({ ...prev, [collectionName]: "" }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error de lectura.";
          setRowsByCollection((prev) => ({ ...prev, [collectionName]: [] }));
          setErrorByCollection((prev) => ({ ...prev, [collectionName]: msg }));
        } finally {
          setLoadingByCollection((prev) => ({ ...prev, [collectionName]: false }));
          setDurationByCollection((prev) => ({ ...prev, [collectionName]: Date.now() - startedAt }));
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

  return {
    rowsByCollection,
    loadingByCollection,
    progressByCollection,
    durationByCollection,
    errorByCollection,
    cargarTodo,
  };
}
