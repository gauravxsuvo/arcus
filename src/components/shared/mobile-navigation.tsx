"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, Dumbbell, History, House, Library, User } from "lucide-react";
import { AccountAccess } from "@/components/shared/account-access";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-provider";
import styles from "./navigation.module.css";

const destinations = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];
const secondary = [
  { href: "/programs", label: "Programs", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/recaps", label: "Weekly recaps", icon: CalendarDays },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (![...destinations, ...secondary].some(({ href }) => isActive(href))) return null;

  const profileSection = ["/profile", "/programs", "/progress", "/exercises", "/recaps"].some(isActive);

  return <><nav className={`desktop-navigation ${styles.desktop}`} aria-label="Main navigation">
    <Link className="brand" href="/dashboard"><ArcusMark />ARCUS.</Link>
    {[...destinations, ...secondary].map(({ href, label, icon: Icon }) => <Link className="desktop-nav-link" key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>{href==="/profile"?<Avatar size={24}/>:<Icon size={20} aria-hidden="true" />}{label}</Link>)}
    <div className="desktop-account-section"><ThemeToggle/><AccountAccess /><p className="desktop-nav-note">YOUR TRAINING SPACE</p></div>
  </nav><nav className={`mobile-navigation ${styles.mobile}`} aria-label="Mobile navigation">
    {destinations.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={isActive(href) || (href === "/profile" && profileSection) ? "page" : undefined}>
      {href==="/profile"?<Avatar size={24}/>:<Icon size={21} aria-hidden="true" />}<span>{label}</span>
    </Link>)}
  </nav></>;
}
