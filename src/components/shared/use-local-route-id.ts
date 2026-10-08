"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Offline document fallbacks reuse a cached route shell. The address bar still
// identifies the real record, while cached Next.js parameters identify the shell.
export function useLocalRouteId() {
  const params=useParams<{id:string}>();
  const [id,setId]=useState(params.id);
  useEffect(()=>{setId(decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1)??params.id));},[params.id]);
  return id;
}
