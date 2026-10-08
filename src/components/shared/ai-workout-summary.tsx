"use client";

import { useEffect, useState } from "react";
import { Sparkles, Activity } from "lucide-react";
import type { WorkoutRecord } from "@/features/workouts/model";

interface AiSummary {
  summary: string;
  comparisonPeriod: string;
  metricsUsed: string[];
}

export function AiWorkoutSummary({ workout, history }: { workout: WorkoutRecord; history: WorkoutRecord[] }) {
  const [data, setData] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/workout-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workout, history })
    })
    .then(res => res.json())
    .then((res: AiSummary | { error: string }) => {
      if (!active) return;
      if ("error" in res) {
        setError(true);
      } else {
        setData(res);
      }
    })
    .catch(() => {
      if (active) setError(true);
    })
    .finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [workout, history]);

  if (error) {
    return (
      <article className="analytics-panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AI COACH</p>
            <h2>Session Analysis</h2>
          </div>
          <Sparkles className="panel-icon" size={18} />
        </div>
        <p className="method-note" style={{ marginTop: "12px", color: "#e87b7b" }}>
          Failed to generate AI summary. Check your API key and try again.
        </p>
      </article>
    );
  }

  return (
    <article className="analytics-panel" style={{ gridColumn: "1 / -1" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AI COACH</p>
          <h2>Session Analysis</h2>
        </div>
        <Sparkles className="panel-icon" size={18} />
      </div>

      <div style={{ marginTop: "14px" }}>
        {loading ? (
          <div className="loading-block" style={{ minHeight: "40px", padding: 0 }}>Analyzing your progress…</div>
        ) : data ? (
          <>
            <p style={{ color: "#e9e9e9", fontSize: "12px", lineHeight: "1.6" }}>{data.summary}</p>
            <div className="comparison-card" style={{ marginTop: "16px", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span>COMPARISON PERIOD</span>
                <strong style={{ display: "block", fontSize: "11px", marginTop: "3px" }}>{data.comparisonPeriod}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span>METRICS USED</span>
                <small style={{ display: "block", fontSize: "9px", marginTop: "3px", fontFamily: "Consolas, monospace", color: "#a0a0a0" }}>{data.metricsUsed.join(" · ")}</small>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
