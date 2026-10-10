import type { Metadata } from "next";
import { ExercisesTable } from "@/components/admin/exercises-table";
import { getAdminExercises } from "@/features/admin/repository";
import { parseAdminQuery, type AdminSearchParams } from "@/features/admin/query";

export const metadata: Metadata = { title: "Exercise database", description: "Review custom movement definitions synced to the ARCUS exercise catalog." };

export default async function AdminExercisesPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const options = parseAdminQuery(await searchParams);
  const { data, muscleOptions } = await getAdminExercises(options);
  return <section>
    <p className="admin-eyebrow">Movement directory</p>
    <h1 className="admin-page-title">Exercise database</h1>
    <p className="admin-page-description">Browse the shipped catalog and account-owned custom exercises synced to PostgreSQL.</p>
    <ExercisesTable data={data} muscleOptions={muscleOptions} muscle={options.muscle}/>
  </section>;
}
