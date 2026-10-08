import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";
import { SyncManager } from "@/components/shared/sync-manager";
import "./globals.css";
import { MobileNavigation } from "@/components/shared/mobile-navigation";
import { NetworkStatus } from "@/components/shared/network-status";
import { UserProfileProvider } from "@/components/shared/user-profile-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { WorkoutProvider } from "@/components/shared/workout-provider";
import { RecapManager } from "@/components/shared/recap-manager";

export const metadata: Metadata = {
  title: "ARCUS — Training, made measurable",
  description: "A focused training log built for better sessions and clearer progress.",
  applicationName: "ARCUS Training",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:'try{document.documentElement.dataset.theme=localStorage.getItem("arcus-theme")==="light"?"light":"dark";}catch{}'}}/></head>
      <body suppressHydrationWarning><UserProfileProvider><ThemeProvider><WorkoutProvider><ServiceWorkerRegistration /><SyncManager /><RecapManager/><NetworkStatus />{children}<MobileNavigation /></WorkoutProvider></ThemeProvider></UserProfileProvider></body>
    </html>
  );
}
