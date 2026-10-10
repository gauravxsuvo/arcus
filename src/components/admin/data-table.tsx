"use client";

import { useEffect, useId, useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search, SearchX, X } from "lucide-react";
import type { AdminTablePage } from "@/features/admin/model";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableFilter = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

type DataTableProps<T> = {
  data: AdminTablePage<T>;
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  basePath: string;
  caption: string;
  itemLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  filters?: DataTableFilter[];
  tableClassName?: string;
};

function pageItems(page: number, pageCount: number): (number | "start-gap" | "end-gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const first = Math.max(2, Math.min(page - 1, pageCount - 3));
  const last = Math.min(pageCount - 1, Math.max(page + 1, 4));
  return [
    1,
    ...(first > 2 ? ["start-gap" as const] : []),
    ...Array.from({ length: last - first + 1 }, (_, index) => first + index),
    ...(last < pageCount - 1 ? ["end-gap" as const] : []),
    pageCount,
  ];
}

/** Renders a server-provided page; search, filters and pagination fetch through the route URL. */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  basePath,
  caption,
  itemLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  filters = [],
  tableClassName = "min-w-[720px]",
}: DataTableProps<T>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchId = useId();
  const form = useRef<HTMLFormElement>(null);
  const clearResults = useRef<HTMLButtonElement>(null);
  const focusAfterNavigation = useRef<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const firstRow = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastRow = Math.min(data.page * data.pageSize, data.total);
  const hasFilters = Boolean(data.query || filters.some(filter => filter.value));
  const formKey = [data.query, ...filters.map(filter => `${filter.name}:${filter.value}`)].join("|");

  useEffect(() => {
    if (isPending || !focusAfterNavigation.current) return;
    const id = focusAfterNavigation.current;
    focusAfterNavigation.current = null;
    // Restore a remounted control unless the user moved focus while loading.
    if (document.activeElement !== document.body) return;
    (document.getElementById(id) ?? document.getElementById(searchId))?.focus({ preventScroll: true });
  }, [isPending, searchId]);

  function navigate(page: number, query = data.query, values = filters.map(filter => [filter.name, filter.value])) {
    const active = document.activeElement;
    focusAfterNavigation.current = active instanceof HTMLElement && (form.current?.contains(active) || active === clearResults.current) ? active.id : null;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    for (const [name, value] of values) if (value) params.set(name, value);
    if (page > 1) params.set("page", String(page));
    const queryString = params.toString();
    startTransition(() => router.push(`${basePath}${queryString ? `?${queryString}` : ""}`, { scroll: false }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    navigate(1, String(values.get("q") ?? ""), filters.map(filter => [filter.name, String(values.get(filter.name) ?? "")]));
  }

  return (
    <section className="admin-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label={caption} aria-busy={isPending}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <form ref={form} key={formKey} onSubmit={submitSearch} className="flex min-w-0 flex-1 flex-wrap items-center gap-3" aria-label={`Search ${itemLabel}`}>
          <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
            <label htmlFor={searchId} className="sr-only">Search {itemLabel}</label>
            <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id={searchId}
              name="q"
              type="search"
              defaultValue={data.query}
              placeholder={searchPlaceholder}
              maxLength={200}
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15 disabled:opacity-60"
            />
          </div>
          {filters.map(filter => (
            <div key={filter.name} className="relative">
              <label htmlFor={`${searchId}-${filter.name}`} className="sr-only">{filter.label}</label>
              <select
                id={`${searchId}-${filter.name}`}
                name={filter.name}
                defaultValue={filter.value}
                disabled={isPending}
                className="h-10 max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15 disabled:opacity-60"
              >
                {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          ))}
          <button id={`${searchId}-submit`} type="submit" disabled={isPending} className="admin-button inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
            {isPending && <LoaderCircle aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" />}
            Search
          </button>
          {hasFilters && (
            <button id={`${searchId}-clear`} type="button" onClick={() => navigate(1, "", filters.map(filter => [filter.name, ""]))} disabled={isPending} className="admin-button inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">
              <X aria-hidden="true" size={15} /> Clear
            </button>
          )}
        </form>
        <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={isPending} aria-label={`Refresh ${itemLabel}`} title={`Refresh ${itemLabel}`} className="admin-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-700 disabled:cursor-wait disabled:opacity-50">
          <RefreshCw aria-hidden="true" size={16} className={isPending ? "animate-spin motion-reduce:animate-none" : undefined} />
        </button>
      </div>

      <div className="relative min-h-[180px]">
        <div className="overflow-x-auto" inert={isPending}>
          <table className={`w-full border-collapse text-left text-sm ${tableClassName}`}>
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-slate-50/80">
              <tr>
                {columns.map(column => (
                  <th key={column.id} scope="col" className={`border-b border-slate-200 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 ${column.headerClassName ?? column.className ?? ""}`}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={getRowId(row)} className="group transition-colors hover:bg-slate-50/70">
                  {columns.map(column => <td key={column.id} className={`border-b border-slate-100 px-5 py-4 text-slate-700 ${column.className ?? ""}`}>{column.cell(row)}</td>)}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-16 text-center">
                    <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><SearchX aria-hidden="true" size={23} /></span>
                    <p className="mb-1 text-sm font-semibold text-slate-800">{emptyTitle}</p>
                    <p className="mx-auto max-w-sm text-sm leading-6 text-slate-500">{emptyDescription}</p>
                    {hasFilters && <button ref={clearResults} id={`${searchId}-clear-results`} type="button" onClick={() => navigate(1, "", filters.map(filter => [filter.name, ""]))} disabled={isPending} className="admin-button mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50">Clear search and filters</button>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-[1px]" role="status" aria-live="polite">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-teal-700 shadow-sm"><LoaderCircle aria-hidden="true" size={18} className="animate-spin motion-reduce:animate-none" /> Loading {itemLabel}…</span>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <p className="text-xs text-slate-500">Showing <span className="font-medium text-slate-700">{firstRow.toLocaleString("en-US")}–{lastRow.toLocaleString("en-US")}</span> of <span className="font-medium text-slate-700">{data.total.toLocaleString("en-US")}</span> {itemLabel}</p>
        <nav aria-label={`${caption} pagination`} className="flex items-center gap-1.5">
          <span className="mr-2 text-xs text-slate-500 sm:hidden">Page {data.page} / {pageCount}</span>
          <button type="button" onClick={() => navigate(data.page - 1)} disabled={isPending || data.page <= 1} aria-label="Previous page" className="admin-button inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft aria-hidden="true" size={16} /></button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {pageItems(data.page, pageCount).map(item => typeof item === "number" ? (
              <button key={item} type="button" onClick={() => navigate(item)} disabled={isPending || item === data.page} aria-label={`Page ${item}`} aria-current={item === data.page ? "page" : undefined} className={`admin-button inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors ${item === data.page ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"}`}>{item}</button>
            ) : <span key={item} className="px-1 text-xs text-slate-400" aria-hidden="true">…</span>)}
          </div>
          <button type="button" onClick={() => navigate(data.page + 1)} disabled={isPending || data.page >= pageCount} aria-label="Next page" className="admin-button inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight aria-hidden="true" size={16} /></button>
        </nav>
      </footer>
    </section>
  );
}
