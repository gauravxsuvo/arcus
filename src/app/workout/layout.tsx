import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("Workout | ARCUS", "Log exercises, sets, reps, weights, effort, and rest during an active ARCUS workout.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
