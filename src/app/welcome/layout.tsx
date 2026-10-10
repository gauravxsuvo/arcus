import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("Welcome | ARCUS", "A focused home for your training. Log the work, see your progress, and know what to do in your next session.", true);

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
