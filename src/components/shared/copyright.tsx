"use client";
import { useEffect, useState } from "react";

export function Copyright() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => { setYear(new Date().getFullYear()); }, []);
  return <span>© {year === null ? "" : `${year} `}ARCUS Training</span>;
}
