Governance is not a quarterly slide. It is a short checklist run before every prod promote.

## Pre-promote checklist

### Ownership and metadata

- [ ] Named **owner** and **backup owner** in dataset description
- [ ] **Business definition** linked for top 10 measures
- [ ] **Refresh schedule** documented with timezone and dependency chain
- [ ] **Entra group** for workspace access, not individual emails only

### Model quality

- [ ] Star schema or documented exception
- [ ] Hide unused columns and tables from report view
- [ ] **RLS / OLS** tested with three accounts (full, partial, none)
- [ ] No duplicate measures with slightly different names

### Change control

- [ ] Git commit or Fabric workspace sync before pipeline promote
- [ ] Changelog entry for breaking measure renames
- [ ] Test workspace report smoke test passed

### Certification

- [ ] Certified by named approver (not self-certified by author)
- [ ] Endorsement badge only after checklist complete
- [ ] Deprecated models flagged in portal, not deleted silently

## Fabric-specific adds

- Document **storage mode** per table (Import, DirectQuery, Direct Lake)
- Link semantic model to **Gold** tables, not ad hoc notebook outputs
- Capacity SKU noted for Direct Lake eligibility

## Make it stick

Publish the checklist in the repo. CI fails if `article.yaml`-style metadata fields are empty in a deployment manifest. Humans review exceptions; automation catches omissions.

Rolling governance across 15 workspaces? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).