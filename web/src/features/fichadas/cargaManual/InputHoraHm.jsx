import { forwardRef, useCallback } from "react";

import { normalizarHoraHmInput } from "./fichadasCargaManualUtils.js";

/**
 * @param {{
 *   value: string;
 *   onChange: (v: string) => void;
 *   onEnter?: () => void;
 *   placeholder?: string;
 *   disabled?: boolean;
 *   id?: string;
 * }} props
 */
const InputHoraHm = forwardRef(function InputHoraHm(
  { value, onChange, onEnter, placeholder = "HH:MM", disabled, id },
  ref,
) {
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === "NumpadEnter") {
        e.preventDefault();
        onEnter?.();
      }
    },
    [onEnter],
  );

  const onBlur = useCallback(() => {
    const n = normalizarHoraHmInput(value);
    if (n !== value) onChange(n);
  }, [value, onChange]);

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
});

export default InputHoraHm;
