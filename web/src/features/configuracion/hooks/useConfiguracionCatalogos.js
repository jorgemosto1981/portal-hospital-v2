import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  ITEM_CATALOGO_DEFAULT,
  ITEM_CATALOGO_POR_KEY,
} from "../../../constants/configuracionCatalogos.js";
import { authV2 } from "../../../services/firebase.js";
import { guardarOpcion, listarColeccion } from "../../../services/configuracionCatalogosService.js";
import { sugerirIdCatalogo } from "../../../utils/catalogoId.js";
import {
  callableErrorMessage,
  dateInputToIsoEnd,
  isoToDateInputValue,
} from "../configuracionFormatters.js";
import runtimeFlags from "../../../../../shared/runtimeFlags.json";
import { hasAnyPortalRole, MANAGEMENT_PORTAL_ROLES } from "../../routing/portalRole.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RX_GDT_ID_V2 = /^gdt_[0-9A-HJKMNP-TV-Z]{26}$/;

function encodeBase32(num, len) {
  let n = num;
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function randomBase32(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i += 1) out += CROCKFORD[bytes[i] % 32];
  return out;
}

function generateGdtIdV2() {
  return `gdt_${encodeBase32(Date.now(), 10)}${randomBase32(16)}`;
}

export function useConfiguracionCatalogos() {
  const openAccessTemp = runtimeFlags.OPEN_ACCESS_TEMP === true;
  const [user, setUser] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [isRrhh, setIsRrhh] = useState(false);
  const [selectedKey, setSelectedKey] = useState(ITEM_CATALOGO_DEFAULT.key);
  const itemActual = ITEM_CATALOGO_POR_KEY[selectedKey] || ITEM_CATALOGO_DEFAULT;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [modal, setModal] = useState("cerrado");
  const [addNombre, setAddNombre] = useState("");
  const [addId, setAddId] = useState("");
  const idManualRef = useRef(false);
  const [editNombre, setEditNombre] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [editVigDesde, setEditVigDesde] = useState("");
  const [editVigHasta, setEditVigHasta] = useState("");
  const [editDocId, setEditDocId] = useState("");
  const [provincias, setProvincias] = useState([]);
  const [addProvinciaId, setAddProvinciaId] = useState("");
  const [editProvinciaId, setEditProvinciaId] = useState("");

  const isLocalidad = itemActual.collectionName === "cfg_localidad";
  const isGrupoTrabajo = itemActual.collectionName === "grupos_de_trabajo";
  const tituloPanel = useMemo(() => itemActual.etiqueta, [itemActual.etiqueta]);
  const canReadCatalogos = openAccessTemp || (!!user && isRrhh);
  const canWriteCatalogos = openAccessTemp || (!!user && isRrhh);
  const accesoBloqueado = !openAccessTemp && tokenReady && (!user || !isRrhh);

  const recargar = useCallback(async () => {
    if (!canReadCatalogos) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listarColeccion(itemActual.collectionName);
      const sorted = [...list].sort((a, b) => {
        const na = String(a.nombre || a.id || "");
        const nb = String(b.nombre || b.id || "");
        return na.localeCompare(nb, "es", { sensitivity: "base" });
      });
      setRows(sorted);
    } catch (e) {
      setLoadError(callableErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canReadCatalogos, itemActual.collectionName]);

  useEffect(() => {
    const unsub = onAuthStateChanged(authV2, async (u) => {
      setUser(u);
      setTokenReady(false);
      if (!u) {
        setIsRrhh(false);
        setTokenReady(true);
        return;
      }
      try {
        const t = await u.getIdTokenResult(true);
        setIsRrhh(hasAnyPortalRole(t.claims, MANAGEMENT_PORTAL_ROLES));
      } catch {
        setIsRrhh(false);
      } finally {
        setTokenReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    if (!canReadCatalogos || !isLocalidad) {
      setProvincias([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const list = await listarColeccion("cfg_provincia");
        if (cancel) return;
        const sorted = [...list].sort((a, b) => {
          const na = String(a.nombre || a.id || "");
          const nb = String(b.nombre || b.id || "");
          return na.localeCompare(nb, "es", { sensitivity: "base" });
        });
        setProvincias(sorted);
      } catch {
        if (!cancel) setProvincias([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [canReadCatalogos, isLocalidad]);

  function abrirAgregar() {
    idManualRef.current = false;
    setAddNombre("");
    setAddId(isGrupoTrabajo ? generateGdtIdV2() : itemActual.idPrefix.toUpperCase());
    if (isLocalidad) {
      setAddProvinciaId(provincias[0]?.id ? String(provincias[0].id) : "");
    } else {
      setAddProvinciaId("");
    }
    setModal("agregar");
  }

  function abrirEditar(row) {
    setEditDocId(row.id);
    setEditNombre(String(row.nombre ?? ""));
    setEditActivo(row.activo !== false);
    setEditVigDesde(isoToDateInputValue(row.vigente_desde));
    setEditVigHasta(isoToDateInputValue(row.vigente_hasta));
    setEditProvinciaId(row.provincia_id != null ? String(row.provincia_id) : "");
    setModal("editar");
  }

  function onAddNombreChange(v) {
    setAddNombre(v);
    if (!idManualRef.current) {
      if (isGrupoTrabajo) {
        setAddId((prev) => (RX_GDT_ID_V2.test(prev) ? prev : generateGdtIdV2()));
        return;
      }
      if (!v.trim()) setAddId(itemActual.idPrefix.toUpperCase());
      else setAddId(sugerirIdCatalogo(itemActual.idPrefix, v));
    }
  }

  function onAddIdChange(v) {
    idManualRef.current = true;
    setAddId(isGrupoTrabajo ? v : v.toUpperCase());
  }

  async function guardarNuevo(e) {
    e.preventDefault();
    const id = isGrupoTrabajo ? addId.trim() : addId.trim().toUpperCase();
    const nombre = addNombre.trim();
    if (!id || !nombre) return toast.error("Completá id y nombre.");
    if (isGrupoTrabajo && !RX_GDT_ID_V2.test(id)) {
      return toast.error("ID inválido. Para grupos_de_trabajo usar gdt_<ULID>.");
    }
    if (isLocalidad && !addProvinciaId.trim()) {
      return toast.error("Elegí la provincia de la localidad.");
    }
    try {
      const datos = { id, nombre, activo: true, vigente_desde: null, vigente_hasta: null };
      if (isLocalidad) datos.provincia_id = addProvinciaId.trim().toUpperCase();
      await guardarOpcion(itemActual.collectionName, datos);
      toast.success("Opción creada.");
      setModal("cerrado");
      await recargar();
    } catch (err) {
      toast.error(callableErrorMessage(err));
    }
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    const nombre = editNombre.trim();
    if (!nombre) return toast.error("El nombre es obligatorio.");
    if (isLocalidad && !editProvinciaId.trim()) {
      return toast.error("Elegí la provincia de la localidad.");
    }
    try {
      const datos = {
        id: editDocId,
        nombre,
        activo: editActivo,
        vigente_desde: dateInputToIsoEnd(editVigDesde),
        vigente_hasta: dateInputToIsoEnd(editVigHasta),
      };
      if (isLocalidad) datos.provincia_id = editProvinciaId.trim().toUpperCase();
      await guardarOpcion(itemActual.collectionName, datos);
      toast.success("Cambios guardados.");
      setModal("cerrado");
      await recargar();
    } catch (err) {
      toast.error(callableErrorMessage(err));
    }
  }

  return {
    user,
    isRrhh,
    openAccessTemp,
    tokenReady,
    canReadCatalogos,
    canWriteCatalogos,
    selectedKey,
    setSelectedKey,
    itemActual,
    rows,
    loading,
    loadError,
    modal,
    setModal,
    addNombre,
    addId,
    editNombre,
    editActivo,
    editVigDesde,
    editVigHasta,
    editDocId,
    provincias,
    addProvinciaId,
    editProvinciaId,
    setEditNombre,
    setEditActivo,
    setEditVigDesde,
    setEditVigHasta,
    setAddProvinciaId,
    setEditProvinciaId,
    isLocalidad,
    tituloPanel,
    accesoBloqueado,
    abrirAgregar,
    abrirEditar,
    onAddNombreChange,
    onAddIdChange,
    guardarNuevo,
    guardarEdicion,
  };
}

