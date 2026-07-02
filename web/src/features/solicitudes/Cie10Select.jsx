import { useMemo, useState } from "react";

import { TICKETERA } from "./ticketeraUi.js";

/**
 * @param {{
 *   opciones: Array<{ id: string, codigo_interno?: string, titulo_ui?: string }>,
 *   valueCodigo: string,
 *   onChange: (payload: { codigo: string, descripcion: string }) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function Cie10Select({
  opciones = [],
  valueCodigo = "",
  onChange,
  disabled = false,
}) {
  const lista = Array.isArray(opciones) ? opciones : [];
  const [filtro, setFiltro] = useState("");

  const filtradas = useMemo(() => {
    const q = String(filtro || "").trim().toLowerCase();
    if (!q) return lista.slice(0, 80);
    return lista
      .filter((row) => {
        const cod = String(row?.codigo_interno || "").toLowerCase();
        const tit = String(row?.titulo_ui || "").toLowerCase();
        return cod.includes(q) || tit.includes(q);
      })
      .slice(0, 80);
  }, [filtro, lista]);

  const seleccionar = (row) => {
    const codigo = String(row?.codigo_interno || "").trim().toUpperCase();
    const descripcion = String(row?.titulo_ui || "").trim();
    if (!codigo) return;
    onChange({ codigo, descripcion });
  };

  return (
    <div className="space-y-2">
      <label className="block space-y-1" htmlFor="cie10-filtro">
        <span className={TICKETERA.label}>Diagnóstico CIE-10</span>
        <input
          id="cie10-filtro"
          type="search"
          className={TICKETERA.input}
          placeholder="Buscar por código o descripción…"
          value={filtro}
          disabled={disabled}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </label>
      <label className="block space-y-1" htmlFor="cie10-codigo">
        <span className="text-xs font-medium text-slate-600">Código seleccionado</span>
        <select
          id="cie10-codigo"
          className={TICKETERA.select}
          value={valueCodigo}
          disabled={disabled || filtradas.length === 0}
          required
          aria-required="true"
          onChange={(e) => {
            const cod = String(e.target.value || "").trim();
            const row = lista.find((r) => String(r?.codigo_interno || "").trim() === cod);
            if (row) seleccionar(row);
          }}
        >
          <option value="">Elegí el código CIE-10</option>
          {filtradas.map((row) => {
            const cod = String(row?.codigo_interno || "").trim();
            if (!cod) return null;
            const tit = String(row?.titulo_ui || "").trim();
            return (
              <option key={String(row.id || cod)} value={cod}>
                {cod} — {tit}
              </option>
            );
          })}
        </select>
      </label>
      <span className="text-xs text-slate-500">
        Catálogo piloto OPS/OMS (ampliar con importación institucional).
      </span>
    </div>
  );
}
