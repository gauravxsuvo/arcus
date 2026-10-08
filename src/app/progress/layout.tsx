import type { Metadata } from "next";

export const metadata: Metadata = { title: "Progress | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
