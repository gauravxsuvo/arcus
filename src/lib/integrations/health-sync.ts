import type { WorkoutRecord } from "@/features/workouts/model";
import type { BodyMetric } from "@/features/profile/model";
export type HealthProvider="apple-health"|"google-fit";
export async function exportWorkout(workout:WorkoutRecord,provider:HealthProvider):Promise<{supported:false;reason:string}>{void workout;void provider;return {supported:false,reason:"Native health access requires a platform integration. Coming soon."};}
export async function importBodyMetrics(provider:HealthProvider):Promise<{supported:false;entries:BodyMetric[]}>{void provider;return {supported:false,entries:[]};}
