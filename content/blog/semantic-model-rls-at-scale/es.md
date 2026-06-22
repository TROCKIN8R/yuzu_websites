La seguridad a nivel fila (RLS) falla cuando el headcount cambia más rápido que su DAX. Algunos patrones sobreviven reorganizaciones y auditorías.

## Patrón 1: RLS con grupos Entra

Enlace `USERPRINCIPALNAME()` a tabla **UserAccess** mantenida por IT, no emails pegados en Excel.

Columnas: UserEmail, Region, CostCenter, Role. Refresh desde HR o Entra cada noche.

## Patrón 2: tabla puente many-to-many

El usuario cubre varias regiones o marcas. Tabla **UserRegionBridge**:

`UserEmail | RegionKey`

Relaciones: Users → Bridge → Dimensión Region → Hecho.

Una regla escala cuando marketing agrega región.

## Patrón 3: seguridad dinámica en dimensión, no en hecho

RLS en **Region** o **Customer**, no en el hecho de 40M filas. Contexto de filtro menor, consultas más rápidas.

## Pruebas antes de promote en pipeline

Mínimo automatizado:

1. **Cuentas test** Entra (acceso total, restringido, ninguno)
2. **View as role** en Desktop antes del commit
3. Script XMLA o preview de rol en Tabular Editor en CI

## Fallos comunes

- Emails hard-coded en DAX
- RLS en columnas calculadas que rompe folding
- Cuentas de servicio olvidadas para suscripciones

Documente roles admin break-glass por separado.

## Object-level security

OLS en tabla/columna para PII (salario, ID nacional). Combine con RLS: ve región pero no columna salario.

¿RLS en modelo live con 200 usuarios? [Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min).
