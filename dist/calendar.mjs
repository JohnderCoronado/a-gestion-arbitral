import {liveMatches} from './domain.mjs';
// Calendar times use Costa Rica (UTC-06:00), independently of the device timezone.
export const eventStart=e=>new Date(`${e.date}T${e.time}:00-06:00`);
export const eventEnd=e=>new Date(eventStart(e).getTime()+Number(e.duration)*60000);
export function monthDays(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mes inválido.');
 const first=new Date(month+'-01T12:00:00Z'),offset=(first.getUTCDay()+6)%7;
 return Array.from({length:42},(_,i)=>new Date(first.getTime()+(i-offset)*86400000).toISOString().slice(0,10));
}
export function agendaItems(db,date,type='all'){
 const matches=type==='events'?[]:liveMatches(db).filter(m=>m.date===date).map(m=>({kind:'match',id:m.id,date:m.date,time:m.time,title:`${m.home} vs ${m.away}`,venue:m.venue,duration:m.duration}));
 const events=type==='matches'?[]:(db.calendarEvents||[]).filter(e=>e.date===date).map(e=>({...e,kind:'event'}));
 return [...matches,...events].sort((a,b)=>a.time.localeCompare(b.time)||a.title.localeCompare(b.title));
}
export function dueReminders(events,now=new Date()){
 return events.filter(e=>e.reminderDays!==null&&!e.reminderSeen&&e.status!=='cancelled'&&Number.isInteger(e.reminderDays)&&e.reminderDays>=0&&now.getTime()>=eventStart(e).getTime()-e.reminderDays*86400000&&now<eventEnd(e)).sort((a,b)=>eventStart(a)-eventStart(b));
}
export function validateCalendarEvent(e){
 if(!String(e.title||'').trim())throw Error('Escriba el nombre del evento.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)||Number.isNaN(eventStart(e).getTime()))throw Error('Revise la fecha y la hora del evento.');
 // JavaScript normalizes dates such as February 30: reject them explicitly.
 const dateCheck=new Date(e.date+'T12:00:00Z');if(dateCheck.toISOString().slice(0,10)!==e.date)throw Error('La fecha del evento no existe.');
 if(!Number.isInteger(e.duration)||e.duration<15||e.duration>720)throw Error('La duración debe ser de 15 a 720 minutos.');
 const [h,m]=e.time.split(':').map(Number);if(h*60+m+e.duration>1439)throw Error('El evento debe terminar antes de medianoche.');
 if(e.reminderDays!==null&&![0,1,2,3,7].includes(e.reminderDays))throw Error('Seleccione un aviso válido.');
 return e;
}
const icsText=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function fold(line){
 let result='',column=0;const encoder=new TextEncoder();
 for(const char of line){const width=encoder.encode(char).length;if(column+width>75){result+='\r\n ';column=1}result+=char;column+=width}
 return result;
}
export function calendarICS(events,now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//A//Calendario de gestion arbitral//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const e of events){validateCalendarEvent(e);lines.push('BEGIN:VEVENT',`UID:${String(e.id).replace(/[^a-zA-Z0-9_-]/g,'')}@a-gestion-arbitral.demo`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(eventStart(e))}`,`DTEND:${stamp(eventEnd(e))}`,`SEQUENCE:${Number(e.sequence)||0}`,`SUMMARY:${icsText(e.title)}`,`LOCATION:${icsText(e.venue)}`,`DESCRIPTION:${icsText(e.notes||'Evento de la asociación · A')}`,`STATUS:${e.status==='cancelled'?'CANCELLED':'CONFIRMED'}`);
  if(e.reminderDays!==null&&e.status!=='cancelled')lines.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsText(e.title)}`,`TRIGGER:${e.reminderDays===0?'PT0M':`-P${e.reminderDays}D`}`,'END:VALARM');
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
