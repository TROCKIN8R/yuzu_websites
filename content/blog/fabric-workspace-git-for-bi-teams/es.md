Fabric Git conecta items del workspace a un repo remoto. Lo difícil no es el botón Connect. Es acordar cómo ramifica el equipo BI.

## Patrón 1: trunk-based para equipos pequeños

Todos mergean rápido a `main`. Ramas feature de horas. Funciona cuando:

- Equipo de 2–5 personas alineadas
- Modelos cambian seguido en incrementos pequeños
- Revisión PR en cada merge

Sync Fabric Git antes del standup. Pocos conflictos si archivos van por item.

## Patrón 2: rama feature por cambio (default recomendado)

Una rama por ticket. Merge vía PR. Funciona cuando:

- Varios analistas en el mismo modelo semántico
- CI (DAX, diff TMDL, dry-run deploy)
- Auditoría pide quién aprobó la medida

**Regla:** nombre de rama = ID del tracker.

## Qué commitear desde Fabric

- Modelos semánticos (TMDL / PBIP)
- Informes ligados
- Notebooks y pipelines que alimentan Gold

No commitear experimentos desechables. Workspace Dev para pruebas, sync al promover.

## Evitar dolor de merge en modelos

- **Modelos por dominio** cuando sea posible
- **Un owner por modelo** por sprint
- Tabular Editor para edits bulk, un commit
- Nunca dos renombres de tabla en la misma rama

## Git + pipelines de despliegue

Git = verdad de intención. Pipelines mueven Dev → Test → Prod:

1. Merge `main` → sync Dev
2. Pipeline → Test tras pruebas
3. Promote Prod con sign-off

GitHub Actions para notificaciones y tests externos.

## Checklist semana 1

1. Conectar workspace Dev al repo
2. Commit inicial del modelo golden
3. PR obligatorio para el 2º cambio
4. Documentar nombres de rama en README

¿Conflicto TMDL? [Reserve una llamada de 30 minutos](https://calendly.com/adrienyvin/30min).
