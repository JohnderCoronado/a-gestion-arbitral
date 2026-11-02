// Update the original demo labels without resetting invitations, payments or custom records.
const labels = new Map([["Estadio Carlos Ugalde Álvarez, San Carlos", "Estadio Aurora · ubicación ficticia"], ["Plaza de deportes de Ciudad Quesada, San Carlos", "Cancha Cometa · ubicación ficticia"], ["Plaza de deportes de La Fortuna, San Carlos", "Complejo Prisma · ubicación ficticia"], ["Plaza de deportes de Florencia, San Carlos", "Cancha Estelar · ubicación ficticia"], ["Cancha de Santa Clara, San Carlos", "Estadio Centella · ubicación ficticia"], ["Cancha de Venecia, San Carlos", "Parque Deportivo Cedros · ubicación ficticia"], ["Asociación del Norte", "Asociación Horizonte"], ["Copa del Norte", "Copa Horizonte"], ["Deportivo Aguas Zarcas", "Atlético Eclipse"], ["Atlético Venecia", "Unión Cedros"], ["Juvenil San Carlos", "Juvenil Centella"], ["Academia Norte", "Academia Fénix"], ["Unión Quesada", "Deportivo Atlas"], ["San Martín", "Deportivo Aurora"], ["Pital FC", "Sporting Cometa"], ["Los Robles", "Titanes FC"], ["La Fortuna", "Deportivo Prisma"], ["Boca Arenal", "Atlético Olivos"], ["Florencia FC", "Unión Estelar"], ["Santa Rosa", "Halcones FC"]]);
export function migrateDemoLabels(db) {
 for (const t of db.tournaments) if (labels.has(t.name)) t.name=labels.get(t.name);
 for (const m of db.matches) {
  for (const field of ['home','away','venue']) if(labels.has(m[field])) m[field]=labels.get(m[field]);
  if(m.id==='m1' && m.lat===10.3233 && m.lng===-84.4307) {m.lat=null;m.lng=null;}
 }
 for (const event of db.events || []) for (const [oldName,newName] of labels) event.text=event.text.split(oldName).join(newName);
 return db;
}
