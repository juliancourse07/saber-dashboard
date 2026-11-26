const D='https://www.datos.gov.co';
for (const id of ['u37r-hjmu','iwgf-bkfk']) {
  const r=await fetch(`${D}/resource/${id}.json?`+new URLSearchParams({$select:'periodo as k,count(*) as n',$group:'k',$order:'k'}));
  console.log(id,(await r.text()).replace(/\s+/g,''));
}
const seen=new Set();
for (const q of ['saber pro 2023','saber pro 2024','saber pro 2025','saber tyt 2023','saber tyt 2024','saber tyt 2025','icfes resultados saber pro','icfes saber tyt','resultados agregados saber pro','saber pro resultados 2022','saber pro 2021']) {
  const c=await (await fetch(`${D}/api/catalog/v1?`+new URLSearchParams({q,only:'datasets',limit:20,domains:'www.datos.gov.co'}))).json();
  for (const x of c.results||[]) { const r=x.resource; if(seen.has(r.id))continue; seen.add(r.id); console.log(r.id,'|',r.name,'|',r.updatedAt,'|',x.owner?.display_name,'|',r.columns_field_name?.length); }
}
