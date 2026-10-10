"use client";
import { useState } from "react";
import Link from "next/link";
import { useProfile } from "@/components/shared/user-profile-provider";
import { programTemplates,createTemplateProgram } from "@/features/programs/templates";
import { saveProgram } from "@/features/local-data/repository";
export function TemplateLibrary({onSaved}:{onSaved:()=>Promise<void>}){
 const {user}=useProfile();const [level,setLevel]=useState<string|null>(null);const current=level??user?.profile.experience??"all";const [message,setMessage]=useState("");
 async function add(id:string){const program=createTemplateProgram(id);await saveProgram(program);await onSaved();setMessage(`${program.name} added to your plans. Open it to choose a start date.`);}
 return <section className="feature-panel"><div className="panel-heading"><div><p className="eyebrow">START WITH A PLAN</p><h2>Program library</h2></div><select aria-label="Program experience level" value={current} onChange={e=>setLevel(e.target.value)}><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div><div className="template-grid">{programTemplates.filter(t=>current==="all"||t.level===current||(t.id==="531-bbb"&&current==="intermediate")).map(t=><article className="template-card" key={t.id}><small>{t.level} · {t.daysPerWeek} days / week</small><h3>{t.name}</h3><p>{t.description}</p><button className="outline-button" onClick={()=>void add(t.id)}>Add this program</button>{t.sourceUrl&&<a className="text-action" href={t.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Program reference (opens in a new tab)">Program reference</a>}</article>)}</div><Link className="text-action" href="#custom-builder">Build a custom program ↓</Link>{message&&<p role="status">{message}</p>}</section>;
}
