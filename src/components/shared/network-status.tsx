"use client";

import { useEffect, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return <div className={`network-status ${online ? "network-online" : "network-offline"}`} role="status" aria-live="polite"><span>{online ? <Wifi size={13}/> : <CloudOff size={13}/>}</span>{online ? "Online" : "Offline · logging still available"}</div>;
}
