import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import { ArcusMark } from "@/components/shared/arcus-mark";

export default function NotFound() {
  return <main className="not-found-shell">
    <Link className="brand" href="/dashboard"><ArcusMark/>ARCUS.</Link>
    <p className="eyebrow">PAGE NOT FOUND · 404</p>
    <h1>Let’s get you<br/>back to training.</h1>
    <p>This link may have moved. Your training log is still here.</p>
    <div><Link className="action-button" href="/dashboard">Go to Home <ArrowRight size={18}/></Link><Link className="outline-button" href="/workout"><Dumbbell size={18}/> Open workout</Link></div>
  </main>;
}
