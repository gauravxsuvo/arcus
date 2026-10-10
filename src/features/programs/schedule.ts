import type { TrainingProgram } from "./model.ts";
import type { ActiveProgram } from "../profile/model.ts";
import { dateKey } from "../training/logic.ts";
import type { WorkoutRecord } from "../workouts/model.ts";

export function programSchedule(program:TrainingProgram,enrollment:ActiveProgram,now=new Date(),workouts:WorkoutRecord[]=[]){
 const daysSince=Math.floor((Date.parse(`${dateKey(now)}T00:00:00Z`)-Date.parse(`${enrollment.startDate}T00:00:00Z`))/86400000);
 const totalWeeks=program.durationWeeks??12;
 const definedWeeks=Math.max(1,...program.days.map(d=>d.weekIndex+1));
 const rotationMode=enrollment.scheduleMode==="rotation";
 const orderedDays=[...program.days].sort((a,b)=>a.weekIndex-b.weekIndex);
 const completedSessions=workouts.filter(w=>w.status==="completed"&&w.programId===program.id&&w.completedAt&&Date.parse(w.completedAt)>=Date.parse(`${enrollment.startDate}T00:00:00Z`)).length;
 const cycleDays=orderedDays.length;
 const perWeek=Math.max(1,program.daysPerWeek??(program.days.filter(d=>d.weekIndex===0).length||cycleDays));
 const rotationWeek=Math.floor(completedSessions/perWeek)+1;
 const week=rotationMode?Math.min(totalWeeks,rotationWeek):Math.floor(Math.max(0,daysSince)/7)+1;
 const days=program.days.filter(d=>d.weekIndex===(week-1)%definedWeeks);
 const count=Math.min(7,program.daysPerWeek??days.length);
 const offsets=count===3?[0,2,4]:count===4?[0,1,3,4]:Array.from({length:count},(_,i)=>i);
 const slot=offsets.indexOf(((daysSince%7)+7)%7);
 const deload=Boolean(program.deloadEveryNWeeks&&week%program.deloadEveryNWeeks===0);
 const rotationLength=definedWeeks>1?orderedDays.length:totalWeeks*cycleDays;
 const rotationDay=enrollment.nextDayId?orderedDays.find(d=>d.id===enrollment.nextDayId)??orderedDays[completedSessions%Math.max(1,cycleDays)]:orderedDays[completedSessions%Math.max(1,cycleDays)];
 const dateAllowsWorkout=!enrollment.nextWorkoutDate||enrollment.nextWorkoutDate<=dateKey(now);
 const rotationFinished=completedSessions>=rotationLength;
 const day=rotationMode?(dateAllowsWorkout&&!rotationFinished?rotationDay??null:null):(daysSince>=0&&week<=totalWeeks&&slot>=0?days[slot]??null:null);
 return {week,totalWeeks,day,days,deload,deloadNext:!!program.deloadEveryNWeeks&&(week+1)%program.deloadEveryNWeeks===0,block:Math.floor((week-1)/(program.blockWeeks??4))+1,started:rotationMode||daysSince>=0,finished:rotationMode?rotationFinished:week>totalWeeks,mode:rotationMode?"rotation" as const:"calendar" as const,completedSessions,nextWorkoutDate:enrollment.nextWorkoutDate??null};
}
