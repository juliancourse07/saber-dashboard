import {execSync} from 'node:child_process';
execSync('npm i --no-save --silent xlsx@0.18.5 2>&1 || true',{stdio:'inherit',cwd:process.cwd()});
const XLSX=(await import('xlsx')).default;
const H={'user-agent':'Mozilla/5.0'};
const root='https://www.icfes.gov.co';
// localizar página TyT
for (const u of [root+'/evaluaciones-icfes/acerca-del-examen-saber-tyt/',root+'/evaluaciones-icfes/acerca-del-examen-saber-tyt/resultados-del-examen-saber-tyt/',root+'/evaluaciones-icfes/acerca-del-examen-saber-tyt/resultados-saber-tyt/',root+'/evaluaciones-icfes/acerca-del-examen-saber-pro/']) {
  const r=await fetch(u,{headers:H}); console.log('##',u,r.status);
  if(!r.ok)continue; const t=await r.text();
  const seen=new Set();
  for (const m of t.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const tx=m[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    if(/tyt|t&t|tecnic|tecnol/i.test(m[1]+tx)&&/resultado|agregad|base/i.test(m[1]+tx)&&!seen.has(m[1])){seen.add(m[1]);console.log(' ',tx.slice(0,70),'->',m[1]);}
  }
}
for (const u of ['https://www.icfes.gov.co/wp-content/uploads/2026/05/2026-05-11-base-de-datos-de-resultados-agregados-de-saber-pro-2025.xlsx','https://www.icfes.gov.co/wp-content/uploads/2025/06/Base-de-datos-de-resultados-agregados-de-saber-pro-2024.xlsx']) {
  const r=await fetch(u,{headers:H}); console.log('\n##',u,r.status,r.headers.get('content-length'));
  if(!r.ok)continue;
  const wb=XLSX.read(Buffer.from(await r.arrayBuffer()));
  for (const n of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:''});console.log('sheet',n,rows.length);for(const row of rows.slice(0,6))console.log(JSON.stringify(row).slice(0,900));}
}
