import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { callListarColeccion, callRrhhAltaAgente } from "../../services/callables.js";
import { useAuthSession } from "../auth/useAuthSession.js";

/** Valor por defecto al abrir el form (agente estándar). */
const DEFAULT_ROL_ID = "CFG_USUARIO";

export default function AltaAgenteRRHH() {
  const { user } = useAuthSession();
  const [grupos, setGrupos] = useState(/** @type {{ id: string, nombre?: string }[]} */ ([]));
  const [roles, setRoles] = useState(/** @type {{ id: string, nombre?: string, titulo_ui?: string }[]} */ ([]));
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [rolId, setRolId] = useState(DEFAULT_ROL_ID);
  const [nivel, setNivel] = useState(10);
  const [load, setLoad] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    let a = true;
    setLoad(true);
    Promise.all([
      callListarColeccion({ collectionName: "grupos_de_trabajo" }),
      callListarColeccion({ collectionName: "cfg_rol" }),
    ])
      .then(([rG, rR]) => {
        if (!a) return;
        const itemsG = (rG && rG.data && rG.data.items) || [];
        setGrupos(itemsG.filter((it) => it.activo !== false));
        setGrupoId((prev) => (prev && prev.length ? prev : (itemsG[0] && itemsG[0].id) || ""));

        const itemsR = (rR && rR.data && rR.data.items) || [];
        const rOk = itemsR.filter((it) => it.activo !== false);
        setRoles(rOk);
        setRolId((prev) => {
          if (rOk.some((x) => x.id === prev)) {
            return prev;
          }
          if (rOk.some((x) => x.id === DEFAULT_ROL_ID)) {
            return DEFAULT_ROL_ID;
          }
          return (rOk[0] && rOk[0].id) || "";
        });
      })
      .catch((e) => {
        if (!a) return;
        const code = (e && /** @type {{ code?: string }} */ (e).code) || "";
        if (String(code).includes("permission") || String(code).includes("PERMISSION")) {
          toast.error("Sin permiso de RRHH (revisá el claim `portal_role: rrhh`).", { duration: 6_000 });
        } else {
          toast.error("No se pudo cargar el formulario (grupos / roles).");
        }
      })
      .finally(() => {
        if (a) setLoad(false);
      });
    return () => {
      a = false;
    };
  }, [user]);

  function etiquetaRol(r) {
    if (!r) return "";
    if (typeof r.titulo_ui === "string" && r.titulo_ui) return r.titulo_ui;
    if (typeof r.nombre === "string" && r.nombre) return r.nombre;
    return r.id || "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(dni.replace(/\D/g, ""))) {
      toast.error("DNI: 6 a 12 dígitos.");
      return;
    }
    if (!grupoId) {
      toast.error("Seleccioná un grupo de trabajo.");
      return;
    }
    if (!rolId) {
      toast.error("Seleccioná el rol de aplicación (cfg_rol).");
      return;
    }
    setBusy(true);
    const t = toast.loading("Dando de alta cáscara de agente…");
    try {
      const { data } = await callRrhhAltaAgente({
        dni: dni.replace(/\D/g, ""),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        grupo_de_trabajo_id: grupoId,
        nivel_jerarquico: Math.min(99, Math.max(1, Math.floor(nivel) || 1)),
        role_ids: [rolId],
      });
      if (data?.ok) {
        toast.success(`Creado ${data.persona_id} — ` + `Cuenta ${data.cuenta_id}`, { id: t, duration: 5_000 });
        setDni("");
        setNombre("");
        setApellido("");
        setRolId(roles.some((x) => x.id === DEFAULT_ROL_ID) ? DEFAULT_ROL_ID : rolId);
      } else {
        throw new Error();
      }
    } catch (err) {
      const msg = (err && /** @type {{ message?: string }} */ (err).message) || "Revisá DNI, roles o permisos";
      toast.error(String(msg), { id: t });
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <p className="p-6 text-sm text-slate-500">Iniciá sesión (cuenta con rol RRHH) para pre-alta.</p>;
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-3 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold">Pre-alta (RRHH)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cáscara en PENDIENTE_ONBOARDING. El <strong>rol de aplicación</strong> se guarda en
          <code className="mx-1 text-xs">usuarios_cuenta.role_ids</code> (catálogo <code className="text-xs">cfg_rol</code>).
        </p>
        <div className="mb-4 mt-4">
          <Link to="/" className="text-sm text-blue-600">
            Volver a la app
          </Link>
        </div>

        {load ? (
          <p className="text-sm text-slate-500">Cargando catálogos (grupos, roles)…</p>
        ) : (
          <Card className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">DNI (solo números)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                  maxLength={12}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Apellido</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Rol de aplicación</label>
                <p className="mb-1 text-xs text-slate-500">
                  Definido en <code>cfg_rol</code> (V2). Un rol por cáscara en este formulario; la cuenta puede
                  ampliarse luego vía administración.
                </p>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                  required
                >
                  <option value="">{roles.length ? "Elegir…" : "Sembrá cfg_rol (npm run seed:cfg)"}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {etiquetaRol(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Grupo de trabajo</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                >
                  <option value="">{grupos.length ? "Elegir…" : "Sin nodos (seed primero)"}</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre || g.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Nivel jerárquico (1–99 en la burbuja)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={nivel}
                  onChange={(e) => setNivel(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <PrimaryButton type="submit" disabled={busy} className="!mt-4 w-full">
                {busy ? "Enviando…" : "Crear cáscara (personas + cuenta pend.)"}
              </PrimaryButton>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
