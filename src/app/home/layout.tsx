import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata(
  "Community Feed | ARCUS",
  "Discover training sessions, follow athletes, and share progress with the ARCUS community.",
  true,
);

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
