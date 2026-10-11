"use client";

/** Render at a fixed 540 × 960 source size, then upscale for story platforms. */
export async function generateStoryImage(node: HTMLElement): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("Image export is only available in a browser.");

  await document.fonts.ready;
  await Promise.all(Array.from(node.querySelectorAll("img")).map(async (image) => {
    if (image.complete) {
      try { await image.decode(); } catch { /* The card includes an initials fallback. */ }
      return;
    }
    await new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  }));

  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio: 3,
    cacheBust: true,
    quality: 0.95,
    backgroundColor: "#09090b",
    width: 540,
    height: 960,
  });
  if (!blob) throw new Error("ARCUS could not create the workout image. Please try again.");
  return blob;
}

export function downloadImage(blob: Blob, filename: string): void {
  if (typeof window === "undefined") throw new Error("Image export is only available in a browser.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareOrDownloadImage(blob: Blob, filename: string): Promise<{ shared: boolean }> {
  if (typeof window === "undefined") throw new Error("Image export is only available in a browser.");
  const file = new File([blob], filename, { type: "image/png" });
  let canShareFiles = false;
  try { canShareFiles = typeof navigator.share === "function" && Boolean(navigator.canShare?.({ files: [file] })); }
  catch { canShareFiles = false; }
  if (canShareFiles) {
    await navigator.share({ files: [file], title: "ARCUS Workout" });
    return { shared: true };
  }
  downloadImage(blob, filename);
  return { shared: false };
}
