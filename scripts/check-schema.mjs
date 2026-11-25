// Verifica contra la API real que las columnas y consultas del dashboard funcionan.
const D = 'https://www.datos.gov.co';
const sets = {pro: 'u37r-hjmu', tyt: 'iwgf-bkfk'};
let bad = 0;
for (const [k, id] of Object.entries(sets)) {
  const m = await (await fetch(`${D}/api/views/${id}.json`)).json();
  console.log(`\n== ${k} ${id} "${m.name}" actualizado ${new Date(m.rowsUpdatedAt * 1000).toISOString()}`);
  for (const c of m.columns) console.log(`  ${c.fieldName}\t${c.dataTypeName}`);
  const cols = Object.fromEntries(m.columns.map(c => [c.fieldName, c.dataTypeName]));
  const g = ['punt_global', 'mod_punt_global'].find(c => c in cols);
  if (!g) { console.log('!! sin columna de puntaje global'); bad++; continue; }
  const n = cols[g] === 'number' ? g : `${g}::number`;
  const u = `${D}/resource/${id}.json?` + new URLSearchParams({$select: `periodo as k,count(*) as n,avg(${n}) as g`, $group: 'k', $order: 'k'});
  const r = await fetch(u);
  console.log(r.status, (await r.text()).slice(0, 600));
  if (!r.ok) bad++;
}
process.exit(bad ? 1 : 0);
