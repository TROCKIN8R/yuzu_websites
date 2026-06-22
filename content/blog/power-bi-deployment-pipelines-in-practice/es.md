Los pipelines de despliegue son el riel de promoción del equipo BI. Funcionan cuando cada etapa tiene un rol, no cuando Dev es donde los informes esperan.

## Roles por etapa (manténgalo simple)

| Etapa | Propósito |
|-------|-----------|
| Dev | Integración y pruebas |
| Test | QA, UAT, RLS, rendimiento |
| Prod | Usuarios finales y suscripciones |

**Regla:** sin edición directa en Prod. Hotfix = Dev → Test → Prod.

## Automatice esto primero

1. **Reglas de dataset** al promover modelos
2. **Solo informes** si el DAX no cambió
3. **Refresh post-deploy** en Test
4. **Webhook Slack/Teams** si falla el promote

## Dataset completo vs solo informe

**Dataset + informes** si cambian relaciones, medidas o RLS.

**Solo informes** si solo layout, temas o bookmarks.

Si no: « campo no encontrado » en Prod el lunes a las 8.

## Git vs pipelines

- **Git:** historial, revisión, rollback
- **Pipeline:** aislamiento de entornos, promote para aprobadores

Merge `main` → sync Dev, pipeline a Test/Prod.

## Controles que importan

- Checklist de sign-off en Test
- Diff de esquema entre etapas
- Pausar suscripciones en breaking changes

## Anti-patrones

- Prod como zona de fix en vivo
- Saltar Test por RLS « pequeño »
- 40 informes sin reglas de dataset

Empiece con un modelo golden y tres informes. Un mes en verde antes de sumar todo el departamento.

[Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min) para revisar pipelines Fabric.
