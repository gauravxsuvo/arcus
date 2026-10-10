import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-polish.css";
import { DEVELOPMENT_WORKER_RESET } from "@/features/offline/development-worker-reset";
import { SITE_DESCRIPTION, SITE_TITLE, socialMetadata } from "@/lib/site-metadata";
import { THEME_BOOTSTRAP, THEME_COLORS } from "@/features/profile/theme";
import { ApplicationShell } from "@/components/shared/application-shell";

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
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "ARCUS", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body suppressHydrationWarning><ApplicationShell currentYear={new Date().getFullYear()}>{children}</ApplicationShell></body>
    </html>
  );
}
