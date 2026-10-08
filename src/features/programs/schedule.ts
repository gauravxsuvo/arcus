import type { TrainingProgram } from "./model.ts";
import type { ActiveProgram } from "../profile/model.ts";
import { dateKey } from "../training/logic.ts";
export function programSchedule(program:TrainingProgram,enrollment:ActiveProgram,now=new Date()){
 const daysSince=Math.floor((Date.parse(`${dateKey(now)}T00:00:00Z`)-Date.parse(`${enrollment.startDate}T00:00:00Z`))/86400000);
 const week=Math.floor(Math.max(0,daysSince)/7)+1;
 const totalWeeks=program.durationWeeks??12;
 const definedWeeks=Math.max(1,...program.days.map(d=>d.weekIndex+1));
 const days=program.days.filter(d=>d.weekIndex===(week-1)%definedWeeks);
 const count=Math.min(7,program.daysPerWeek??days.length);
 const offsets=count===3?[0,2,4]:count===4?[0,1,3,4]:Array.from({length:count},(_,i)=>i);
 const slot=offsets.indexOf(((daysSince%7)+7)%7);
 const deload=Boolean(program.deloadEveryNWeeks&&week%program.deloadEveryNWeeks===0);
 return {week,totalWeeks,day:daysSince>=0&&week<=totalWeeks&&slot>=0?days[slot]??null:null,days,deload,deloadNext:!!program.deloadEveryNWeeks&&(week+1)%program.deloadEveryNWeeks===0,block:Math.floor((week-1)/(program.blockWeeks??4))+1,started:daysSince>=0,finished:week>totalWeeks};
}
