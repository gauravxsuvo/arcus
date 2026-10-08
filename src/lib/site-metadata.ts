import type { Metadata } from "next";

type SiteEnvironment = {
  SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

export const SITE_TITLE = "ARCUS — Training, made measurable";
export const SITE_DESCRIPTION = "A focused training log built for better sessions and clearer progress.";

/** Use a configured public origin, never a temporary tunnel or request Host header. */
export function siteOrigin(environment: SiteEnvironment): URL {
  const configured = environment.SITE_URL?.trim();
  const deployment = environment.VERCEL_PROJECT_PRODUCTION_URL?.trim() || environment.VERCEL_URL?.trim();
  let url: URL;
  try {
    url = new URL(configured || (deployment ? `https://${deployment}` : "http://localhost:3000"));
  } catch {
    throw new Error("SITE_URL must be a public HTTP(S) URL without credentials.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("SITE_URL must be a public HTTP(S) URL without credentials.");
  }
  return new URL(url.origin);
}

export function socialMetadata(environment: SiteEnvironment): Metadata {
  const origin = siteOrigin(environment);
  const image = {
    url: new URL("/og/arcus-share.png", origin).href,
    width: 1200,
    height: 630,
    alt: "ARCUS. Training, made measurable. Show up. Track honestly. Get stronger.",
  };
  return {
    metadataBase: origin,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "ARCUS",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: origin.href,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
