export function normalizeNumericDraft(text: string, integer = false): string | null {
  const normalized = text.trim().replace(",", ".");
  return (integer ? /^\d*$/ : /^\d*(?:\.\d*)?$/).test(normalized) ? normalized : null;
}

export function reconcileNumericDraft(draft: string | null, canonical: string, focused: boolean): string | null {
  if (focused && draft !== null &&
      (draft === canonical || draft !== "" && canonical !== "" && Number(draft) === Number(canonical))) return draft;
  return null;
}

export function numericInputError(text: string, options: { integer?: boolean; min?: string | number; max?: string | number } = {}): string | null {
  if (text === "") return null; // Native required validation handles empty fields.
  const normalized = normalizeNumericDraft(text, options.integer);
  const value = normalized === null || normalized === "." ? NaN : Number(normalized);
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (options.integer && !Number.isInteger(value)) return "Enter a whole number.";
  if (options.min !== undefined && value < Number(options.min)) return `Use ${options.min} or more.`;
  if (options.max !== undefined && value > Number(options.max)) return `Use ${options.max} or less.`;
  return null;
}
