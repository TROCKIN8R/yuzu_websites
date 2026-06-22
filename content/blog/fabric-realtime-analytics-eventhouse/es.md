La BI por lotes sigue moviendo el negocio. Operaciones pide minutos, no refresh nocturno. El camino realtime de Fabric conecta Eventstream, Eventhouse y Power BI.

## Stack streaming en Fabric

Flujo típico :

1. **Eventstream** ingiere IoT, eventos de app o CDC
2. **Eventhouse (base KQL)** guarda tablas de alta velocidad
3. **Modelo semántico o DirectQuery** expone vistas curated a Power BI
4. **Dashboard Real-Time** opcional para tiles operativos sub-segundo

No necesita cada evento en Import. Agregue en KQL, exponga granos de 5 min u hora a BI.

## Power BI vs dashboards Real-Time

| Necesidad | Superficie |
|-----------|------------|
| KPI ejecutivo con drill-down | Informe Power BI sobre agregado KQL |
| Muro NOC, estado de línea | Dashboard Real-Time |
| Batch + live | Híbrido: histórico Import + tile live KQL |

## Gobernanza a alta velocidad

- **Retención** en tablas crudas Eventhouse
- **PII scrubbing** en Eventstream
- Workspace separado para experimentos vs BI certificada
- Etiquetas **live** vs **delayed** en informes

## Tips para dev BI

- Shaping complejo en **vistas materializadas KQL**, no DAX sobre miles de millones Import
- Probar costo de consulta en pico de eventos
- Nombrar streams y bases como warehouse (`ops.machine_events`)

## Piloto

Un negocio, un tipo de evento, un dashboard con tres métricas. Dos semanas en paralelo al informe batch.

¿Eventstream a Power BI para planta o telemetría de app? [Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min).
