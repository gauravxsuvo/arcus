"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, Dumbbell, History, House, Library, Sparkles, User } from "lucide-react";
import { AccountAccess } from "@/components/shared/account-access";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-provider";
import styles from "./navigation.module.css";

const destinations = [
  { href: "/home", label: "Home", icon: House },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];
const secondary = [
  { href: "/programs", label: "Programs", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/recaps", label: "Weekly recaps", icon: CalendarDays },
  { href: "/pro", label: "ARCUS Pro", icon: Sparkles },
];

function hasAppNavigation(pathname: string) {
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return [...destinations, ...secondary].some(({ href }) => isActive(href));
}

export function MobileAppHeader() {
  const pathname = usePathname();
  if (!hasAppNavigation(pathname)) return null;
  return <header className={styles.mobileHeader} data-theme-surface>
    <Link className={styles.mobileBrand} href="/home" aria-label="ARCUS home"><ArcusMark size={25}/><span>ARCUS.</span></Link>
    <ThemeToggle/>
  </header>;
}

export function MobileNavigation() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (!hasAppNavigation(pathname)) return null;

  const profileSection = ["/profile", "/programs", "/progress", "/exercises", "/recaps", "/pro"].some(isActive);

  return <><nav className={`desktop-navigation ${styles.desktop}`} aria-label="Main navigation">
    <Link className="brand" href="/home"><ArcusMark />ARCUS.</Link>
    {[...destinations, ...secondary].map(({ href, label, icon: Icon }) => <Link className="desktop-nav-link" key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>{href==="/profile"?<Avatar size={24}/>:<Icon size={20} aria-hidden="true" />}{label}</Link>)}
    <div className="desktop-account-section"><AccountAccess /><div className={styles.desktopThemeRow}><span>Theme</span><ThemeToggle/></div><p className="desktop-nav-note">YOUR TRAINING SPACE</p><nav className={styles.legalLinks} aria-label="Legal information"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div>
  </nav><nav className={`mobile-navigation ${styles.mobile}`} aria-label="Mobile navigation">
    {destinations.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(href) || (href === "/profile" && profileSection) ? "page" : undefined}>
      {href==="/profile"?<Avatar size={24}/>:<Icon size={21} aria-hidden="true" />}<span>{label}</span>
    </Link>)}
  </nav></>;
}
