La arquitectura medallion es un sistema de archivado para tablas lake. En Fabric, OneLake hace reales las carpetas — si el equipo acuerda para qué sirve cada capa.

## Responsabilidades por capa

| Capa | Contiene | No poner aquí |
|------|----------|---------------|
| **Bronze** | Ingesta cruda, historial completo | Nombres de negocio |
| **Silver** | Entidades limpias y conformadas | KPIs de un solo informe |
| **Gold** | Marts curados, grano fijado | JSON crudo |

**Regla:** los consumidores Power BI leen **Gold**. Analistas exploran Silver. Ingeniería posee Bronze.

## Layout en Fabric

Use **shortcuts** a un Bronze central si varios dominios comparten la misma fuente.

## Nombres

Documente el grano en la descripción Gold. Su yo futuro (y Copilot) lo necesitará.

## Conexión Power BI

Prefiera **Direct Lake** sobre Gold. Import desde Gold solo si el DAX lo exige.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para diseñar medallion en OneLake.