export type WakeStatus = "off" | "requesting" | "active" | "waiting" | "unavailable";
type ScreenLock = { released: boolean; release(): Promise<void>; addEventListener(type: "release", listener: () => void): void };

/** One owned lock, released when hidden/disposed, including requests still in flight. */
export function createScreenWakeLock({ request, visible, onStatus }: {
  request: () => Promise<ScreenLock>; visible: () => boolean; onStatus: (status: WakeStatus) => void;
}) {
  let lock: ScreenLock | null = null;
  let pending = false;
  let disposed = false;
  async function refresh() {
    if (disposed) return;
    if (!visible()) {
      const previous = lock; lock = null;
      onStatus("waiting");
      await previous?.release().catch(() => undefined);
      return;
    }
    if (pending || lock && !lock.released) return;
    pending = true;
    onStatus("requesting");
    try {
      const next = await request();
      if (disposed || !visible()) { await next.release().catch(() => undefined); if (!disposed) onStatus("waiting"); return; }
      lock = next;
      onStatus("active");
      next.addEventListener("release", () => {
        if (!disposed && lock === next) { lock = null; onStatus("waiting"); }
      });
    } catch { if (!disposed) onStatus("unavailable"); }
    finally { pending = false; }
  }
  function dispose() { disposed = true; const previous = lock; lock = null; void previous?.release().catch(() => undefined); }
  return { refresh, dispose };
}
