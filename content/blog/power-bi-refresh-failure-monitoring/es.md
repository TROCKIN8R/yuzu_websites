Los fallos de refresh son silenciosos hasta el lunes. El CFO ya capturó un mosaico vacío.

## Qué monitorizar primero

| Señal | Dónde | Por qué importa |
|-------|-------|-----------------|
| Estado del refresh | Ajustes del dataset / historial Fabric | Primera señal |
| Rendimiento del gateway | Logs del gateway local | Timeouts disfrazados de errores DAX |
| Throttling de capacidad | App Fabric Capacity Metrics | Refresh en cola, no fallido — igual roto |
| Errores de suscripción | Correos de Power BI | Usuarios avisan antes que ops |

Empiece con **un dataset certificado** que alimente dashboards ejecutivos.

## Alertas que funcionan

Incluya dataset + workspace, último refresh exitoso, owner nombrado y enlace al runbook. Enrute a Slack/Teams con Power Automate o una GitHub Action ligera.

## Runbook mínimo

- Confirmar fallo en servicio vs gateway
- Reintentar una vez; capturar error
- Revisar ventana de mantenimiento del origen
- Si gateway: reinicio planificado
- Comunicar ETA a owners

## Notas Fabric

En Fabric, el refresh puede ejecutarse en modelos ligados a shortcuts del lakehouse. Verifique si el fallo está en el modelo o en un job Spark upstream.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para conectar observabilidad de refresh a su pipeline.