import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { WorkoutRecord } from "@/features/workouts/model";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { workout, history } = await request.json() as { workout: WorkoutRecord; history: WorkoutRecord[] };

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        summary: "To see your AI workout summary, please add your GEMINI_API_KEY to the .env.local file.",
        comparisonPeriod: "No data",
        metricsUsed: ["Configuration required"]
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const completedAt = workout.completedAt ?? workout.startedAt;
    const recentHistory = history
      .filter(w => w.completedAt && w.id !== workout.id && new Date(w.completedAt) < new Date(completedAt))
      .sort((a, b) => Date.parse(b.completedAt ?? b.startedAt) - Date.parse(a.completedAt ?? a.startedAt))
      .slice(0, 10); // Look at last 10 workouts

    let prompt = `You are a supportive, analytical AI workout coach.
The user just completed a workout.

Current Workout:
Name: ${workout.name}
Date: ${workout.completedAt}
Exercises:
${workout.exercises.map(e => `- ${e.name}: ${e.sets.filter(s => s.completed).length} sets`).join("\n")}

`;

    if (recentHistory.length === 0) {
      prompt += `The user has NO previous workouts recorded on this device.
Write a short, encouraging summary of their first workout! 
Keep it under 3 sentences. Focus on the exercises they did today. Do not claim progress.

Return a JSON object exactly like this (no markdown block):
{
  "summary": "...",
  "comparisonPeriod": "First workout",
  "metricsUsed": ["Volume", "Sets"]
}`;
    } else {
      prompt += `Previous Workouts (last ${recentHistory.length}):
${JSON.stringify(recentHistory.map(w => ({
  name: w.name,
  date: w.completedAt,
  exercises: w.exercises.map(e => ({ name: e.name, sets: e.sets.filter(s => s.completed).map(s => ({w:s.weight, r:s.reps})) }))
})))}

Compare the Current Workout to their Previous Workouts. 
Requirements:
1. Write a short, personalized summary (under 4 sentences).
2. Compare the same exercises and similar conditions.
3. Highlight changes in weights, reps, sets, or volume.
4. Mention PRs or notable improvements if any.
5. Mention exercises that stayed the same or declined if applicable.
6. Use supportive, specific language. Do not invent numbers or make medical claims.
7. If there is not enough data for a trend, clearly say this is based on limited history.

Return a JSON object exactly like this (no markdown block):
{
  "summary": "...",
  "comparisonPeriod": "Compared to last ${recentHistory.length} workouts",
  "metricsUsed": ["Weight", "Reps", "Volume"]
}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
      }
    });

    if (!response.text) throw new Error("No response from AI");
    const result = JSON.parse(response.text);

    return NextResponse.json(result);

  } catch (error) {
    console.error("AI Summary Error:", error);
    return NextResponse.json({ error: "Failed to generate AI summary." }, { status: 500 });
  }
}
