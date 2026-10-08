import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
