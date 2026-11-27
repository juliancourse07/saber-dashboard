# Tablero Saber Pro / Saber TyT

La [vista anual](https://juliancourse07.github.io/saber-dashboard/) compara publicaciones oficiales del ICFES. El navegador descarga un resumen JSON de los últimos cinco años, no los libros de Excel; la tabla conserva el enlace al archivo original de cada año.

El [explorador de microdatos](https://juliancourse07.github.io/saber-dashboard/detalle.html) consulta datos.gov.co en vivo. Detecta el último año de cada examen a partir de `periodo` y restringe filtros, indicadores y rankings a ese año y los cuatro anteriores. Los agregados anuales y los microdatos se muestran por separado: no se suman y pueden tener coberturas diferentes.

## Actualización

El flujo `Deploy dashboard` prepara la publicación en cada cambio de `main`, bajo demanda y diariamente a las 10:23 UTC (05:23 en Colombia). Si falla la importación no se reemplaza el sitio por un informe incompleto. La vista anual indica cuándo se verificó la fuente; una pestaña abierta comprueba el resumen cada diez minutos.

Para reproducir la vista anual localmente, instala las dependencias en un entorno virtual, ejecuta `python scripts/import_annual.py annual.json` y sirve el directorio con `python -m http.server`. Ejecuta `node --test scripts/test-detail.mjs` para comprobar el alcance y la paginación de las consultas de microdatos.
