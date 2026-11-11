const text = value => String(value ?? '').trim();
const fail = message => { throw new Error(message); };

export function reportContext(db, match) {
  const tournament = db.tournaments.find(item => item.id === match.tournament);
  return {
    tournament: tournament?.name || '',
    category: tournament?.category || '',
    home: match.home,
    away: match.away,
    date: match.date,
    time: match.time,
    venue: match.venue,
    crew: match.slots.filter(slot => slot.status === 'accepted').map(slot => ({
      role: slot.role,
      name: db.refs.find(ref => ref.id === slot.ref)?.name || 'Sin nombre'
    }))
  };
}

export function reportAccess(match, profile) {
  if (!match) return {read: false, write: false};
  if (profile.role === 'admin') return {read: true, write: !match.deletedAt};
  const accepted = match.slots.filter(slot => slot.ref === profile.refId && slot.status === 'accepted');
  const author = match.report?.authorId === profile.refId;
  return {
    read: author || (!match.deletedAt && accepted.length > 0),
    write: !match.deletedAt && accepted.some(slot => slot.role === 'Central')
  };
}

export function reportDraft(match) {
  return structuredClone(match.report || {
    revision: 0,
    homeScore: '',
    awayScore: '',
    delegate: '',
    deadline: '',
    goals: [],
    cards: [],
    penalties: [],
    incidents: '',
    observations: '',
    deliveries: []
  });
}

export function validateReport(draft, complete = false) {
  for (const field of ['homeScore', 'awayScore']) {
    const value = draft[field];
    if (value === '' || value === undefined) {
      if (complete) fail('Complete el marcador de ambos equipos.');
    } else if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 99) {
      fail('Cada marcador debe ser un número entero entre 0 y 99.');
    }
  }
  for (const field of ['incidents', 'observations']) {
    if (text(draft[field]).length > 12000) fail('Cada descripción admite hasta 12 000 caracteres.');
  }
  if (text(draft.delegate).length > 120) fail('Revise el nombre del delegado.');
  if (draft.deadline && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.deadline) || Number.isNaN(Date.parse(draft.deadline)))) {
    fail('Revise la fecha límite de entrega.');
  }
  for (const kind of ['goals', 'cards', 'penalties']) {
    if (!Array.isArray(draft[kind]) || draft[kind].length > 100) fail('Cada lista admite hasta 100 registros.');
    for (const row of draft[kind]) {
      if (!['home', 'away'].includes(row.team)) fail('Seleccione el equipo de cada registro.');
      if (!text(row.person) || text(row.person).length > 120) fail('Ingrese el nombre del jugador o integrante en cada registro.');
      if (text(row.number) && !/^\d{1,3}$/.test(text(row.number))) fail('El dorsal admite hasta tres dígitos.');
      if (text(row.minute) && !/^\d{1,3}(?:\+\d{1,2})?$/.test(text(row.minute))) fail('Use minutos como 32 o 90+3. También puede dejarlos vacíos.');
      if (kind === 'cards' && (!['yellow', 'red', 'second-yellow'].includes(row.type) || !text(row.reason) || text(row.reason).length > 500)) {
        fail('Indique el tipo de tarjeta y el motivo de cada sanción.');
      }
      if (kind === 'penalties' && !['goal', 'missed'].includes(row.outcome)) fail('Indique el resultado de cada penal.');
    }
  }
  if (complete && draft.goals.length) {
    for (const [team, field] of [['home', 'homeScore'], ['away', 'awayScore']]) {
      if (draft.goals.filter(row => row.team === team).length !== Number(draft[field])) {
        fail('La lista de goleadores debe coincidir con el marcador. Complete todos los goles o deje la lista vacía.');
      }
    }
  }
  return draft;
}

export function saveReport(db, matchId, draft, profile, now = new Date().toISOString()) {
  const match = db.matches.find(item => item.id === matchId);
  if (!reportAccess(match, profile).write) fail('Solo el administrador o el central confirmado pueden editar este informe.');
  if (Number(draft.revision) !== (match.report?.revision || 0)) fail('El informe cambió desde que lo abrió. Ábralo de nuevo para revisar la versión guardada.');
  validateReport(draft);
  const previous = match.report;
  match.report = {
    revision: (previous?.revision || 0) + 1,
    homeScore: draft.homeScore === '' ? '' : Number(draft.homeScore),
    awayScore: draft.awayScore === '' ? '' : Number(draft.awayScore),
    delegate: text(draft.delegate),
    deadline: text(draft.deadline),
    goals: structuredClone(draft.goals),
    cards: structuredClone(draft.cards),
    penalties: structuredClone(draft.penalties),
    incidents: text(draft.incidents),
    observations: text(draft.observations),
    authorId: previous?.authorId || (profile.role === 'ref' ? profile.refId : 'admin'),
    updatedBy: profile.role === 'admin' ? 'Administrador' : db.refs.find(ref => ref.id === profile.refId)?.name || '',
    updatedAt: now,
    context: reportContext(db, match),
    deliveries: previous?.deliveries || []
  };
  return match.report;
}

export function validReportEmail(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text(value)) && text(value).length <= 160;
}

export function reportChanged(db, match) {
  return Boolean(match.report && JSON.stringify(match.report.context) !== JSON.stringify(reportContext(db, match)));
}

export function simulateReportDelivery(db, matchId, revision, profile, now = new Date().toISOString()) {
  const match = db.matches.find(item => item.id === matchId);
  if (!reportAccess(match, profile).write) fail('Solo el administrador o el central confirmado pueden simular la entrega.');
  const report = match.report;
  if (!report || report.revision !== revision) fail('Revise la versión actual del informe antes de continuar.');
  validateReport(report, true);
  if (reportChanged(db, match)) fail('Cambió la programación del partido. Abra el informe, revise los datos nuevos y guárdelo antes de continuar.');
  const recipient = db.tournaments.find(item => item.id === match.tournament)?.reportEmail;
  if (!validReportEmail(recipient)) fail('El administrador debe registrar un correo de informes válido en el torneo.');
  if (report.deliveries.some(item => item.revision === revision && item.recipient === recipient)) {
    fail('Ya se registró una entrega simulada de esta versión a ese correo.');
  }
  const {deliveries, ...snapshot} = report;
  const delivery = {revision, recipient, at: now, simulated: true, snapshot: structuredClone(snapshot)};
  deliveries.push(delivery);
  return delivery;
}

export function reportStatus(match) {
  if (!match.report) return 'Sin iniciar';
  if (match.report.deliveries?.some(item => item.revision === match.report.revision)) return 'Entrega simulada';
  return match.report.deliveries?.length ? 'Borrador actualizado' : 'Borrador';
}
