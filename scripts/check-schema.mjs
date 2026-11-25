// Verifica contra la API real que las consultas del dashboard funcionan y lista fuentes alternativas.
const D = 'https://www.datos.gov.co';
const sets = {pro: 'u37r-hjmu', tyt: 'iwgf-bkfk'};
let bad = 0;
for (const [k, id] of Object.entries(sets)) {
  const m = await (await fetch(`${D}/api/views/${id}.json`)).json();
  console.log(`\n== ${k} ${id} "${m.name}" actualizado ${new Date(m.rowsUpdatedAt * 1000).toISOString()}`);
  const mods = m.columns.map(c => c.fieldName).filter(c => /^mod_.*_punt$/.test(c));
  const sel = ['periodo as k', 'count(*) as n', ...mods.map(c => `avg(${c}::number) as a_${c}`)].join(',');
  const r = await fetch(`${D}/resource/${id}.json?` + new URLSearchParams({$select: sel, $group: 'k', $order: 'k'}));
  const t = await r.text();
  console.log(r.status, t.slice(0, 700), '...', t.slice(-400));
  if (!r.ok) bad++;
}
for (const q of ['saber pro', 'saber tyt', 'resultados saber']) {
  const c = await (await fetch(`${D}/api/catalog/v1?` + new URLSearchParams({q, only: 'datasets', limit: 15, domains: 'www.datos.gov.co'}))).json();
  console.log(`\n-- catálogo: ${q}`);
  for (const x of c.results || []) console.log(x.resource.id, '|', x.resource.name, '|', x.resource.updatedAt, '|', x.resource.columns_field_name?.length, 'cols');
}
process.exit(bad ? 1 : 0);
