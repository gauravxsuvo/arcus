"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function AdminActionDialog({ title, description, onClose, busy = false, children, footer }: {
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialog} aria-labelledby="admin-action-dialog-title" aria-describedby={description ? "admin-action-dialog-description" : undefined}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}
      className="admin-portal admin-portal-overlay m-auto max-h-[calc(100dvh-32px)] w-[min(520px,calc(100vw-32px))] overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-700">Owner controls</p><h2 id="admin-action-dialog-title" className="text-lg font-semibold leading-7 text-slate-900">{title}</h2>{description && <p id="admin-action-dialog-description" className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}</div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" className="admin-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X aria-hidden="true" size={19}/></button>
      </header>
      <div className="px-6 py-5">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</footer>
    </dialog>, document.body,
  );
}

export async function submitAdminAction(body: Record<string, string>) {
  const response = await fetch("/api/admin/actions", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
  if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
  return result.message ?? "Change saved.";
}
