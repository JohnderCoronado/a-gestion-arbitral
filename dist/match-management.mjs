import {active,eligibility} from './domain.mjs';
import {validateCalendarEvent} from './calendar.mjs';

const fields=['tournament','home','away','date','time','duration','venue','lat','lng','charge'];
const reconfirmFields=['tournament','home','away','date','time','duration','venue','lat','lng'];
const labels={tournament:'Torneo',home:'Equipo local',away:'Equipo visitante',date:'Fecha',time:'Hora',duration:'Duración',venue:'Cancha',lat:'Latitud',lng:'Longitud',charge:'Cobro al organizador'};
const roles=['Central','Asistente 1','Asistente 2'];
const requireAdmin=actor=>{if(actor!=='admin')throw Error('Esta acción corresponde al administrador.');};
const find=(db,id)=>{const m=db.matches.find(m=>m.id===id);if(!m)throw Error('No se encontró el partido.');return m;};
const name=(db,id)=>db.refs.find(r=>r.id===id)?.name||'Árbitro';
const snapshot=m=>Object.fromEntries([...fields,'slots','deletedAt','collected'].map(key=>[key,structuredClone(m[key]??null)]));
const integer=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;

export function validateMatch(db,m){
 if(!db.tournaments.some(t=>t.id===m.tournament))throw Error('Seleccione un torneo válido.');
 if(!m.home?.trim()||!m.away?.trim()||!m.venue?.trim())throw Error('Complete los equipos y la cancha.');
 if(m.home.trim().toLocaleLowerCase()===m.away.trim().toLocaleLowerCase())throw Error('Los equipos deben ser diferentes.');
 try{validateCalendarEvent({title:m.home,date:m.date,time:m.time,duration:m.duration,reminderDays:null});}catch(e){throw Error(e.message.replaceAll('evento','partido'));}
 if(!Number.isInteger(m.duration)||m.duration<30||m.duration>240)throw Error('El bloque del partido debe ser de 30 a 240 minutos.');
 if(!integer(m.charge,10000000))throw Error('Revise el cobro al organizador.');
 const noLat=m.lat===null||m.lat===undefined,noLng=m.lng===null||m.lng===undefined;
 if(noLat!==noLng||(!noLat&&(!Number.isFinite(m.lat)||!Number.isFinite(m.lng)||Math.abs(m.lat)>90||Math.abs(m.lng)>180)))throw Error('Ingrese ambas coordenadas dentro de sus rangos o deje ambas vacías.');
 if(![1,3].includes(m.slots.length)||m.slots.some((s,i)=>s.role!==roles[i]||!integer(s.fee,1000000)))throw Error('Revise los puestos y honorarios del equipo arbitral.');
 return m;
}

export function prepareMatchUpdate(db,id,patch={},actor='admin',options={}){
 requireAdmin(actor);const current=find(db,id),restoring=options.restore===true;
 if(current.deletedAt&&!restoring)throw Error('Restaure el partido para poder modificarlo.');
 if(!current.deletedAt&&restoring)throw Error('El partido ya está activo.');
 const next=structuredClone(current);
 for(const key of fields)if(Object.hasOwn(patch,key))next[key]=patch[key];
 const crew=patch.crew??current.slots.length;if(![1,3].includes(crew))throw Error('Seleccione uno o tres árbitros.');
 next.slots=roles.slice(0,crew).map(role=>{
  const previous=current.slots.find(s=>s.role===role);
  const s=previous?structuredClone(previous):{id:crypto.randomUUID(),role,ref:'',status:'empty',fee:role==='Central'?22000:16000,paid:false};
  if(Object.hasOwn(patch.fees||{},role))s.fee=patch.fees[role];
  return s;
 });
 if(restoring){next.deletedAt=null;next.deletionReason='';}
 validateMatch(db,next);
 if(current.collected&&next.charge!==current.charge)throw Error('El cobro ya fue registrado. Revierta ese registro en Cobros y pagos antes de cambiar el importe.');
 for(const s of current.slots.filter(s=>s.paid)){
  const retained=next.slots.find(n=>n.id===s.id);
  if(!retained||retained.fee!==s.fee)throw Error(`El puesto de ${name(db,s.ref)} tiene un pago registrado. Revierta ese registro antes de cambiar su importe o retirar el puesto.`);
 }
 const changes=fields.filter(f=>current[f]!==next[f]).map(field=>({field,label:labels[field],before:current[field]??null,after:next[field]??null}));
 if(crew!==current.slots.length)changes.push({field:'crew',label:'Cantidad de árbitros',before:current.slots.length,after:crew});
 for(const s of next.slots){const old=current.slots.find(o=>o.id===s.id);if(old&&old.fee!==s.fee)changes.push({field:'fee',label:`Honorarios · ${s.role}`,before:old.fee,after:s.fee});}
 const mustReconfirm=restoring||reconfirmFields.some(f=>current[f]!==next[f]),renewed=[],released=[];
 const context={...db,matches:db.matches.map(m=>m.id===id?next:m)};
 for(const s of next.slots){
  const old=current.slots.find(o=>o.id===s.id);if(!old||!active(old)||(!mustReconfirm&&old.fee===s.fee))continue;
  const result=eligibility(context,db.refs.find(r=>r.id===s.ref),next,s);
  if(!result.ok){
   if(s.paid)throw Error(`${name(db,s.ref)} tiene un pago registrado y no puede conservar el nombramiento: ${result.reason}. Revierta ese pago antes de liberar el puesto.`);
   released.push({ref:s.ref,role:s.role,reason:result.reason});Object.assign(s,{ref:'',status:'empty',paid:false});
  }else{s.status='pending';renewed.push({ref:s.ref,role:s.role});}
 }
 for(const s of current.slots.filter(s=>active(s)&&!next.slots.some(n=>n.id===s.id)))released.push({ref:s.ref,role:s.role,reason:'Puesto retirado del equipo arbitral'});
 return {matchId:id,baseFingerprint:JSON.stringify(current),before:snapshot(current),after:next,changes,renewed,released,kind:restoring?'restore':options.reschedule?'reschedule':'edit',reason:String(patch.reason||'').trim().slice(0,500),noop:!restoring&&changes.length===0};
}

export function applyMatchUpdate(db,plan,actor='admin'){
 requireAdmin(actor);const current=find(db,plan.matchId);
 if(JSON.stringify(current)!==plan.baseFingerprint)throw Error('El partido cambió después de la revisión. Abra el formulario de nuevo.');
 if(plan.noop)return current;
 const at=new Date().toISOString(),next=structuredClone(plan.after);
 next.history=[...(current.history||[]),{action:plan.kind,at,actor:'Administrador',reason:plan.reason,before:plan.before,after:snapshot(next),renewed:structuredClone(plan.renewed),released:structuredClone(plan.released)}];
 next.revision=(current.revision||0)+1;
 next.lastChange={action:plan.kind,at,reason:plan.reason,fromDate:current.date,fromTime:current.time};
 db.matches[db.matches.indexOf(current)]=next;return next;
}

export function deleteMatch(db,id,reason='',actor='admin'){
 requireAdmin(actor);const m=find(db,id);if(m.deletedAt)throw Error('El partido ya está en Eliminados.');
 const before=snapshot(m),at=new Date().toISOString();m.deletedAt=at;m.deletionReason=String(reason).trim().slice(0,500);m.revision=(m.revision||0)+1;
 m.history=[...(m.history||[]),{action:'delete',at,actor:'Administrador',reason:m.deletionReason,before,after:snapshot(m)}];
 return m;
}
