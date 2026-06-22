Deployment pipelines are the BI team's promotion railroad. They work when each stage has a job, not when Dev is "where reports go to wait."

## Stage roles (keep it boring)

| Stage | Purpose |
|-------|---------|
| Dev | Integration and messy experiments |
| Test | QA, UAT, RLS validation, performance spot checks |
| Prod | End users and subscriptions only |

**Rule:** no report edits in Prod workspace. Hotfix goes Dev → Test → Prod like everything else.

## Automate these first

1. **Dataset rules** copy parameters and refresh schedule when promoting semantic models
2. **Deploy reports only** when DAX did not change (visual tweaks)
3. **Post-deploy refresh** trigger on Test after dataset promote
4. **Slack / Teams webhook** on failed promote (GitHub Action or Power Automate)

Native pipeline UI handles 1–3. Step 4 is where teams glue observability.

## When full dataset deploy vs report-only

**Full dataset + reports** when:

- Relationships, measures, or RLS changed
- New tables added

**Reports only** when:

- Layout, themes, bookmarks changed
- Same semantic model version

Mismatch (new measure in model, report-only deploy) causes "field not found" in Prod at 8am Monday.

## Git vs pipelines: who owns what

- **Git:** history, review, rollback intent
- **Pipeline:** environment isolation and click-to-promote for approvers

Do not skip Git because pipelines exist. Do not skip pipelines because Git exists. Connect merge to `main` with a Dev sync, then pipeline to Test/Prod.

## Gates that matter

- Sign-off checklist in Test (named owner, date)
- Compare **schema** diff between stages before Prod
- Pause subscriptions during breaking model changes

## Anti-patterns

- Prod workspace used as "the fix it live" zone
- Test stage skipped for "small" RLS edits
- 40 reports in one pipeline with no dataset rules

Start with one golden semantic model and three dependent reports. Get that pipeline green for a month before adding every departmental PBIX.

Pipeline design review on your Fabric tenant? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
