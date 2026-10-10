export type AdminSearchParams = Record<string, string | string[] | undefined>;
export const ADMIN_PAGE_SIZE = 25;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function parseAdminQuery(params: AdminSearchParams) {
  const rawPage = first(params.page);
  const page = /^\d+$/.test(rawPage) ? Math.min(10_000, Math.max(1, Number(rawPage))) : 1;
  return {
    page,
    query: first(params.q).trim().slice(0, 100),
    // Dropdown values must match the full, untrimmed synced muscle label.
    muscle: first(params.muscle).slice(0, 100),
    pageSize: ADMIN_PAGE_SIZE,
  };
}
