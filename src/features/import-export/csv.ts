export type CsvTable = { headers: string[]; rows: Record<string, string>[]; rowNumbers: number[] };

export function parseCsv(input: string, options: { maxRows?: number; maxColumns?: number } = {}): CsvTable {
  const maxRows = options.maxRows ?? 25_000;
  const maxColumns = options.maxColumns ?? 64;
  const source = input.replace(/^\uFEFF/, "");
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (char === '"') { quoted = false; i += 1; continue; }
      field += char; i += 1; continue;
    }
    if (char === '"' && field.length === 0) { quoted = true; i += 1; continue; }
    if (char === ",") { row.push(field); field = ""; i += 1; continue; }
    if (char === "\n" || char === "\r") {
      row.push(field); field = "";
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      if (row.some((value) => value.trim() !== "")) matrix.push(row);
      if (matrix.length > maxRows + 1) throw new Error(`CSV exceeds the ${maxRows.toLocaleString()} row safety limit.`);
      row = []; i += 1; continue;
    }
    field += char; i += 1;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field.length || row.length) { row.push(field); if (row.some((value) => value.trim() !== "")) matrix.push(row); }
  if (matrix.length < 2) throw new Error("CSV must contain a header row and at least one data row.");
  const headers = matrix[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  if (headers.length > maxColumns) throw new Error(`CSV exceeds the ${maxColumns} column safety limit.`);
  const normalized = new Set<string>();
  for (const header of headers) {
    const key = header.toLocaleLowerCase();
    if (normalized.has(key)) throw new Error(`CSV contains a duplicate column: ${header}`);
    normalized.add(key);
  }
  const rows = matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  return { headers, rows, rowNumbers: rows.map((_, index) => index + 2) };
}

function protectFormula(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function escapeCsv(value: unknown) {
  const text = protectFormula(value === null || value === undefined ? "" : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [headers.map(escapeCsv).join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\r\n") + "\r\n";
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
