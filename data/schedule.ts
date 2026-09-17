import {DailyEntry} from '../types';
import topics from './topics';
export const START='2026-09-17', FINAL='2026-11-28', PRE='2026-11-29', COMP='2026-11-30';
export function isoAdd(date:string,n:number){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
export function generateSchedule():DailyEntry[]{const out:DailyEntry[]=[];let offset=0;for(let i=0;i<7;i++,offset++)out.push({date:isoAdd(START,offset),kind:'satr'});for(const t of topics){for(let day=1;day<=2;day++,offset++)out.push({date:isoAdd(START,offset),kind:'topic',topicId:t.id,topicDay:day as 1|2});}for(let i=0;i<12;i++,offset++)out.push({date:isoAdd(START,offset),kind:'break'});for(let i=0;i<4;i++,offset++)out.push({date:isoAdd(START,offset),kind:'review'});out.push({date:PRE,kind:'pre'},{date:COMP,kind:'competition'});return out;}
export const schedule=generateSchedule();
