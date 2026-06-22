Copilot en Microsoft Fabric no reemplaza su modelo semántico. Es un acelerador para trabajo BI repetitivo, si le pone barandillas.

## Flujo 1: Scaffolding de medidas

Pida a Copilot redactar medidas DAX desde una spec en lenguaje claro, luego revise en PR como cualquier otro código. Nunca haga merge de DAX generado por IA sin un humano dueño de la definición de negocio.

**Patrón de prompt:** "Agrega crecimiento de ingresos YoY con inteligencia temporal en Sales[OrderDate]. Usa nuestro sufijo `_ YoY Growth`."

## Flujo 2: Documentación de pipeline y notebooks

Los data engineers pasan horas documentando notebooks Spark y pasos de pipeline. Copilot puede generar un primer borrador de README desde comentarios y salidas de celdas. Los editores aún validan exactitud contra el grafo de linaje real.

## Flujo 3: Q&A en lenguaje natural gobernado

Copilot para Power BI funciona mejor cuando el modelo semántico está limpio: nombres de tabla claros, medidas documentadas, RLS ya probado. Arregle el modelo primero; Copilot después.

## Qué evitar

- Dejar que Copilot renombre tablas en producción sin Git
- Usar SQL generado en pipelines sin EXPLAIN / chequeos de conteo
- Saltar revisión PR porque "la IA lo escribió"

## Próximos pasos

Elija un informe de alto churn. Agregue tres medidas asistidas por Copilot vía rama + PR. Mida cycle time antes/después. Esos datos venden el workflow a liderazgo mejor que cualquier demo de vendor.
