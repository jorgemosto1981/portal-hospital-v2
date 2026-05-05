import { useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storageV2 } from "../../../services/firebase.js";

export default function PersonaFields({
  form,
  setField,
  lockSensitiveFields = false,
  readOnly = false,
  canEditField = () => true,
  HELP,
  optsLoc,
  optsMotivoBaja,
  optsSexo,
  optsCivil,
  optsNac,
  optsProv,
  optsPais,
}) {
  const [showFotoPreview, setShowFotoPreview] = useState(false);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState("");
  const [fotoPreviewLoading, setFotoPreviewLoading] = useState(false);
  const baseCls =
    "mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500";
  const isDisabled = (field, allowInReadOnly = false) => {
    if (!allowInReadOnly && readOnly) return true;
    return !canEditField(field);
  };
  function labelWithId(label, id, required = false) {
    return (
      <span>
        {label}{required ? " *" : ""} <span className="text-xs italic text-slate-500">({id})</span>
      </span>
    );
  }

  async function toggleFotoPreview() {
    if (showFotoPreview) {
      setShowFotoPreview(false);
      return;
    }
    if (fotoPreviewUrl) {
      setShowFotoPreview(true);
      return;
    }
    const candidatePath = String(form.foto_storage_path_thumb || form.foto_storage_path || "").trim();
    if (!candidatePath) return;
    setFotoPreviewLoading(true);
    try {
      const url = await getDownloadURL(ref(storageV2, candidatePath));
      setFotoPreviewUrl(url);
      setShowFotoPreview(true);
    } finally {
      setFotoPreviewLoading(false);
    }
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("DNI", "dni", true)}</label>
        <input
          value={form.dni}
          onChange={(e) => setField("dni", e.target.value)}
          disabled={readOnly || lockSensitiveFields}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.dni}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Nombre", "nombre", true)}</label>
        <input
          value={form.nombre}
          onChange={(e) => setField("nombre", e.target.value)}
          disabled={readOnly || lockSensitiveFields}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.nombre}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Apellido", "apellido", true)}</label>
        <input
          value={form.apellido}
          onChange={(e) => setField("apellido", e.target.value)}
          disabled={readOnly || lockSensitiveFields}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.apellido}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Nombre completo legal", "nombre_completo_legal")}</label>
        <input value={form.nombre_completo_legal} disabled className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
        <p className="mt-1 text-xs text-slate-500">{HELP.nombre_completo_legal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("CUIL", "cuil")}</label>
        <input value={form.cuil} onChange={(e) => setField("cuil", e.target.value)} disabled={isDisabled("cuil")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.cuil}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Fecha de nacimiento", "fecha_nacimiento")}</label>
        <input type="date" value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} disabled={isDisabled("fecha_nacimiento")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.fecha_nacimiento}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Lugar de nacimiento", "lugar_nacimiento_id")}</label>
        <select value={form.lugar_nacimiento_id} onChange={(e) => setField("lugar_nacimiento_id", e.target.value)} disabled={isDisabled("lugar_nacimiento_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsLoc.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.lugar_nacimiento_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Lugar de nacimiento (texto)", "lugar_nacimiento_texto")}</label>
        <input value={form.lugar_nacimiento_texto} onChange={(e) => setField("lugar_nacimiento_texto", e.target.value)} disabled={isDisabled("lugar_nacimiento_texto")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.lugar_nacimiento_texto}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Activo", "activo")}</label>
        <select
          value={form.activo ? "true" : "false"}
          onChange={(e) => setField("activo", e.target.value === "true")}
          disabled={readOnly || lockSensitiveFields}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.activo}</p>
      </div>
      {!form.activo && (
        <div>
          <label className="block text-sm font-medium text-slate-700">{labelWithId("Motivo de baja", "motivo_baja_id", true)}</label>
          <select
            value={form.motivo_baja_id}
            onChange={(e) => setField("motivo_baja_id", e.target.value)}
            disabled={readOnly || lockSensitiveFields}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Seleccionar...</option>
            {optsMotivoBaja.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{HELP.motivo_baja_id}</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Sexo/Género", "sexo_genero_id")}</label>
        <select value={form.sexo_genero_id} onChange={(e) => setField("sexo_genero_id", e.target.value)} disabled={isDisabled("sexo_genero_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsSexo.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.sexo_genero_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Estado civil", "estado_civil_id")}</label>
        <select value={form.estado_civil_id} onChange={(e) => setField("estado_civil_id", e.target.value)} disabled={isDisabled("estado_civil_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsCivil.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.estado_civil_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Nacionalidad", "nacionalidad_id")}</label>
        <select value={form.nacionalidad_id} onChange={(e) => setField("nacionalidad_id", e.target.value)} disabled={isDisabled("nacionalidad_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsNac.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.nacionalidad_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Teléfono celular", "telefono_celular")}</label>
        <input value={form.telefono_celular} onChange={(e) => setField("telefono_celular", e.target.value)} disabled={isDisabled("telefono_celular")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.telefono_celular}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Teléfono fijo", "telefono_fijo")}</label>
        <input value={form.telefono_fijo} onChange={(e) => setField("telefono_fijo", e.target.value)} disabled={isDisabled("telefono_fijo")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.telefono_fijo}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.recibe_notificaciones_sms}
          onChange={(e) => setField("recibe_notificaciones_sms", e.target.checked)}
          disabled={isDisabled("recibe_notificaciones_sms")}
        />
        Recibe notificaciones por WhatsApp
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Email personal", "email_personal")}</label>
        <input value={form.email_personal} onChange={(e) => setField("email_personal", e.target.value)} disabled={isDisabled("email_personal")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.email_personal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Calle", "calle")}</label>
        <input value={form.calle} onChange={(e) => setField("calle", e.target.value)} disabled={isDisabled("calle")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.calle}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Número", "numero")}</label>
        <input value={form.numero} onChange={(e) => setField("numero", e.target.value)} disabled={isDisabled("numero")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.numero}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Piso", "piso")}</label>
        <input value={form.piso} onChange={(e) => setField("piso", e.target.value)} disabled={isDisabled("piso")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.piso}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Departamento", "departamento")}</label>
        <input value={form.departamento} onChange={(e) => setField("departamento", e.target.value)} disabled={isDisabled("departamento")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.departamento}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Provincia", "provincia_id")}</label>
        <select value={form.provincia_id} onChange={(e) => setField("provincia_id", e.target.value)} disabled={isDisabled("provincia_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsProv.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.provincia_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("País", "pais_id")}</label>
        <select value={form.pais_id} onChange={(e) => setField("pais_id", e.target.value)} disabled={isDisabled("pais_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsPais.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.pais_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Localidad", "localidad_id")}</label>
        <select value={form.localidad_id} onChange={(e) => setField("localidad_id", e.target.value)} disabled={isDisabled("localidad_id")} className={baseCls}>
          <option value="">Seleccionar...</option>
          {optsLoc.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.localidad_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Código postal", "codigo_postal")}</label>
        <input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} disabled={isDisabled("codigo_postal")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.codigo_postal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Referencia", "referencia")}</label>
        <input value={form.referencia} onChange={(e) => setField("referencia", e.target.value)} disabled={isDisabled("referencia")} className={baseCls} />
        <p className="mt-1 text-xs text-slate-500">{HELP.referencia}</p>
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Foto de rostro", "foto_rostro")}</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            setField("foto_file", file);
            setField("foto_file_name", file ? file.name : "");
          }}
          disabled={isDisabled("foto_archivo")}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.foto_archivo}</p>
        {form.foto_file_name ? (
          <p className="mt-1 text-xs text-slate-600">Archivo seleccionado: {form.foto_file_name}</p>
        ) : null}
        {(form.foto_storage_path_thumb || form.foto_storage_path || form.foto_download_url) ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={toggleFotoPreview}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {showFotoPreview ? "Ocultar foto actual" : fotoPreviewLoading ? "Cargando foto..." : "Ver foto actual"}
            </button>
            {showFotoPreview ? (
              <img
                src={fotoPreviewUrl || form.foto_download_url}
                alt="Foto de rostro actual"
                loading="lazy"
                className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover"
              />
            ) : null}
            <p className="mt-1 text-[11px] text-slate-500">
              La imagen se carga solo al presionar “Ver foto actual” para evitar consumo innecesario.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
