# Tablero Saber Pro / Saber TyT

La [portada](https://juliancourse07.github.io/saber-dashboard/) abre el comparador institucional de Uniputumayo, reconociendo también la denominación Instituto Tecnológico del Putumayo. Selecciona examen, año, IES, programa/sede y puntaje global o módulo genérico. Sólo se descarga el detalle agregado del año seleccionado. La referencia país usa la fila nacional del ICFES, no un promedio de instituciones. Para programas se añade el núcleo básico del conocimiento (NBC) y se buscan pares del mismo NBC y carácter académico. El carácter se cruza por nombre normalizado con el directorio del MEN; sin coincidencia inequívoca no se infiere.

La [tendencia nacional](https://juliancourse07.github.io/saber-dashboard/nacional.html) conserva la vista de los últimos cinco años y los enlaces a los Excel oficiales.

El [explorador de microdatos](https://juliancourse07.github.io/saber-dashboard/detalle.html) consulta datos.gov.co en vivo. Detecta el último año de cada examen a partir de `periodo` y restringe filtros, indicadores y rankings a ese año y los cuatro anteriores. Los agregados anuales y los microdatos se muestran por separado: no se suman y pueden tener coberturas diferentes.

## Actualización

Si un indicador presenta varias filas nacionales en el mismo año, el tablero indica cuántas hay y enlaza al Excel: no suma los grupos ni elige una fila como si fuera el total.

El flujo `Deploy dashboard` prepara la publicación en cada cambio de `main`, bajo demanda y diariamente a las 10:23 UTC (05:23 en Colombia). Si falla la importación no se reemplaza el sitio por un informe incompleto. La vista anual indica cuándo se verificó la fuente; una pestaña abierta comprueba el resumen cada diez minutos.

Para reproducir la vista anual localmente, instala las dependencias en un entorno virtual, ejecuta `python scripts/import_annual.py annual.json` y sirve el directorio con `python -m http.server`. Ejecuta `node --test scripts/test-detail.mjs` para comprobar el alcance y la paginación de las consultas de microdatos.
