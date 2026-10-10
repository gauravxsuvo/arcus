"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { normalizeNumericDraft, numericInputError, reconcileNumericDraft } from "@/features/training/numeric-input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Text editing avoids mobile number spinners and preserves fractional input. */
export function NumericInput({ value, defaultValue, onChange, onBlur, inputMode, min, max, step, pattern, ...props }: Props) {
  const integer = inputMode === "numeric" || (inputMode !== "decimal" && (step === undefined || String(step) === "1"));
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => defaultValue == null ? "" : String(defaultValue));
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const canonical = controlled ? value === null ? "" : String(value) : uncontrolledValue;
  const display = draft ?? canonical;
  const error = numericInputError(display, { integer, min, max });

  useEffect(() => {
    // A parent stores 72 while the user is still typing "72.". Keep the edit;
    // external +/- changes still replace a numerically different value.
    setDraft(current => reconcileNumericDraft(current, canonical, ref.current === document.activeElement));
  }, [value, canonical]);
  useEffect(() => { ref.current?.setCustomValidity(error ?? ""); }, [error]);

  return <input {...props} ref={ref} type="text" inputMode="decimal"
    pattern={pattern ?? (integer ? "[0-9]*" : "[0-9]*[.,]?[0-9]*")}
    data-numeric={integer ? "integer" : "decimal"} value={display}
    aria-invalid={props["aria-invalid"] ?? (error ? true : undefined)}
    onChange={event => {
      const next = normalizeNumericDraft(event.target.value, integer);
      if (next === null) return;
      setDraft(next);
      if (!controlled) setUncontrolledValue(next);
      // A decimal point is an intermediate edit, never a NaN in saved data.
      if (next === "." || next !== "" && !Number.isFinite(Number(next))) return;
      event.target.value = next;
      event.currentTarget.setCustomValidity(numericInputError(next, { integer, min, max }) ?? "");
      onChange?.(event);
    }}
    onBlur={event => { setDraft(null); event.currentTarget.setCustomValidity(numericInputError(canonical, { integer, min, max }) ?? ""); onBlur?.(event); }}/>;
}
