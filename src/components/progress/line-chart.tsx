"use client";

import dynamic from "next/dynamic";

export type ChartPoint = { label: string; date?: string; value: number; secondary?: number | null };
const InteractiveChart = dynamic(() => import("./interactive-chart"), {
  ssr: false,
  loading: () => <div className="loading-block" role="status">Preparing chart…</div>,
});

export function LineChart({ points, label, unit = "kg", secondaryLabel }: {
  points: ChartPoint[]; label: string; unit?: string; secondaryLabel?: string;
}) {
  const valid = points.filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.date || point.label)));
  if (!valid.length) return <p className="feature-muted">Log data to build this chart.</p>;
  return <InteractiveChart label={label} unit={unit} secondaryLabel={secondaryLabel}
    points={valid.map((point, index) => ({ ...point, id: `${point.date || point.label}-${index}`, date: point.date || point.label }))}/>;
}
