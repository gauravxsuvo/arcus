import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { libraryEntrySchema } from "@/features/import-export/restore-schema";
export const runtime="nodejs";
const batch=z.object({entries:z.array(libraryEntrySchema).max(50)});
export async function POST(request:Request) {
  try {
    const account=await getCurrentAccountFromRequest(request);if(!account)return NextResponse.json({error:"Not signed in."},{status:401});
    const parsed=batch.safeParse(await readProfileBody(request));if(!parsed.success)return NextResponse.json({error:"Invalid library batch."},{status:400});
    if(parsed.data.entries.some(e=>JSON.stringify(e.payload).length>256*1024))return NextResponse.json({error:"A library record exceeds 256 KiB. Split large programs into smaller plans."},{status:413});
    if(new Set(parsed.data.entries.map(e=>`${e.kind}:${e.id}`)).size!==parsed.data.entries.length)return NextResponse.json({error:"Duplicate batch entries."},{status:400});
    const result=await getDatabasePool().query(`insert into public.arcus_library(account_id,kind,id,payload,updated_at)
      select $1, value->>'kind',value->>'id',value->'payload',(value->>'updatedAt')::timestamptz from jsonb_array_elements($2::jsonb)
      on conflict(account_id,kind,id) do update set payload=excluded.payload,updated_at=excluded.updated_at
      where excluded.updated_at >= arcus_library.updated_at returning kind,id,updated_at`,[account.id,JSON.stringify(parsed.data.entries)]);
    return NextResponse.json({accepted:result.rows});
  }catch(error){if(error instanceof ProfileInputError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:"Library sync unavailable."},{status:503});}
}
export async function GET(request:Request) {
  try {
    const account=await getCurrentAccountFromRequest(request);if(!account)return NextResponse.json({error:"Not signed in."},{status:401});
    const params=new URL(request.url).searchParams;const offset=Math.floor(Math.max(0,Math.min(100000,Number(params.get("offset"))||0)));
    const result=await getDatabasePool().query("select kind,id,payload from public.arcus_library where account_id=$1 order by kind,id limit 20 offset $2",[account.id,offset]);
    return NextResponse.json({entries:result.rows,nextOffset:result.rows.length===20?offset+20:null});
  }catch{return NextResponse.json({error:"Library lookup unavailable."},{status:503});}
}
