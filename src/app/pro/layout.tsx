import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata(
  "ARCUS Pro | ARCUS",
  "Unlock unlimited training plans, custom exercises, deeper progress history, and more with ARCUS Pro.",
  true,
);

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
