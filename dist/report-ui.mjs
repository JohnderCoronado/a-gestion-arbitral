import {reportAccess, reportDraft, reportContext, reportChanged, reportStatus, saveReport, simulateReportDelivery} from './reports.mjs';
import {reportPDF} from './report-pdf.mjs';

export function createReportUI({getDB, getProfile, escapeHTML, openModal, persist, render, toast, icon}) {
  const esc = escapeHTML;
  const db = getDB;
  const profile = getProfile;
  let reviewed = null;
  const matchById = id => db().matches.find(match => match.id === id);
  const tournament = match => db().tournaments.find(item => item.id === match.tournament);
  const button = (label, action, id, style = 'secondary') => `<button type="button" class="btn ${style} small" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
  const date = value => new Date(value).toLocaleString('es-CR', {timeZone:'America/Costa_Rica'});
  const field = (label, name, value = '', attributes = '') => `<label class="field">${label}<input name="${name}" value="${esc(value)}" ${attributes}></label>`;

  function access(id, write = false) {
    const match = matchById(id);
    if (!reportAccess(match, profile())[write ? 'write' : 'read']) throw Error('Este perfil no tiene acceso a esa acción del informe.');
    return match;
  }

  function reportButton(match) {
    if (!reportAccess(match, profile()).read) return '';
    return button(`${icon('edit')}Informe arbitral`, 'open-report', match.id);
  }

  function page() {
    const matches = db().matches.filter(match => reportAccess(match, profile()).read && (!match.deletedAt || match.report));
    matches.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return `<div class="page-head"><div><div class="eyebrow">DESPUÉS DEL PARTIDO</div><h1>${profile().role === 'admin' ? 'Informes arbitrales' : 'Mis informes'}</h1><p>Complete el informe desde el nombramiento y prepare su entrega al campeonato.</p></div></div><div class="report-beta-note">${icon('info')}<span>En esta beta puede guardar el informe, descargar su PDF y simular la entrega. El correo se configura en cada torneo y el envío se registra como demostración.</span></div><section class="panel report-list">${matches.map(match => {
      const report = match.report;
      return `<article><div><span class="tournament-tag">${esc(tournament(match)?.name)}</span><h3>${esc(match.home)} vs ${esc(match.away)}</h3><p>${esc(match.date)} · ${esc(match.time)} · ${esc(match.venue)}</p><span class="badge ${report?.deliveries?.some(item => item.revision === report.revision) ? 'green' : 'gray'}">${esc(reportStatus(match))}</span>${match.deletedAt ? '<span class="badge red">Partido eliminado</span>' : ''}${report && reportChanged(db(), match) ? '<span class="badge amber">Revisar datos del partido</span>' : ''}</div>${reportButton(match)}</article>`;
    }).join('') || '<div class="empty"><h3>Aquí aparecerán sus informes</h3><p>Los nombramientos confirmados permiten consultar el informe. El central y el administrador pueden completarlo.</p></div>'}</section>`;
  }

  function contextCard(context) {
    return `<div class="report-context"><span class="tournament-tag">${esc(context.tournament)}</span><h3>${esc(context.home)} vs ${esc(context.away)}</h3><p>${esc(context.category)}<br>${esc(context.date)} · ${esc(context.time)} · ${esc(context.venue)}</p><small>${context.crew.map(slot => `${esc(slot.role)} · ${esc(slot.name)}`).join('<br>') || 'El cuerpo arbitral se completará al confirmar los nombramientos.'}</small></div>`;
  }

  function entryRow(kind, row, context) {
    const select = (name, options, value) => `<select name="${name}">${options.map(([key, label]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    return `<div class="report-entry" data-report-row="${kind}"><label class="field">Equipo${select('team', [['home', context.home], ['away', context.away]], row.team || 'home')}</label>${field(kind === 'cards' ? 'Jugador o integrante' : 'Jugador', 'person', row.person, 'maxlength="120" placeholder="Nombre completo" required')}${field('Dorsal (opcional)', 'number', row.number, 'maxlength="3" inputmode="numeric" pattern="[0-9]{1,3}"')}${field('Minuto (opcional)', 'minute', row.minute, 'maxlength="6" placeholder="Ej. 90+3"')}${kind === 'cards' ? `<label class="field">Tarjeta${select('type', [['yellow', 'Amarilla'], ['red', 'Roja directa'], ['second-yellow', 'Expulsión por doble amarilla']], row.type || 'yellow')}</label>${field('Motivo de la sanción', 'reason', row.reason, 'maxlength="500" required')}` : ''}${kind === 'penalties' ? `<label class="field">Resultado${select('outcome', [['goal', 'Gol'], ['missed', 'Fallado']], row.outcome || 'goal')}</label>` : ''}<button type="button" class="text-button report-remove" data-action="remove-report-row" aria-label="Quitar registro">${icon('trash')}Quitar</button></div>`;
  }

  function entrySection(kind, title, rows, context, hint = '') {
    return `<section class="report-section"><div class="report-section-head"><h3>${title}</h3><button type="button" class="text-button" data-action="add-report-row" data-kind="${kind}">${icon('plus')}Agregar</button></div>${hint ? `<p class="hint">${hint}</p>` : ''}<div id="report-${kind}">${rows.map(row => entryRow(kind, row, context)).join('')}</div></section>`;
  }

  function edit(id) {
    const match = access(id, true);
    const report = reportDraft(match);
    const context = reportContext(db(), match);
    const recipient = tournament(match)?.reportEmail;
    const description = (label, name, value, placeholder) => `<label class="field full">${label}<textarea name="${name}" rows="4" maxlength="12000" placeholder="${placeholder}">${esc(value)}</textarea></label>`;
    openModal('Completar informe arbitral', `<form id="report-form" data-id="${esc(id)}" data-revision="${report.revision}">${contextCard(context)}<p class="hint report-recipient">Correo del campeonato <strong>${esc(recipient || 'Pendiente de configurar por el administrador en Torneos')}</strong></p>${reportChanged(db(), match) ? '<p class="match-change-notice">El partido cambió desde el último borrador. Estos son los datos nuevos. Revise el informe antes de guardar.</p>' : ''}<section class="report-section"><h3>Resultado del partido</h3><div class="form-grid">${field(`Goles de ${esc(context.home)}`, 'homeScore', report.homeScore, 'type="number" min="0" max="99" step="1"')}${field(`Goles de ${esc(context.away)}`, 'awayScore', report.awayScore, 'type="number" min="0" max="99" step="1"')}${field('Delegado (opcional)', 'delegate', report.delegate, 'maxlength="120"')}${field('Fecha límite de entrega (opcional, Costa Rica)', 'deadline', report.deadline, 'type="datetime-local"')}</div></section>${entrySection('goals', 'Goleadores', report.goals, context, 'Puede dejar la lista vacía. Si la completa, registre todos los goles del marcador.')}${entrySection('cards', 'Amonestaciones y expulsiones', report.cards, context)}<section class="report-section"><h3>Relato del partido</h3><div class="form-grid">${description('Incidentes', 'incidents', report.incidents, 'Describa los incidentes ocurridos y las personas involucradas, si hubo alguno.')}${description('Observaciones', 'observations', report.observations, 'Agregue información complementaria del partido.')}</div></section>${entrySection('penalties', 'Penales durante el partido', report.penalties, context, 'Registre el resultado de cada penal. Los goles también forman parte del marcador y de la lista de goleadores, si la completa.')}<p id="modal-error" class="form-error" role="alert"></p><p class="hint">Guarde el borrador para conservar los datos en este navegador.</p><div class="modal-foot"><button type="button" class="btn secondary" data-action="close">Cerrar</button><button type="submit" class="btn secondary" name="intent" value="save">Guardar borrador</button><button type="submit" class="btn primary" name="intent" value="review">Guardar y revisar</button></div></form>`);
  }

  function reportBody(report) {
    const context = report.context;
    const team = row => row.team === 'home' ? context.home : context.away;
    const person = row => `${row.number ? '#' + row.number + ' ' : ''}${row.person} · ${team(row)}${row.minute ? ' · Min. ' + row.minute : ''}`;
    const rows = (title, items, format) => `<section class="report-section"><h3>${title}</h3>${items.length ? `<ol class="report-records">${items.map(row => `<li>${esc(format(row))}</li>`).join('')}</ol>` : '<p class="hint">Sin registros.</p>'}</section>`;
    return `${contextCard(context)}<div class="report-score">${esc(context.home)} <b>${esc(report.homeScore === '' ? '—' : report.homeScore)} – ${esc(report.awayScore === '' ? '—' : report.awayScore)}</b> ${esc(context.away)}</div><p class="hint">Delegado ${esc(report.delegate || 'Sin registrar')}${report.deadline ? `<br>Fecha límite ${esc(report.deadline.replace('T', ' '))} · Costa Rica` : ''}<br>Versión ${report.revision} · ${esc(report.updatedBy)} · ${esc(date(report.updatedAt))}</p>${rows('Goleadores', report.goals, person)}${rows('Amonestaciones y expulsiones', report.cards, row => `${({'yellow':'Amarilla','red':'Roja directa','second-yellow':'Expulsión por doble amarilla'})[row.type]} · ${person(row)} · ${row.reason}`)}<section class="report-section"><h3>Incidentes</h3><p class="report-prose">${esc(report.incidents || 'Sin incidentes registrados.')}</p></section><section class="report-section"><h3>Observaciones</h3><p class="report-prose">${esc(report.observations || 'Sin observaciones.')}</p></section>${rows('Penales durante el partido', report.penalties, row => `${person(row)} · ${row.outcome === 'goal' ? 'Gol' : 'Fallado'}`)}`;
  }

  function show(id, deliveryIndex = null) {
    const match = access(id);
    if (!match.report) {
      if (reportAccess(match, profile()).write) return edit(id);
      openModal('Informe arbitral', `${contextCard(reportContext(db(), match))}<p class="hint">El central o el administrador todavía no han registrado un informe.</p><div class="modal-foot">${button('Cerrar', 'close', id)}</div>`);
      return;
    }
    const delivery = deliveryIndex === null ? null : match.report.deliveries[deliveryIndex];
    if (deliveryIndex !== null && !delivery) throw Error('No se encontró esa copia del informe.');
    const report = delivery?.snapshot || match.report;
    const canWrite = deliveryIndex === null && reportAccess(match, profile()).write;
    reviewed = {id, revision: report.revision, recipient: tournament(match)?.reportEmail || ''};
    const deliveries = match.report.deliveries || [];
    openModal(delivery ? 'Copia de entrega simulada' : 'Revisar informe arbitral', `${delivery ? `<div class="report-beta-note">Entrega simulada a ${esc(delivery.recipient)} · ${esc(date(delivery.at))}</div>` : `<div class="report-beta-note">${icon('mail')}<span>Destinatario del campeonato <strong>${esc(tournament(match)?.reportEmail || 'Pendiente de configurar en Torneos')}</strong><br>La entrega es una simulación guardada en este navegador.</span></div>`}${!delivery && reportChanged(db(), match) ? '<p class="match-change-notice">El partido cambió. Abra Editar, revise los datos nuevos y guarde el informe antes de simular su entrega.</p>' : ''}${reportBody(report)}<p id="modal-error" class="form-error" role="alert"></p><div class="report-controls">${canWrite ? button(`${icon('edit')}Editar`, 'edit-report', id) : ''}<button class="btn secondary small" type="button" data-action="download-report" data-id="${esc(id)}" ${delivery ? `data-delivery="${deliveryIndex}"` : ''}>${icon('download')}Descargar PDF</button>${canWrite ? button(`${icon('mail')}Simular entrega`, 'simulate-report', id, 'primary') : ''}${delivery ? button('Volver al informe actual', 'open-report', id) : ''}</div>${deliveries.length && !delivery ? `<section class="report-section"><h3>Historial de entregas simuladas</h3><div class="report-deliveries">${deliveries.map((item, index) => `<div><p><strong>Versión ${item.revision}</strong> · ${esc(item.recipient)}<small>${esc(date(item.at))}</small></p><button type="button" class="text-button" data-action="view-report-delivery" data-id="${esc(id)}" data-delivery="${index}">Ver copia</button></div>`).join('')}</div></section>` : ''}`);
  }

  function download(id, deliveryIndex = null) {
    const match = access(id);
    if (!match.report) throw Error('Guarde el informe antes de descargarlo.');
    const delivery = deliveryIndex === null ? null : match.report.deliveries[deliveryIndex];
    if (deliveryIndex !== null && !delivery) throw Error('No se encontró esa copia.');
    const report = delivery?.snapshot || match.report;
    const url = URL.createObjectURL(new Blob([reportPDF(report, {delivery})], {type:'application/pdf'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `A-informe-${report.context.date}-v${report.revision}${delivery ? '-entrega-simulada' : '-borrador'}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('PDF descargado.');
  }

  function handleAction(action, id, element) {
    switch (action) {
      case 'open-report': show(id); return true;
      case 'edit-report': edit(id); return true;
      case 'view-report-delivery': show(id, Number(element.dataset.delivery)); return true;
      case 'download-report': download(id, element.dataset.delivery === undefined ? null : Number(element.dataset.delivery)); return true;
      case 'add-report-row': {
        const form = document.querySelector('#report-form');
        const match = access(form?.dataset.id, true);
        const kind = element.dataset.kind;
        if (!['goals', 'cards', 'penalties'].includes(kind)) throw Error('Registro no válido.');
        const target = document.querySelector(`#report-${kind}`);
        if (target.children.length >= 100) throw Error('Cada lista admite hasta 100 registros.');
        target.insertAdjacentHTML('beforeend', entryRow(kind, {}, reportContext(db(), match)));
        target.lastElementChild.querySelector('[name="person"]').focus();
        return true;
      }
      case 'remove-report-row': element.closest('[data-report-row]').remove(); return true;
      case 'simulate-report': {
        const match = access(id, true);
        if (!reviewed || reviewed.id !== id || reviewed.recipient !== (tournament(match)?.reportEmail || '')) throw Error('El destinatario cambió. Abra de nuevo el informe y revíselo.');
        const delivery = simulateReportDelivery(db(), id, reviewed.revision, profile());
        if (!persist()) {
          match.report.deliveries.pop();
          throw Error('No se pudo guardar la entrega simulada. Descargue el PDF o libere espacio del navegador antes de intentarlo de nuevo.');
        }
        render();
        show(id, match.report.deliveries.indexOf(delivery));
        toast('Entrega simulada registrada. El correo no se ha enviado.');
        return true;
      }
      default: return false;
    }
  }

  function handleSubmit(form, data, submitter) {
    if (form.id !== 'report-form') return false;
    const draft = {revision: Number(form.dataset.revision)};
    for (const name of ['homeScore', 'awayScore', 'delegate', 'deadline', 'incidents', 'observations']) draft[name] = String(data.get(name) || '').trim();
    for (const kind of ['goals', 'cards', 'penalties']) {
      draft[kind] = Array.from(form.querySelectorAll(`[data-report-row="${kind}"]`), row => Object.fromEntries(Array.from(row.querySelectorAll('input,select'), input => [input.name, input.value.trim()])));
    }
    const match = access(form.dataset.id, true);
    const previous = match.report;
    saveReport(db(), match.id, draft, profile());
    if (!persist()) {
      match.report = previous;
      throw Error('No se pudo guardar el informe. Mantenga abierto este formulario e intente de nuevo después de liberar espacio del navegador.');
    }
    render();
    if (submitter?.value === 'review') show(match.id);
    else {
      form.dataset.revision = match.report.revision;
      document.querySelector('#modal-error').textContent = '';
    }
    toast('Borrador guardado.');
    return true;
  }

  return {button: reportButton, page, handleAction, handleSubmit};
}
