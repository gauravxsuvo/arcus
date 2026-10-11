import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/server";
import { listRoutines } from "@/features/routines/actions";
import { RoutinesBrowser } from "@/components/routines/RoutinesBrowser";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("Routines | ARCUS", "Save and launch your repeatable ARCUS workout templates.");

export default async function RoutinesPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login?next=%2Froutines");
  const routines = await listRoutines();
  return <RoutinesBrowser initialRoutines={routines} isPro={account.isPro}/>;
}
