El refresh incremental ahorra horas hasta que un filtro cambiado recarga todo el historial.

## Prerrequisitos del origen

Columna fecha fiable, consultas filtradas, zona horaria documentada.

## Parámetros

`RangeStart` / `RangeEnd`, ventana archivo vs incremental alineada a datos tardíos.

## Tamaño de particiones

Volumen moderado: incremental diario. Alto volumen: particiones mensuales o Direct Lake.

## Detectar full refresh silencioso

Duración, filas procesadas, bytes gateway — alerta si 2× baseline.

## Fallos frecuentes

Filtro fecha eliminado, origen sin índice, claves merge incorrectas.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para revisar su mayor tabla de hechos.