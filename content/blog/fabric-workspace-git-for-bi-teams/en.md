Fabric Git connects workspace items to a remote repo. The hard part is not the Connect button. It is agreeing how your BI team branches.

## Pattern 1: Trunk-based for small squads

Everyone commits to `main` (or merges quickly). Feature branches live hours, not weeks. Works when:

- Team is 2–5 people who sit together
- Models change often but in small increments
- You trust PR review on every merge

Use Fabric Git sync before standup. Conflicts are rare if files are split by item.

## Pattern 2: Feature branch per change (recommended default)

One branch per ticket: `feat/revenue-yoy-measure`, `fix/rls-region-table`. Merge via PR. Works when:

- Multiple analysts touch the same semantic model
- You run CI checks (DAX, TMDL diff, deployment dry-run)
- Audit asks "who approved this measure change?"

**Rule:** branch name matches your work tracker ID.

## What to commit from Fabric

Commit intentionally:

- Semantic models (TMDL / PBIP structure)
- Reports tied to those models
- Notebooks and pipelines that feed gold tables

Avoid committing experimental scratch items. Use a Dev workspace for throwaway tests, sync only when promoted.

## Avoiding merge pain on semantic models

- **Split models by domain** when possible (Finance vs Sales vs Ops)
- **One owner per model** per sprint for conflict resolution
- Use Tabular Editor or TE2 for bulk edits, then commit once
- Never two people rename tables on the same branch

## Git + deployment pipelines

Git is source of truth for *intent*. Deployment pipelines still move artifacts Dev → Test → Prod. Wire them so:

1. Merge to `main` triggers sync to Dev workspace (or auto via Fabric)
2. Pipeline promotes tested build to Test
3. Manual or gated promote to Prod after sign-off

GitHub Actions can call Fabric REST APIs for steps pipelines do not cover (notifications, external tests).

## First week checklist

1. Connect Dev workspace to empty repo
2. Initial commit of golden semantic model
3. Mandate PR for second change (any small measure edit)
4. Document branch naming in README

Stuck on first merge conflict in TMDL? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
