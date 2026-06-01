const BADGE_ESTADO = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-amber-100 text-amber-800",
  HABILITADO: "bg-green-100 text-green-800",
  CERRADO: "bg-red-100 text-red-700",
};

const LABEL_ESTADO = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  EN_REVISION: "En revisión",
  HABILITADO: "Habilitado",
  CERRADO: "Cerrado",
};

export { BADGE_ESTADO, LABEL_ESTADO };

export default function BadgeEstadoPlan({ estado }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_ESTADO[estado] || "bg-slate-100 text-slate-600"}`}>
      {LABEL_ESTADO[estado] || estado}
    </span>
  );
}
