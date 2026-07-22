La gobernanza no es una diapositiva trimestral. Es un checklist corto antes de cada promote a prod.

## Checklist pre-promoción

### Ownership y metadatos

- [ ] Owner y backup nombrados
- [ ] Definiciones de negocio para top 10 medidas
- [ ] Refresh documentado con zona horaria y dependencias
- [ ] Grupo Entra para acceso al workspace

### Calidad del modelo

- [ ] Esquema estrella o excepción documentada
- [ ] Columnas no usadas ocultas
- [ ] RLS / OLS probados (tres cuentas)
- [ ] Sin medidas duplicadas

### Control de cambios

- [ ] Git o sync Fabric antes de promote
- [ ] Changelog para renombres breaking
- [ ] Smoke test de informe en Test

### Certificación

- [ ] Certificado por aprobador nombrado
- [ ] Modelos obsoletos marcados, no borrados en silencio

## Específico Fabric

Documente modo de almacenamiento por tabla y enlace a Gold.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para desplegar esta gobernanza.