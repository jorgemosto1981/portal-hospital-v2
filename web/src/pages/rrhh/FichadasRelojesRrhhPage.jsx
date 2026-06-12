import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import RelojBiometricoForm from "../../features/fichadas/relojes/RelojBiometricoForm.jsx";
import {
  estadoFormDesdeReloj,
  payloadGuardarDesdeForm,
} from "../../features/fichadas/relojes/relojBiometricoFormUtils.js";
import { callGuardarCfgRelojBiometrico } from "../../services/callables.js";
import { listarColeccion } from "../../services/configuracionCatalogosService.js";
import { laboralCallableErrorMessage } from "../datos-laborales/callableErrorMessage.js";

export default function FichadasRelojesRrhhPage() {
  const [relojes, setRelojes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => estadoFormDesdeReloj(null));
  const [modo, setModo] = useState("lista");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rels, gdts] = await Promise.all([
        listarColeccion("cfg_reloj_biometrico"),
        listarColeccion("grupos_de_trabajo"),
      ]);
      setRelojes(Array.isArray(rels) ? rels : []);
      setGrupos(
        (Array.isArray(gdts) ? gdts : []).filter((g) => g && g.activo !== false),
      );
    } catch (e) {
      toast.error(e?.message || "No se pudo cargar relojes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const relojesOrdenados = useMemo(
    () =>
      [...relojes].sort((a, b) =>
        String(a.nombre || a.id).localeCompare(String(b.nombre || b.id), "es"),
      ),
    [relojes],
  );

  const abrirNuevo = () => {
    setForm(estadoFormDesdeReloj(null));
    setModo("form");
  };

  const abrirEditar = (reloj) => {
    setForm(estadoFormDesdeReloj(reloj));
    setModo("form");
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await callGuardarCfgRelojBiometrico(payloadGuardarDesdeForm(form));
      const data = res?.data;
      toast.success(data?.creado ? "Reloj creado." : "Reloj actualizado.");
      setModo("lista");
      setForm(estadoFormDesdeReloj(null));
      await cargar();
    } catch (e) {
      toast.error(laboralCallableErrorMessage(e, "No se pudo guardar el reloj."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-24 md:px-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Relojes biométricos</h1>
        <p className="text-sm text-slate-500">
          Alta y configuración de equipos (sector, máscara TXT, política de duplicados).{" "}
          <Link to="/portal/rrhh/fichadas-import" className="text-blue-600 hover:underline">
            Ir a import TXT
          </Link>
        </p>
      </header>

      {modo === "lista" ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={abrirNuevo}
              className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Nuevo reloj
            </button>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Política</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : relojesOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-slate-500">
                      No hay relojes. Creá uno o ejecutá la semilla dev{" "}
                      <code className="text-xs">npm run seed:fichadas-reloj</code>.
                    </td>
                  </tr>
                ) : (
                  relojesOrdenados.map((r) => {
                    const pol = r.politica_validacion || {};
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {r.nombre || r.id}
                          <div className="font-mono text-[10px] text-slate-400">{r.id}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.grupo_trabajo_id || "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {pol.duplicados || "—"} · {pol.umbral_duplicado_minutos ?? 2} min
                        </td>
                        <td className="px-3 py-2">
                          {r.activo === false ? (
                            <span className="text-amber-800">Inactivo</span>
                          ) : (
                            <span className="text-emerald-800">Activo</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="text-sm font-semibold text-violet-800 underline"
                            onClick={() => abrirEditar(r)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            {form.reloj_id ? "Editar reloj" : "Nuevo reloj"}
          </h2>
          <RelojBiometricoForm
            form={form}
            grupos={grupos}
            guardando={guardando}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={guardar}
            onCancel={() => {
              setModo("lista");
              setForm(estadoFormDesdeReloj(null));
            }}
          />
        </Card>
      )}
    </div>
  );
}
