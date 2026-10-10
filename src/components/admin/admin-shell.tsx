"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Dumbbell,
  LayoutDashboard,
  LoaderCircle,
  ScrollText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { AdminCommandPalette } from "./admin-command-palette";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

const destinations = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/exercises", label: "Exercise Database", icon: Dumbbell },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

type AdminNavigation = {
  pendingHref: string | null;
  navigate: (href: string) => void;
};

const AdminNavigationContext = createContext<AdminNavigation | null>(null);

type AdminLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** Keeps normal link behavior, including opening modified clicks in another tab. */
export function AdminLink({ href, onNavigate, prefetch = false, ...props }: AdminLinkProps) {
  const navigation = useContext(AdminNavigationContext);

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
        if (cancelled || !navigation) return;
        event.preventDefault();
        navigation.navigate(href);
      }}
    />
  );
}

export function AdminShell({ children, adminName, adminRole = "OWNER" }: { children: ReactNode; adminName: string; adminRole?: "OWNER" | "MODERATOR" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [destination, setDestination] = useState<string | null>(null);
  const current = destinations.find(({ href }) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
  );
  const displayName = adminName.trim() || "Administrator";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  function navigate(href: string) {
    // Same-page links must not create a progress indicator that never resolves.
    if (href === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    setDestination(href);
    startTransition(() => router.push(href));
  }

  return (
    <AdminNavigationContext.Provider value={{ pendingHref: isPending ? destination : null, navigate }}>
      <div className="admin-portal admin-shell min-h-dvh">
        <a className="admin-skip-link" href="#admin-content">Skip to content</a>

        <aside className="admin-sidebar flex flex-col" aria-label="Administration sidebar">
          <AdminLink className="admin-brand flex items-center gap-3" href="/admin" aria-label="Arcus owner console overview">
            <ArcusMark size={32} />
            <span className="admin-brand-copy">
              <span className="admin-brand-wordmark">ARCUS<span>.</span></span>
              <span className="admin-brand-caption">Owner console</span>
            </span>
          </AdminLink>

          <div className="admin-nav-section">
            <span className="admin-sidebar-label">Workspace</span>
            <nav className="admin-sidebar-nav" aria-label="Admin navigation">
              {destinations.map(({ href, label, icon: Icon }) => {
                const active = current?.href === href;
                const pending = isPending && destination === href;
                return (
                  <AdminLink
                    key={href}
                    href={href}
                    className="admin-nav-link flex items-center gap-3"
                    aria-current={active ? "page" : undefined}
                    aria-label={pending ? `${label}, loading` : label}
                  >
                    {pending
                      ? <LoaderCircle className="admin-spinner shrink-0" size={19} aria-hidden="true" />
                      : <Icon className="shrink-0" size={19} strokeWidth={1.8} aria-hidden="true" />}
                    <span>{label}</span>
                    {active && <span className="admin-active-dot" aria-hidden="true" />}
                  </AdminLink>
                );
              })}
            </nav>
          </div>

          <div className="admin-sidebar-footer">
            <AdminLink className="admin-return-link flex items-center gap-3" href="/dashboard">
              {isPending && destination === "/dashboard"
                ? <LoaderCircle className="admin-spinner" size={17} aria-hidden="true" />
                : <ArrowLeft size={17} aria-hidden="true" />}
              <span>Return to app</span>
            </AdminLink>
            <div className="admin-sidebar-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Private owner workspace</span>
            </div>
          </div>
        </aside>

        <div className="admin-frame min-w-0">
          <header className="admin-topbar flex items-center justify-between gap-4">
            <div className="admin-breadcrumb flex min-w-0 items-center gap-3" role="group" aria-label="Current section">
              <span className="admin-breadcrumb-parent">Administration</span>
              <ChevronRight className="admin-breadcrumb-separator" size={14} aria-hidden="true" />
              <span className="admin-breadcrumb-current">{current?.label ?? "Owner console"}</span>
              {isPending && <LoaderCircle className="admin-spinner admin-header-spinner" size={17} aria-hidden="true" />}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <AdminCommandPalette />
            </div>
            <div className="admin-account flex items-center gap-3">
              <div className="admin-account-copy">
                <span className="admin-account-name">{displayName}</span>
                <span className="admin-account-role">{adminRole === "OWNER" ? "Owner" : "Moderator"}</span>
              </div>
              <span className="admin-account-avatar" aria-hidden="true">{initials}</span>
            </div>
            {isPending && <div className="admin-navigation-progress" aria-hidden="true"><span /></div>}
          </header>

          <main id="admin-content" className="admin-content min-w-0" tabIndex={-1} aria-busy={isPending}>
            {children}
          </main>
        </div>
        <span className="admin-visually-hidden" role="status" aria-live="polite">{isPending ? "Loading page" : ""}</span>
      </div>
    </AdminNavigationContext.Provider>
  );
}

export { AdminLoading } from "./admin-loading";
