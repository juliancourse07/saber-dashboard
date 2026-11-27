'use strict';
const $ = id => document.getElementById(id);
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const homeNames = ['institucion universitaria del putumayo', 'instituto tecnologico del putumayo', 'uniputumayo'];
const labels = {global:'Global', 'lectura critica':'Lectura crítica', ingles:'Inglés', 'comunicacion escrita':'Comunicación escrita', 'competencias ciudadanas':'Competencias ciudadanas', 'razonamiento cuantitativo':'Razonamiento cuantitativo'};
const fmt = n => Number.isFinite(n) ? n.toLocaleString('es-CO',{maximumFractionDigits:1}) : 'Sin dato';
let manifest, rows = [], programs = [], version = 0;
function el(tag, value) { const e = document.createElement(tag); e.textContent = value; return e; }
function options(id, entries, preferred) {
  $(id).replaceChildren(...entries.map(([value,text]) => new Option(text,value)));
  if (entries.some(([key]) => key === preferred)) $(id).value = preferred;
}
function category(name) {
  const key = norm(name);
  if (manifest.categories[key]) return manifest.categories[key];
  if (homeNames.includes(key)) {
    const matches = [...new Set(homeNames.map(alias => manifest.categories[alias]).filter(Boolean))];
    if (matches.length === 1) return matches[0];
  }
}
function compare() {
  const ies = $('ies').value, module = $('module').value, cat = category(ies);
  const program = $('program').value === '' ? null : programs[Number($('program').value)];
  const mine = program || rows.find(r => r.kind === 'ies' && r.ies === ies);
  const val = r => r?.scores[module] || [null,null];
  const [score, count] = val(mine);
  const country = rows.find(r => r.kind === 'country');
  const field = program?.nbc ? rows.find(r => r.kind === 'field' && r.nbc === program.nbc) : null;
  const gap = r => Number.isFinite(score) && Number.isFinite(val(r)[0]) ? score - val(r)[0] : null;
  const signed = n => Number.isFinite(n) && n > 0 ? '+' + fmt(n) : fmt(n);
  const tableRow = (name,r) => {
    const tr = document.createElement('tr');
    tr.append(...[name,fmt(val(r)[0]),fmt(val(r)[1]),signed(gap(r))].map(v => el('td',v)));
    return tr;
  };
  $('cards').replaceChildren(...[['Mi puntaje',fmt(score)],['Mis evaluados',fmt(count)],['Brecha frente al país',signed(gap(country))]].map(([title,value]) => {
    const card = el('div',''), b = el('strong', value); card.className='kpi'; b.className='big'; card.append(el('small',title), b); return card;
  }));
  $('scope').textContent = `${ies} · ${program?.program || 'Toda la institución'} · ${$('year').value} · ${labels[module] || 'Sin puntaje'}.`;
  $('refs').replaceChildren(tableRow('Colombia · todos los programas',country));
  if (program) $('refs').append(tableRow(`Colombia · ${program.nbc || 'área no identificada'} (NBC)`,field));
  const matches = rows.filter(r => r.ies !== ies && cat && category(r.ies) === cat &&
    (program ? program.nbc && r.kind === 'peer' && r.nbc === program.nbc : r.kind === 'ies') && Number.isFinite(val(r)[0]))
    .sort((a,b) => val(b)[0]-val(a)[0] || a.ies.localeCompare(b.ies));
  options('peer',[['','Todas las IES comparables'],...matches.map(r => [r.ies,r.ies])],$('peer').value);
  $('peer').disabled = !matches.length;
  $('category').textContent = cat ? `Carácter académico: ${cat}. ${program ? 'Se compara tu programa con el mismo núcleo básico del conocimiento (NBC) en cada IES, no con un programa de nombre idéntico.' : 'Se usa el puntaje institucional de cada IES.'}` :
    'No se encontró una categoría inequívoca para esta institución en el directorio del MEN. No se asignan pares por similitud de nombre.';
  $('peers').replaceChildren(...matches.filter(r => !$('peer').value || r.ies === $('peer').value).map(r => tableRow(r.ies,r)));
  $('peerNote').textContent = matches.length ? `${matches.length} IES con categoría y puntaje disponibles. La institución seleccionada no se incluye entre sus pares.` : 'No hay IES comparables con estos filtros.';
}
function institution() {
  const ies = $('ies').value;
  programs = rows.filter(r => r.kind === 'program' && r.ies === ies).sort((a,b) => a.program.localeCompare(b.program));
  options('program',[['','Toda la institución'],...programs.map((r,i) => [String(i),[r.program,r.campus,r.code].filter(Boolean).join(' · ')])],'');
  $('program').disabled = !programs.length;
  $('analysis').hidden = !ies;
  if (ies) { $('status').textContent = `${programs.length} opciones de programa y sede publicadas en este corte. Fuente revisada el ${new Date(manifest.checkedAt).toLocaleDateString('es-CO')}.`; compare(); }
  else $('status').textContent = 'Uniputumayo no figura en este corte. Selecciona otra institución o cambia de año.';
}
async function json(file) {
  const response = await fetch(file,{cache:'no-cache'});
  if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
  return response.json();
}
function fail(e) {
  $('analysis').hidden = true; $('retry').hidden = false;
  $('status').textContent = `No se pudieron cargar los datos: ${e.message}`;
}
async function period() {
  const v = ++version, exam = $('exam').value, year = $('year').value, prior = $('ies').value;
  $('analysis').hidden = true; $('retry').hidden = true; $('status').textContent = 'Cargando el año seleccionado…';
  for (const id of ['ies','program','module']) { $(id).disabled = true; $(id).replaceChildren(); }
  $('book').href = manifest.exams[exam].years.find(y => String(y.year) === year).url;
  try {
    const result = await json(`comparar-${exam}-${year}.json`);
    if (v !== version) return;
    rows = result;
    const names = [...new Set(rows.filter(r => ['ies','program'].includes(r.kind)).map(r => r.ies))].sort();
    const home = homeNames.map(alias => names.find(n => norm(n) === alias)).find(Boolean);
    options('ies',[['','Seleccionar una institución'],...names.map(n => [n,n])],names.includes(prior) ? prior : home || '');
    options('module',Object.entries(labels).filter(([key]) => rows.some(r => r.scores[key])), 'global');
    $('module').disabled = false; $('ies').disabled = false; institution();
  } catch (e) { if (v === version) fail(e); }
}
function examChange() {
  if (!manifest) return;
  options('year',manifest.exams[$('exam').value].years.map(y => [String(y.year),String(y.year)]),$('year').value);
  period();
}
async function init() {
  try { manifest = await json('annual.json'); examChange(); } catch (e) { fail(e); }
}
$('exam').onchange = examChange; $('year').onchange = period; $('ies').onchange = institution;
for (const id of ['program','module','peer']) $(id).onchange = compare;
$('retry').onclick = () => manifest ? period() : init();
init();
