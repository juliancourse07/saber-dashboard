'use strict';
const seriesCache = new Map();
let chartVersion = 0;
function seriesFile(path) {
  if (!seriesCache.has(path)) seriesCache.set(path,json(path).catch(error => {
    seriesCache.delete(path); throw error;
  }));
  return seriesCache.get(path);
}
function svgNode(tag, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v));
  if (text != null) node.textContent = text;
  return node;
}
function drawTrend(years, lines) {
  const nums = lines.flatMap(l => l.values).filter(Number.isFinite);
  $('historyChart').replaceChildren(); $('legend').replaceChildren();
  $('historyHead').replaceChildren(); $('historyRows').replaceChildren();
  if (!nums.length) { $('historyChart').textContent = 'No hay puntajes para esta selección.'; return; }
  const width = Math.max(320, Math.min(900,$('historyChart').clientWidth)), height = 240;
  const lo = Math.floor((Math.min(...nums)-2)/5)*5, hi = Math.ceil((Math.max(...nums)+2)/5)*5;
  const x = i => 40+i*(width-68)/Math.max(1,years.length-1);
  const y = n => 18+(hi-n)*(height-52)/(hi-lo);
  const svg = svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Evolución de los puntajes promedio. Cifras disponibles en la tabla.'});
  for (let i=0;i<=4;i++) {
    const n = lo+(hi-lo)*i/4;
    svg.append(svgNode('line',{x1:40,x2:width-20,y1:y(n),y2:y(n),stroke:'#dae4dd'}),svgNode('text',{x:2,y:y(n)+4},fmt(n)));
  }
  const selected = years.indexOf(Number($('year').value));
  if (selected >= 0) svg.append(svgNode('line',{x1:x(selected),x2:x(selected),y1:14,y2:height-28,stroke:'#97a89d','stroke-dasharray':'3 4'}));
  years.forEach((year,i) => svg.append(svgNode('text',{x:x(i),y:height-6,'text-anchor':'middle'},year)));
  for (const line of lines) {
    let prev = null;
    line.values.forEach((v,i) => {
      if (!Number.isFinite(v)) { prev = null; return; }
      if (prev !== null) svg.append(svgNode('line',{x1:x(i-1),y1:y(prev),x2:x(i),y2:y(v),stroke:line.color,'stroke-width':3}));
      const dot = svgNode('circle',{cx:x(i),cy:y(v),r:4,fill:line.color});
      dot.append(svgNode('title',{},`${line.name} · ${years[i]}: ${fmt(v)}`)); svg.append(dot); prev = v;
    });
    const key = el('span',''), swatch = el('i',''); swatch.style.background = line.color;
    key.append(swatch,line.name); $('legend').append(key);
  }
  $('historyChart').append(svg);
  const head = el('tr',''); head.append(...['Año',...lines.map(l => l.name)].map(v => el('th',v))); $('historyHead').append(head);
  years.forEach((year,i) => {const row=el('tr','');row.append(el('th',year),...lines.map(l => el('td',fmt(l.values[i]))));$('historyRows').append(row);});
}
async function historical(ies, program, module, peer) {
  const ticket = ++chartVersion, dataset = manifest.exams[$('exam').value];
  const years = dataset.years.map(y => y.year).sort((a,b) => a-b);
  $('historyChart').textContent = 'Cargando trayectoria…';
  for (const id of ['legend','historyHead','historyRows']) $(id).replaceChildren();
  $('historyScope').textContent = `${years[0]}–${years.at(-1)} · ${program?.program || ies} · ${labels[module]}. Los años sin dato quedan sin unir.`;
  const files = name => Object.entries(dataset.series).filter(([n]) => n === name ||
    (homeNames.includes(norm(name)) && homeNames.includes(norm(n)))).map(([,path]) => seriesFile(path));
  try {
    const [mine, refs, peers] = await Promise.all([Promise.all(files(ies)),Promise.all(files('')),Promise.all(peer ? files(peer) : [])]);
    if (ticket !== chartVersion) return;
    const points = (data, match) => years.map(year => {
      const found = data.flat().filter(r => r.year === year && match(r));
      return found.length === 1 ? found[0].scores[module]?.[0] : null;
    });
    const sameProgram = r => r.kind === 'program' && (program.code ? r.code === program.code : norm(r.program) === norm(program.program)) && norm(r.campus) === norm(program.campus);
    const lines = [
      {name:program?'Mi programa':'Mi institución',color:'#067153',values:points(mine,r => program ? sameProgram(r) : r.kind === 'ies')},
      {name:'Colombia',color:'#3f66b1',values:points(refs,r => r.kind === 'country')}
    ];
    if (program?.nbc) lines.push({name:'Colombia · mismo NBC',color:'#92691c',values:points(refs,r => r.kind === 'field' && norm(r.nbc) === norm(program.nbc))});
    if (peer) lines.push({name:peer,color:'#984471',values:points(peers,r => program ? r.kind === 'peer' && r.nbc === program.nbc : r.kind === 'ies')});
    drawTrend(years,lines);
  } catch (err) { if (ticket === chartVersion) $('historyChart').textContent = `No se pudo cargar el histórico: ${err.message}. Vuelve a seleccionar el filtro para reintentar.`; }
}
