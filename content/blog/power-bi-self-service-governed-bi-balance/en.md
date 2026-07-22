Self-service BI fails when everything is either Wild West or Change Advisory Board. You need **trust tiers**, not one policy.

## Three-tier model

| Tier | Workspace type | Data sources | Typical user |
|------|----------------|--------------|--------------|
| **Explore** | Personal / sandbox | Copies, samples, non-prod | Analyst experimenting |
| **Team** | Department workspace | Certified models + governed mashups | Squad dashboards |
| **Official** | Prod certified | Gold semantic models only | Exec and regulatory reports |

Publish this table to the portal. Debates end faster when tiers are named.

## Rules that preserve agility

- Personal workspaces **auto-delete** after 90 days inactivity (with warning)
- Team tier may not connect to prod SQL without approval ticket
- Official tier requires **deployment pipeline** and named approver
- Shared datasets beat duplicated Import extracts

## Fabric alignment

Map Explore → My Workspace or small F2 capacity sandbox. Team → domain workspace with Git sync optional. Official → capacity-isolated prod with endorsement policy.

Enable **Fabric metrics hub** so users see certified datasets first in the OneLake catalog.

## Metrics that prove balance

Track: certified dataset reuse rate, number of prod gateways per report, time from experiment to promoted model. If reuse is low, governance is probably too tight or too vague.

Designing trust tiers for a 200-user tenant? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).