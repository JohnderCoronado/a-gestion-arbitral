import assert from 'node:assert/strict';
import {reportAccess, reportDraft, reportChanged, saveReport, simulateReportDelivery, reportStatus, validateReport} from './dist/reports.mjs';
import {reportPDF} from './dist/report-pdf.mjs';

const admin = {role:'admin'};
const central = {role:'ref', refId:'central'};
const assistant = {role:'ref', refId:'assistant'};
const other = {role:'ref', refId:'other'};
const db = {
  refs:[{id:'central',name:'María Méndez'},{id:'assistant',name:'Andrés Pérez'}],
  tournaments:[{id:'t1',name:'Copa Horizonte',category:'Libre',reportEmail:'informes@ejemplo.invalid'}],
  matches:[{id:'m1',tournament:'t1',home:'Aurora',away:'Eclipse',date:'2026-11-14',time:'09:00',venue:'Cancha ficticia',slots:[{role:'Central',ref:'central',status:'accepted'},{role:'Asistente 1',ref:'assistant',status:'accepted'}]}]
};
let checks = 0;
function check(label, run) { run(); checks++; console.log('OK ' + label); }
const match = db.matches[0];
check('Administración y central confirmado pueden editar', () => {
  assert.equal(reportAccess(match, admin).write, true);
  assert.equal(reportAccess(match, central).write, true);
});
check('Asistente consulta y otros perfiles carecen de acceso', () => {
  assert.deepEqual(reportAccess(match, assistant), {read:true,write:false});
  assert.deepEqual(reportAccess(match, other), {read:false,write:false});
});
const draft = reportDraft(match);
check('El borrador inicial permite resultado incompleto', () => validateReport(draft));
check('Una entrega requiere el resultado', () => assert.throws(() => validateReport(draft,true), /marcador/));
Object.assign(draft, {homeScore:1,awayScore:0,incidents:'Ingreso al terreno de juego.',observations:'Partido finalizado.',goals:[{team:'home',person:'Sofía Solís',number:'10',minute:'90+3'}]});
check('El informe guarda resultado y contexto del partido', () => {
  saveReport(db,'m1',draft,central,'2026-11-14T18:00:00Z');
  assert.equal(match.report.revision,1);
  assert.equal(match.report.context.crew[0].name,'María Méndez');
  assert.equal(match.report.incidents,draft.incidents);
});
check('Un formulario anterior no sobrescribe cambios', () => assert.throws(() => saveReport(db,'m1',draft,central), /cambió/));
check('Un asistente no puede guardar ni simular entregas', () => {
  assert.throws(() => saveReport(db,'m1',reportDraft(match),assistant), /central/);
  assert.throws(() => simulateReportDelivery(db,'m1',1,assistant), /central/);
});
check('El marcador y la lista completa de goles deben coincidir', () => assert.throws(() => validateReport({...match.report,homeScore:2},true), /goleadores/));
check('Valida sanciones, minutos y marcadores', () => {
  assert.throws(() => validateReport({...match.report,homeScore:-1}), /marcador/);
  assert.throws(() => validateReport({...match.report,goals:[{...draft.goals[0],minute:'ayer'}]}), /minutos/);
  assert.throws(() => validateReport({...match.report,cards:[{team:'home',person:'DT',type:'red',reason:''}]}), /motivo/);
});
check('Se exige un correo de torneo válido', () => {
  db.tournaments[0].reportEmail='';
  assert.throws(() => simulateReportDelivery(db,'m1',1,central), /correo/);
  db.tournaments[0].reportEmail='informes@ejemplo.invalid';
});
check('La entrega conserva destinatario y copia de esa versión', () => {
  const delivery=simulateReportDelivery(db,'m1',1,central);
  assert.equal(delivery.recipient,'informes@ejemplo.invalid');
  assert.equal(delivery.simulated,true);
  assert.equal(delivery.snapshot.homeScore,1);
  assert.equal(reportStatus(match),'Entrega simulada');
});
check('Repetir una entrega no duplica el registro', () => assert.throws(() => simulateReportDelivery(db,'m1',1,central), /Ya se registró/));
check('Una edición conserva la entrega anterior', () => {
  const next=reportDraft(match);
  next.observations='Observación corregida.';
  saveReport(db,'m1',next,admin);
  assert.equal(match.report.deliveries[0].snapshot.observations,'Partido finalizado.');
  assert.equal(reportStatus(match),'Borrador actualizado');
});
check('Una reprogramación exige revisar datos nuevos', () => {
  match.date='2026-11-15';
  assert.equal(reportChanged(db,match),true);
  assert.throws(() => simulateReportDelivery(db,'m1',2,admin), /programación/);
  saveReport(db,'m1',reportDraft(match),admin);
  assert.equal(reportChanged(db,match),false);
});
check('Se preserva el informe al eliminar un partido', () => {
  match.deletedAt='2026-11-15';
  assert.equal(reportAccess(match,admin).read,true);
  assert.equal(reportAccess(match,central).read,true);
  assert.equal(reportAccess(match,central).write,false);
  assert.throws(() => saveReport(db,'m1',reportDraft(match),admin), /central/);
  delete match.deletedAt;
});
check('Central sustituido conserva consulta de su informe', () => {
  match.slots[0].status='pending';
  assert.deepEqual(reportAccess(match,central),{read:true,write:false});
  match.slots[0].status='accepted';
});
check('Exporta un PDF y pagina relatos extensos sin omitirlos', () => {
  const pdf=reportPDF({...match.report,incidents:'INCIDENTE '.repeat(1500)+'FINDELRELATO'});
  const source=Buffer.from(pdf).toString('latin1');
  assert.ok(source.startsWith('%PDF-1.4'));
  assert.ok(source.includes('FINDELRELATO'));
  assert.ok(Number(/\/Count (\d+)/.exec(source)[1])>2);
  assert.ok(source.includes('María Méndez'));
  assert.ok(source.includes('%%EOF'));
});
console.log(`${checks} report checks passed.`);
