"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ElapsedWorkoutTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return <div className="elapsed-chip"><Clock3 size={16} /><span>{formatTime(elapsed)}</span></div>;
}
