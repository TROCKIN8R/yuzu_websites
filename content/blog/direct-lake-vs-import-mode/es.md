La elección de modo solía ser Import vs DirectQuery. Fabric suma **Direct Lake**: consultar parquet en OneLake sin Import en VertiPaq. Eso cambia el cálculo en modelos grandes.

## Modo Import: la zona cómoda

**Import** copia datos al motor semántico. Consultas rápidas. DAX completo. Refreshes predecibles.

**Elija Import cuando:**

- El dataset cabe en refresh nocturno
- Depende de DAX complejo, tablas calculadas o patrones legacy
- Las fuentes no toleran carga live query

**Cuidado:** almacenamiento duplicado (lake + modelo), cadenas de refresh largas, drift entre warehouse e snapshot.

## DirectQuery: SQL en vivo

**DirectQuery** consulta la fuente al abrir el informe. Sin copia local grande.

**Elija DirectQuery cuando:**

- Datos casi en tiempo real y el tamaño impide Import
- Fuente SQL o warehouse con capacidad de sobra

**Cuidado:** visuales lentos, DAX limitado, picos de usuarios en el warehouse.

## Direct Lake: consultar el lake in situ

**Direct Lake** lee archivos OneLake vía el modelo sin Import total. Menos duplicación, refresh más corto, alineación con arquitectura medallion.

**Elija Direct Lake cuando:**

- Gold ya vive en OneLake
- Quiere rendimiento tipo Import sin duplicar storage
- Su capacidad Fabric lo soporta

**Cuidado:** disponibilidad regional, tablas mixtas, brecha de skills en layout del lake.

## Comparación rápida

| Factor | Import | DirectQuery | Direct Lake |
|--------|--------|-------------|-------------|
| Frescura | Refresh programado | Casi live | Refresh + archivos lake |
| Tamaño modelo | Alta presión | Baja | Media |
| DAX | Máximo | Limitado | En evolución |

## Camino de migración

No voltee 200 tablas de una noche. Empiece un **dominio nuevo** en Direct Lake. Informes paralelos un sprint. Compare refresh, latencia y ergonomía. Luego decida dominio por dominio.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min).
