Shortcuts let one physical copy of data appear in multiple Fabric items. That is powerful until refresh order and permissions disagree.

## Link vs copy vs move

| Pattern | Use when | Risk |
|---------|----------|------|
| **Shortcut** | Shared Bronze or Gold across domains | Upstream delete breaks downstream |
| **Copy** | Legal/data residency requires isolation | Storage cost, drift |
| **Move** | Consolidating messy duplicates | Breaking existing reports mid-migration |

Default to shortcut for **read-heavy Gold marts**. Copy when compliance mandates physical separation.

## Integration patterns

**Central ingest, federated consume:**

1. Platform team lands Bronze in `PlatformLakehouse`
2. Domain workspaces create shortcuts to `Files/Bronze/erp/`
3. Domain pipelines write Silver/Gold locally
4. Semantic models use Direct Lake on domain Gold

Document the **lineage owner** for each shortcut target.

## Refresh and dependency order

Refresh Bronze pipeline before Silver jobs that read shortcuts. Orchestrate with Fabric pipeline activities or external scheduler — not hope.

Test failure modes: what happens when shortcut target is offline or permission revoked?

## Permissions checklist

- Source workspace: readers on shortcut path only
- Target workspace: engineers can create shortcuts, not overwrite source
- Service principals for pipelines scoped per lakehouse

## Anti-patterns

- Shortcut chains three levels deep with no diagram
- Same table shortcuted and full copied elsewhere (which is truth?)
- Personal workspace shortcuts to prod Gold without approval

Mapping shortcuts for a multi-domain Fabric rollout? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).