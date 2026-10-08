import type { Metadata } from "next";

export const metadata: Metadata = { title: "Welcome | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
