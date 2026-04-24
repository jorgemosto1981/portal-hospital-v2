/**
 * Acción principal: azul institucional, área táctil ≥ 48px, feedback al toque.
 */
export default function PrimaryButton({
  children,
  className = "",
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      className={
        "min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50 " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}
