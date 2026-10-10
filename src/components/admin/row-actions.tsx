"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, MoreHorizontal, X, type LucideIcon } from "lucide-react";

export type AdminRowAction = {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect?: () => void;
};

type RowActionsProps = {
  label: string;
  detailsTitle: string;
  details: ReactNode;
  actions: AdminRowAction[];
};

function DetailsDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    close.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="admin-portal admin-portal-overlay m-auto max-h-[calc(100dvh-48px)] w-[min(540px,calc(100vw-32px))] overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-700">Read-only details</p><h2 id={titleId} className="text-lg font-semibold leading-7 text-slate-900">{title}</h2></div>
        <button ref={close} type="button" onClick={onClose} aria-label="Close details" className="admin-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X aria-hidden="true" size={19} /></button>
      </header>
      <div className="px-6 py-5">{children}</div>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4"><p className="max-w-xs text-xs leading-5 text-slate-500">Changes require owner access and are recorded in the activity log.</p><button type="button" onClick={onClose} className="admin-button rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Close</button></footer>
    </dialog>,
    document.body,
  );
}

export function DetailField({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return <div className="grid gap-1.5 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`min-w-0 break-words text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{children}</dd></div>;
}

/** A keyboard-accessible menu for owner-only actions. */
export function RowActions({ label, detailsTitle, details, actions }: RowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!isOpen) return;
    function updatePosition() {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menu.current?.getBoundingClientRect().height ?? 195;
      const below = rect.bottom + 6;
      setPosition({ top: below + menuHeight <= window.innerHeight - 12 ? below : Math.max(12, rect.top - menuHeight - 6), right: Math.max(12, window.innerWidth - rect.right) });
    }
    function pointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) closeMenu();
    }
    updatePosition();
    menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", pointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  function menuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
    if (event.key === "Tab") { closeMenu(true); return; }
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let target: HTMLButtonElement | undefined;
    if (event.key === "ArrowDown") target = buttons[(index + 1) % buttons.length];
    if (event.key === "ArrowUp") target = buttons[(index + buttons.length - 1) % buttons.length];
    if (event.key === "Home") target = buttons[0];
    if (event.key === "End") target = buttons[buttons.length - 1];
    if (target) { event.preventDefault(); target.focus(); }
  }

  return <>
    <button
      ref={trigger}
      type="button"
      aria-label={`Actions for ${label}`}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      onClick={() => setIsOpen(open => !open)}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIsOpen(true); } }}
      className="admin-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
    ><MoreHorizontal aria-hidden="true" size={19} /></button>
    {isOpen && createPortal(
      <div ref={menu} id={menuId} role="menu" aria-label={`Actions for ${label}`} onKeyDown={menuKeyDown} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) closeMenu(); }} style={position} className="admin-portal admin-portal-overlay fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl shadow-slate-900/10">
        <button type="button" role="menuitem" onClick={() => { closeMenu(true); setShowDetails(true); }} className="admin-button flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors hover:bg-slate-50 focus:bg-slate-50"><Eye aria-hidden="true" size={16} className="text-slate-400" />View details</button>
        {actions.map(({ label: actionLabel, icon: Icon, destructive, disabled, disabledReason, onSelect }) => <button key={actionLabel} type="button" role="menuitem" disabled={disabled || !onSelect} title={disabledReason} onClick={() => { if (disabled || !onSelect) return; closeMenu(true); onSelect(); }} className={`admin-button flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${disabled || !onSelect ? "cursor-not-allowed opacity-45" : "hover:bg-slate-50"} ${destructive ? "text-rose-700" : "text-slate-700"}`}><Icon aria-hidden="true" size={16} />{actionLabel}</button>)}
      </div>, document.body,
    )}
    {showDetails && <DetailsDialog title={detailsTitle} onClose={() => setShowDetails(false)}>{details}</DetailsDialog>}
  </>;
}
