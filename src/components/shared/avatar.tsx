"use client";
import Image from "next/image";
import { useProfile } from "./user-profile-provider";
export function Avatar({size=32}:{size?:number}) { const {user}=useProfile(); const initials=(user?.name??"Athlete").split(/\s+/).slice(0,2).map(s=>s.charAt(0).toUpperCase()).join(""); return <span className="shared-avatar" style={{width:size,height:size}}>{user?.profile.avatarUrl?<Image src={user.profile.avatarUrl} alt="" width={size} height={size} unoptimized/>:initials}</span>; }
