// Small text-only PDF exporter. Standard Helvetica and WinAnsi keep it self-contained.
const winAnsi = {'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
const latin = value => Array.from(String(value ?? '').normalize('NFC'), char => {
  const code = char.codePointAt(0);
  if (code === 10) return '\n';
  if (code === 13 || code < 32) return ' ';
  return String.fromCharCode(code <= 255 ? code : winAnsi[char] || 63);
}).join('');
const literal = value => latin(value).replace(/[\\()]/g, char => '\\' + char);
const teamName = (context, team) => team === 'home' ? context.home : context.away;

export function reportPDF(report, options = {}) {
  const context = report.context;
  const pages = [];
  let content = '', y = 0;
  function page() {
    if (content) pages.push(content);
    content = '0.14 0.19 0.28 rg\nBT /F2 18 Tf 42 798 Td (A) Tj ET\n';
    content += 'BT /F1 9 Tf 65 800 Td (INFORME ARBITRAL) Tj ET\n';
    content += `0.36 0.41 0.48 rg\nBT /F1 8 Tf 42 24 Td (${literal('A - Beta de demostración | Página ' + (pages.length + 1))}) Tj ET\n`;
    y = 770;
  }
  function line(value, bold = false, size = 10) {
    if (y < 55) page();
    content += `0.14 0.19 0.28 rg\nBT /${bold ? 'F2' : 'F1'} ${size} Tf 42 ${y} Td (${literal(value)}) Tj ET\n`;
    y -= size + 6;
  }
  function paragraph(value, bold = false) {
    // A conservative character width also fits uninterrupted names and pasted URLs.
    const maxWidth = 505;
    for (const paragraph of String(value ?? '').split(/\r?\n/)) {
      let remainder = paragraph;
      if (!remainder) line('');
      while (remainder.length) {
        let end = 0, width = 0;
        while (end < remainder.length && width < maxWidth - 10) {
          const char = remainder[end];
          const units = /[MW@%]/.test(char) ? 1000 : /[A-ZÁÉÍÓÚÑ]/.test(char) ? 800 : /[il.,'! :;]/.test(char) ? 300 : 650;
          width += units / 100;
          end++;
        }
        if (end < remainder.length) {
          const space = remainder.lastIndexOf(' ', end);
          if (space > end / 2) end = space;
        }
        line(remainder.slice(0, end), bold);
        remainder = remainder.slice(end).trimStart();
      }
    }
  }
  function section(title) {
    if (y < 100) page();
    y -= 12;
    content += `0.93 0.95 0.98 rg 42 ${y - 5} 511 22 re f\n`;
    line(title, true, 10);
    y -= 5;
  }
  function entries(title, rows, format) {
    section(title);
    if (!rows.length) paragraph('Sin registros.');
    rows.forEach((row, index) => paragraph(`${index + 1}. ${format(row)}`));
  }
  page();
  line(options.delivery ? 'COPIA DE ENTREGA SIMULADA' : 'BORRADOR', true, 14);
  paragraph('Documento de demostración. La entrega por correo se simula en esta beta.');
  paragraph(`Versión ${report.revision} | Guardado por ${report.updatedBy}`);
  paragraph(`Actualizado ${new Date(report.updatedAt).toLocaleString('es-CR', {timeZone:'America/Costa_Rica'})}`);
  if (options.delivery) {
    paragraph(`Destinatario de la simulación ${options.delivery.recipient}`);
    paragraph(`Registro ${new Date(options.delivery.at).toLocaleString('es-CR', {timeZone:'America/Costa_Rica'})}`);
  }
  section('CAMPEONATO Y PARTIDO');
  paragraph(context.tournament, true);
  paragraph(context.category);
  paragraph(`${context.date} | ${context.time} | ${context.venue}`);
  paragraph(`${context.home}  ${report.homeScore === '' ? '-' : report.homeScore} - ${report.awayScore === '' ? '-' : report.awayScore}  ${context.away}`, true);
  paragraph(`Delegado ${report.delegate || 'Sin registrar'}`);
  if (report.deadline) paragraph(`Fecha límite ${report.deadline.replace('T', ' ')} (Costa Rica)`);
  section('CUERPO ARBITRAL');
  if (!context.crew.length) paragraph('Sin árbitros confirmados.');
  context.crew.forEach(slot => paragraph(`${slot.role} - ${slot.name}`));
  const person = row => `${row.number ? '#' + row.number + ' ' : ''}${row.person} | ${teamName(context, row.team)}${row.minute ? ' | Min. ' + row.minute : ''}`;
  entries('GOLEADORES', report.goals, person);
  entries('AMONESTACIONES Y EXPULSIONES', report.cards, row => `${({'yellow':'Amarilla','red':'Roja directa','second-yellow':'Expulsión por doble amarilla'})[row.type]} | ${person(row)} | ${row.reason}`);
  section('INCIDENTES');
  paragraph(report.incidents || 'Sin incidentes registrados.');
  section('OBSERVACIONES');
  paragraph(report.observations || 'Sin observaciones.');
  entries('PENALES DURANTE EL PARTIDO', report.penalties, row => `${person(row)} | ${row.outcome === 'goal' ? 'Gol' : 'Fallado'}`);
  pages.push(content);
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const pageIds = [];
  for (const stream of pages) {
    const id = objects.length;
    pageIds.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets.push(pdf.length);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Uint8Array(Array.from(pdf, char => char.charCodeAt(0)));
}
