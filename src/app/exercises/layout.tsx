import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exercise library | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
