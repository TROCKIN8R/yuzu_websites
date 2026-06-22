Microsoft publica actualizaciones de Power BI cada mes. La mayoría no exige un proyecto de migración. Parte de las entregas de **abril a junio de 2026** son cambios pequeños y de alto impacto que puede activar esta semana sin replatformar el warehouse.

Este artículo filtra los [resúmenes de junio 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264), [abril 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-April-2026-Feature-Summary/ba-p/5173904) y posts GA relacionados hacia acciones concretas para admins BI y autores de informes.

## 1. Org apps con audiencias (disponibilidad general)

Las **org apps** replantean las apps de workspace en Fabric: varias apps por workspace, branding, páginas Overview y navegación controlada. A mediados de 2026 alcanzan **GA**, con **audiencias**: una superficie de app, contenido y visibilidad de nav distintos por grupo (ejecutivos, managers, primera línea).

Por qué supera « comparte el enlace del workspace »:

- Descubrimiento en **Recent** y listas de items sin paso de instalación
- **Varias org apps por workspace** o **una app + audiencias**
- Al compartir, asigne audiencias al conceder acceso

**Victoria esta semana:** Elija el workspace más ruidoso. Cree una org app con dos audiencias (p. ej. Dirección vs Analista). Añada página **Overview**. Retire la wiki « ¿cuál enlace es el oficial? ».

Las apps workspace legacy siguen soportadas. Planifique nueva distribución en org apps.

## 2. Página de aterrizaje del informe (GA)

**Set as landing page** fija la página que deben ver primero los usuarios (clic derecho en pestaña o panel de formato). GA en la ola de mayo 2026. La org app lleva al informe; la landing page lleva a la página **correcta**.

**Aplique en:** paquetes ejecutivos, árboles de KPI e informes cuya página 1 sigue siendo borrador de 2022.

## 3. Slicer date picker (preview)

El **date picker** para slicers (preview junio 2026) ataca reabrir informes cada mes para resetear rangos. Publica un default **relativo** (p. ej. últimos 12 meses anclados a la última fecha de datos). Los usuarios mantienen selección manual en un solo control.

Active en **Options > Preview features** en Desktop y opción **Date picker** en slicer de fecha.

## 4. Funciones DAX definidas por el usuario (GA)

Las **UDF DAX** pasaron a GA en junio 2026. Defina una función (firma tipada, parámetros opcionales), reutilice en medidas, columnas y cálculos visuales. Las UDF viven en el modelo, siguen renombres y se editan en **modelado web** o Model View en Desktop.

Ejemplos que pagan rápido:

- Conversión de moneda o días hábiles compartidos
- Márgenes aprobados referenciados por muchas medidas
- Snippets TMDL en Git con el modelo semántico

**Regla de equipo:** UDF aprobadas = biblioteca compartida. Revisión PR antes del modelo golden.

## 5. Copilot en modelado web (preview)

Junio 2026: **Copilot en modelado web** en el servicio. Lenguaje natural para analizar estructura, renombrar tablas/columnas, relaciones y borradores de medidas en el navegador.

**Barrera práctica:** workspaces **Dev/Test** primero. Copilot propone; humanos aprueban antes del promote. Empareje con Fabric Git para renombres vía PR.

## 6. Copilot en Power BI mobile (ampliado)

Abril 2026 expandió **Copilot in-report en mobile** de prompts fijos a **chat multi-turno** anclado al informe abierto, con **citas a visuales**. Dictado por voz en iOS para revisiones ejecutivas fuera del escritorio.

**Victoria:** Actívelo en los tres informes más usados en móvil. Documente preguntas ejemplo que funcionan vs las que requieren desktop.

## 7. Auto-expand de matriz y slicers de tamaño fijo

- **Auto-expand matriz (GA):** Niveles de jerarquía nuevos pueden expandirse por defecto. Ayuda a **Personalize this visual** cuando las matrices parecen vacías colapsadas.
- **Layout tamaño fijo en card/button/list slicer (GA abril):** Control en píxeles cuando « fit to space » falla en temas oscuros.

## 8. PBIR default-on: higiene dev, no brillo de usuario

Microsoft reanudó el despliegue **PBIR default-on** en el servicio en junio 2026; Desktop apuntado más tarde en verano. PBIR alinea PBIX con **PBIP** para Git, CI/CD y edición programática. PBIX sigue siendo el formato de autor; el cambio es sobre todo metadatos internos.

**PBIP + GitHub:** siga invirtiendo. Opt-in en Desktop si falta. **Solo PBIX:** sin capacitación; vigile release notes junio/julio.

**Desktop Bridge (preview)** conecta autoría agent con Desktop para **agent skills** de informes. Trátese como I+D hasta tener gobernanza.

## 9. Azure Maps y tooltips (UX visible, poco esfuerzo)

- **Selección por formas Azure Maps activada por defecto (GA junio):** Lazo regional y selección por tiempo de viaje visibles sin config del autor.
- **Modo frase en tooltip (GA junio):** Explique métricas en lenguaje claro sin página tooltip custom.

Confirme **ajustes tenant Azure Maps** si los mapas fallaron tras la refactorización 2025 (Desktop abril 2025+ requerido).

## Qué posponer (hype preview vs victorias diarias)

Los titulares de Build 2026 (**Agent Skills**, **Fabric Apps en modelos semánticos**) son reales pero van en **workspace piloto** con capacidad Copilot, Git y reglas de aprobación. No son « victorias pequeñas » si aún pelea con refreshes fallidos.

| Adoptar ahora | Pilotar aparte |
|---------------|----------------|
| Org apps + audiencias | Agent skills de informes |
| Landing + Overview | Fabric Apps semánticas |
| UDF DAX en golden | Desktop Bridge |
| Date picker (preview) | Fabric IQ en M365 (Frontier) |
| Chat Copilot mobile | Copilot modelado web en Prod |

## Checklist de una tarde

1. Crear o mejorar una **org app** con dos audiencias y Overview
2. **Landing page** en el informe ejecutivo principal
3. **Date picker** en un informe ops mensual (preview)
4. Extraer un patrón DAX repetido a **UDF** en Dev
5. Confirmar tenant **Azure Maps** y versión mínima de Desktop
6. Revisar el [resumen junio 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264) por un tweak visual GA (color icono slicer, padding eje, hover card)

Estos pasos no reemplazan migración Fabric ni refactor del modelo. Reducen fricción mientras Microsoft empuja BI agéntica y dan a usuarios una puerta de entrada más clara este trimestre.

¿Priorizar audiencias org app o estándares UDF? [Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min).
