import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";
import { SyncManager } from "@/components/shared/sync-manager";
import "./globals.css";
import "./mobile-polish.css";
import { MobileNavigation } from "@/components/shared/mobile-navigation";
import { NetworkStatus } from "@/components/shared/network-status";
import { UserProfileProvider } from "@/components/shared/user-profile-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { WorkoutProvider } from "@/components/shared/workout-provider";
import { RecapManager } from "@/components/shared/recap-manager";
import { DEVELOPMENT_WORKER_RESET } from "@/features/offline/development-worker-reset";
import { ToastProvider } from "@/components/shared/toast-provider";
import { RouteTitle } from "@/components/shared/page-title";
import { SITE_DESCRIPTION, SITE_TITLE, socialMetadata } from "@/lib/site-metadata";
import { THEME_BOOTSTRAP, THEME_COLORS } from "@/features/profile/theme";
import { RouteTransition } from "@/components/shared/route-transition";

export const metadata: Metadata = {
  ...socialMetadata({
    SITE_URL: process.env.SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  }),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "ARCUS Training",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ARCUS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <script id="arcus-development-worker-reset" dangerouslySetInnerHTML={{ __html: DEVELOPMENT_WORKER_RESET }}/>
        )}
        <script id="arcus-theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}/>
        <noscript dangerouslySetInnerHTML={{ __html: `<meta name="theme-color" content="${THEME_COLORS.dark}">` }}/>
      </head>
      <body suppressHydrationWarning><UserProfileProvider><ThemeProvider><WorkoutProvider><ToastProvider><RouteTitle/><ServiceWorkerRegistration /><SyncManager /><RecapManager/><NetworkStatus /><RouteTransition>{children}</RouteTransition><MobileNavigation /></ToastProvider></WorkoutProvider></ThemeProvider></UserProfileProvider></body>
    </html>
  );
}
