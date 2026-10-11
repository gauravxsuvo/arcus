"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
      <header className="border-b border-slate-200 px-6 py-5">
        <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-700">Owner controls</p><h2 id="admin-action-dialog-title" className="text-lg font-semibold leading-7 text-slate-900">{title}</h2>{description && <p id="admin-action-dialog-description" className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}</div>
      </header>
      <div className="px-6 py-5">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</footer>
    </dialog>, document.body,
  );
}

