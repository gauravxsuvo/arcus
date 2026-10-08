import type { Metadata } from "next";

export const metadata: Metadata = { title: "Programs | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
