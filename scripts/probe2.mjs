for (const u of ['https://www.icfes.gov.co/evaluaciones-icfes/acerca-del-examen-saber-pro/resultados-del-examen-saber-pro/','https://www.icfes.gov.co/evaluaciones-icfes/acerca-del-examen-saber-tyt/resultados-del-examen-saber-tyt/','https://www.icfes.gov.co/investigaciones/data-icfes/']) {
  const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}}); const t=await r.text();
  console.log('##',u,r.status,t.length);
  const seen=new Set();
  for (const m of t.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const h=m[1], tx=m[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    if (/\.(xlsx?|csv|zip|rar|7z)|descarg|agregad|base|resultados/i.test(h+tx) && !seen.has(h)) {seen.add(h);console.log(' ',tx.slice(0,80),'->',h);}
  }
}
