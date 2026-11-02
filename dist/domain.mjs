export const money = n => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC', maximumFractionDigits:0}).format(n);
export const endTime = (time, duration) => { const n=minutes(time)+duration; return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; };
export function minutes(time) { const [h,m]=time.split(':').map(Number); return h*60+m; }
export const active = a => ['pending','accepted'].includes(a.status);
export function eligibility(db, ref, match, slot) {
 const tournament=db.tournaments.find(t=>t.id===match.tournament);
 if(!tournament?.refs.includes(ref.id)) return {ok:false, reason:'Fuera del panel del torneo'};
 const window=ref.availability[match.date];
 if(!window || minutes(window.start)>minutes(match.time) || minutes(window.end)<minutes(match.time)+match.duration) return {ok:false,reason:'Sin disponibilidad para todo el partido'};
 const clash=db.matches.some(m=>m.date===match.date && m.slots.some(s=>s.id!==slot.id && s.ref===ref.id && active(s)) && minutes(match.time)<minutes(m.time)+m.duration+45 && minutes(m.time)<minutes(match.time)+match.duration+45);
 if(clash) return {ok:false,reason:'Cruce de horario o traslado (45 min)'};
 return {ok:true,reason:'Disponible · sin cruces'};
}
export function assign(db, matchId, slotId, refId) {
 const match=db.matches.find(m=>m.id===matchId),slot=match?.slots.find(s=>s.id===slotId),ref=db.refs.find(r=>r.id===refId);
 if(!slot || !ref) throw Error('Seleccione un árbitro y un puesto válidos.');
 if(active(slot)) throw Error('Este puesto ya tiene una invitación activa.');
 const result=eligibility(db,ref,match,slot);
 if(!result.ok) throw Error(result.reason);
 Object.assign(slot,{ref:refId,status:'pending',paid:false});
 return slot;
}
export function respond(db, refId, matchId, slotId, answer) {
 const match=db.matches.find(m=>m.id===matchId),slot=match?.slots.find(s=>s.id===slotId);
 if(!slot || slot.ref!==refId || slot.status!=='pending') throw Error('La invitación ya no está pendiente.');
 if(!['accepted','rejected'].includes(answer)) throw Error('Respuesta inválida.');
 if(answer==='accepted') { const result=eligibility(db,db.refs.find(r=>r.id===refId),match,slot); if(!result.ok) throw Error(result.reason); }
 slot.status=answer;
 return slot;
}
export function totals(db) {
 const slots=db.matches.flatMap(m=>m.slots).filter(s=>s.status==='accepted');
 return {receivable:db.matches.filter(m=>!m.collected).reduce((a,m)=>a+m.charge,0),payable:slots.filter(s=>!s.paid).reduce((a,s)=>a+s.fee,0),paid:slots.filter(s=>s.paid).reduce((a,s)=>a+s.fee,0)};
}
