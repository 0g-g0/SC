import {DailyEntry} from '../types';
import topics from './topics';
// Numbered plan days have no calendar start date or time-based lock.
export const schedule:DailyEntry[]=[
 ...Array.from({length:3},(_,i)=>({date:`day-${i+1}`,kind:'satr' as const})),
 ...topics.flatMap((t,i)=>[1,2].map(day=>({date:`day-${i*2+day+3}`,kind:'topic' as const,topicId:t.id,topicDay:day as 1|2})))
];
