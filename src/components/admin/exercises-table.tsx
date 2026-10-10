"use client";

import { Dumbbell } from "lucide-react";
import type { AdminExerciseRow, AdminTablePage } from "@/features/admin/model";
import { DataTable, type DataTableColumn } from "./data-table";
import { ExerciseManagementActions } from "./exercise-management-actions";

function displayLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function sourceLabel(row: AdminExerciseRow) {
  return row.source === "built-in" ? "Built-in catalog" : "Synced custom";
}

const columns: DataTableColumn<AdminExerciseRow>[] = [
  {
    id: "name",
    header: "Exercise",
    cell: row => <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"><Dumbbell aria-hidden="true" size={17} /></span><span className="font-medium text-slate-800">{row.name}</span></div>,
  },
  { id: "muscle", header: "Muscle group", cell: row => <span className="admin-badge inline-flex whitespace-nowrap rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">{displayLabel(row.muscle) || "Not specified"}</span> },
  { id: "equipment", header: "Equipment", cell: row => <span className="text-xs text-slate-500">{displayLabel(row.equipment) || "Not specified"}</span> },
  {
    id: "source",
    header: "Source",
    cell: row => <div><span className={`admin-badge inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${row.source === "built-in" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-blue-100 bg-blue-50 text-blue-700"}`}>{sourceLabel(row)}</span>{row.source === "custom" && row.ownerUsername && <p className="mt-1.5 text-[11px] text-slate-400">@{row.ownerUsername}</p>}</div>,
  },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "w-14 text-right",
    cell: row => <ExerciseManagementActions exercise={row}/> ,
  },
];

type ExercisesTableProps = {
  data: AdminTablePage<AdminExerciseRow>;
  muscle?: string;
  muscleOptions?: string[];
};

export function ExercisesTable({ data, muscle = "", muscleOptions = [] }: ExercisesTableProps) {
  const options = Array.from(new Set([...muscleOptions, ...(muscle ? [muscle] : [])])).sort((left, right) => left.localeCompare(right));
  return <DataTable data={data} columns={columns} getRowId={row => row.id} basePath="/admin/exercises" caption="Exercise library" itemLabel="exercises" searchPlaceholder="Search exercises or equipment…" emptyTitle="No exercises found" emptyDescription={data.query || muscle ? "Try another exercise name or muscle group, or clear your search and filters." : "Built-in exercises and synced custom definitions will appear here."} filters={[{ name: "muscle", label: "Muscle group", value: muscle, options: [{ value: "", label: "All muscle groups" }, ...options.map(value => ({ value, label: displayLabel(value) }))] }]} />;
}
