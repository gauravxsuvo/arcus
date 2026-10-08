import type { Metadata } from "next";

export const metadata: Metadata = { title: "Weekly recaps | ARCUS" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
