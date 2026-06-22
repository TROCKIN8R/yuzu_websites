Microsoft Fabric ofrece hoy dos conceptos distintos de « app ». Suenan parecido en reuniones. Resuelven problemas diferentes.

## Apps Power BI: la compilación de informes

Una **app Power BI** es lo que la mayoría conoce: paquete de solo lectura con informes y dashboards de un workspace, publicado a una audiencia con permisos centralizados.

**Ideal para:**

- Dashboards ejecutivos y paquetes mensuales
- Autoservicio donde el usuario consume sin editar
- Reemplazar enlaces caóticos al workspace por una entrada única

**Límites:**

- Solo lectura para usuarios finales
- Sin write-back ni formularios operativos
- Centrado en informes, no en aplicación web completa

Si el objetivo es « un enlace para el pack de finanzas », la app Power BI sigue ganando.

## Apps Fabric: webapp lectura/escritura sobre sus datos

Una **app Fabric** es una aplicación web que puede **leer y escribir** sobre items del workspace: tablas lakehouse, SQL warehouse, modelos semánticos, notebooks o pipelines.

Piense en herramientas operativas:

- Aprobaciones y actualizaciones de estado en tabla
- Equipos de campo enviando conteos desde el móvil
- CRUD ligero sobre datos maestros sin otro App Service

**Ideal para:**

- Procesos donde el usuario **cambia** datos, no solo los ve
- Escenarios que superan « una página de informe más »
- Equipos en Fabric con una sola historia de seguridad y linaje

**Contras:**

- Más esfuerzo de build y prueba que publicar una app de informes
- UX, validación y errores son su responsabilidad
- Gobernanza debe cubrir rutas de escritura, no solo RLS de lectura

## Tabla de decisión rápida

| Pregunta | Inclínese hacia |
|----------|-----------------|
| ¿Solo ven KPIs? | App Power BI |
| ¿Deben enviar o editar registros? | App Fabric |
| ¿Formularios mobile-first? | App Fabric |
| ¿Catálogo certificado de informes? | App Power BI |
| ¿Escrituras en OneLake / warehouse? | App Fabric |

## Patrón híbrido en producción

Mantenga la **app Power BI** como puerta de analytics. Agregue una **app Fabric** para el flujo que falla cada mes (ajustes de presupuesto, correcciones de maestros, log de excepciones). Mismo workspace, mismos grupos Entra, dos superficies optimizadas.

## Tip de despliegue

Pilote la app Fabric en no-prod con esquemas reales y RLS copiado de Prod. Valide volumen de escritura e impacto en refresh antes de publicar amplio.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para mapear rutas read vs write antes de comprometer headcount.
