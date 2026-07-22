Los informes lentos no siempre necesitan un SKU mayor. Necesitan menos medidas malas en cada render.

## Diagnosticar antes de reescribir

1. **Performance Analyzer**: medida dominante
2. **DAX Studio** Server Timings: FE vs SE
3. **VertiPaq Analyzer**: cardinalidad alta

SE alto → modelo. FE alto → DAX.

## Patrones dañinos

`SUMX` en tabla grande, `FILTER` en toda la tabla, `CALCULATE` anidados, iteradores en texto.

## Patrones útiles

`VAR`, grupos de medidas, medidas base documentadas, revisión DAX Studio en PR.

Si el visual escanea 40M filas por clic, agregue en Gold en lugar de tunear DAX sin fin.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) si el informe sigue lento.