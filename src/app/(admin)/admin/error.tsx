"use client";
import Link from "next/link";
import { useTransition } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";

export default function AdminError({ reset }: { reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return <section className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center" role="alert">
    <CircleAlert className="mx-auto mb-5 text-stone-500" size={28} aria-hidden="true"/>
    <h1 className="text-xl font-semibold tracking-tight">The console is temporarily unavailable</h1>
    <p className="mt-3 text-sm leading-6 text-stone-500">Your request could not be completed. Check the connection and try again.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <button type="button" disabled={pending} onClick={() => startTransition(reset)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 text-sm font-medium text-white disabled:opacity-60">
        {pending && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>}{pending ? "Retrying…" : "Try again"}
      </button>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-200 px-5 text-sm">Return to app</Link>
    </div>
  </section>;
}
