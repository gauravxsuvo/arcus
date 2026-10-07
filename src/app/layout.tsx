import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";
import { SyncManager } from "@/components/shared/sync-manager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — Training, made measurable",
  description: "A focused training log built for better sessions and clearer progress.",
  applicationName: "Forge Training",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#101310",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><ServiceWorkerRegistration /><SyncManager />{children}</body>
    </html>
  );
}
