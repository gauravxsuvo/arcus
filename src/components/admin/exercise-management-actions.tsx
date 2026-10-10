"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import type { AdminExerciseRow } from "@/features/admin/model";
import { AdminActionDialog, submitAdminAction } from "./admin-action-dialog";
import { DetailField, RowActions } from "./row-actions";

export function ExerciseManagementActions({ exercise }: { exercise: AdminExerciseRow }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isBuiltIn = exercise.source === "built-in" || !exercise.ownerAccountId || !exercise.libraryId;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({ action: "exercise.update", accountId: exercise.ownerAccountId!, exerciseId: exercise.libraryId!, name: String(form.get("name") ?? ""), muscle: String(form.get("muscle") ?? ""), equipment: String(form.get("equipment") ?? "") });
  }

  async function remove() {
    await run({ action: "exercise.delete", accountId: exercise.ownerAccountId!, exerciseId: exercise.libraryId! });
  }

  async function run(payload: Record<string, string>) {
    setBusy(true); setError(""); setMessage("");
    try {
      setMessage(await submitAdminAction(payload)); setDialog(null); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="flex flex-col items-end gap-1">
      <RowActions label={exercise.name} detailsTitle="Exercise details" actions={[
        { label: "Edit exercise", icon: Pencil, disabled: isBuiltIn, disabledReason: isBuiltIn ? "Built-in exercises are bundled with the app; only synced custom exercises can be edited here." : undefined, onSelect: () => { setError(""); setDialog("edit"); } },
        { label: "Delete exercise", icon: Trash2, destructive: true, disabled: isBuiltIn, disabledReason: isBuiltIn ? "Built-in exercises cannot be removed from the shared app catalog." : undefined, onSelect: () => { setError(""); setDialog("delete"); } },
      ]} details={
        <>
          <div className="mb-4 flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700"><Dumbbell aria-hidden="true" size={24} /></span><div><p className="font-semibold text-slate-900">{exercise.name}</p><p className="mt-1 text-sm text-slate-500">{exercise.source === "built-in" ? "Built-in catalog" : "Synced custom"}</p></div></div>
          <dl><DetailField label="Exercise ID" mono>{exercise.id}</DetailField><DetailField label="Exercise name">{exercise.name}</DetailField><DetailField label="Muscle group">{exercise.muscle || "Not specified"}</DetailField><DetailField label="Equipment">{exercise.equipment || "Not specified"}</DetailField><DetailField label="Source">{exercise.source === "built-in" ? "Built-in catalog" : "Synced custom"}</DetailField>{exercise.ownerUsername && <DetailField label="Owner">@{exercise.ownerUsername}</DetailField>}</dl>
        </>
      } />
      {message && <span role="status" className="max-w-36 text-right text-[10px] leading-4 text-teal-700">{message}</span>}
    </div>
    {dialog === "edit" && <AdminActionDialog title="Edit custom exercise" description="Changes update the shared definition. Previous workout history keeps the name recorded in each session." busy={busy} onClose={() => setDialog(null)} footer={<><button type="button" onClick={() => setDialog(null)} disabled={busy} className="admin-button h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button form="admin-edit-exercise" type="submit" disabled={busy} className="admin-button admin-button-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium">{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>}Save exercise</button></>}>
      <form id="admin-edit-exercise" onSubmit={event => void save(event)} className="grid gap-4">
        <Field label="Exercise name"><input name="name" defaultValue={exercise.name} maxLength={200} required/></Field>
        <Field label="Muscle group"><input name="muscle" defaultValue={exercise.muscle === "Unspecified" ? "" : exercise.muscle} maxLength={100} required/></Field>
        <Field label="Equipment"><input name="equipment" defaultValue={exercise.equipment === "Unspecified" ? "" : exercise.equipment} maxLength={100} required/></Field>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    </AdminActionDialog>}
    {dialog === "delete" && <AdminActionDialog title="Remove this custom exercise?" description="It will disappear from the shared exercise library. Existing workouts keep their recorded exercise names and history." busy={busy} onClose={() => setDialog(null)} footer={<><button type="button" onClick={() => setDialog(null)} disabled={busy} className="admin-button h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button type="button" onClick={() => void remove()} disabled={busy} className="admin-button inline-flex h-10 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800">{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>}Remove exercise</button></>}>
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4"><p className="font-medium text-rose-900">{exercise.name}</p><p className="mt-1 text-sm text-rose-800">Owned by @{exercise.ownerUsername ?? "unknown"}</p></div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    </AdminActionDialog>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}{children}</label>;
}
