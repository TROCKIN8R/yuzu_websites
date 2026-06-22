Microsoft Fabric now ships two different "app" concepts. They sound similar in meetings. They solve different problems.

## Power BI Apps: the curated report bundle

A **Power BI App** is what most BI teams already know: a packaged, read-only collection of reports and dashboards from one workspace, published to a defined audience with permissions managed centrally.

**Best for:**

- Executive dashboards and monthly packs
- Self-serve analytics where users consume, not edit
- Replacing messy "shared workspace" links with one branded entry point

**Limitations:**

- Read-only for end users
- No custom write-back or operational forms
- Still report-centric, not a full web application

If your goal is "one link for the finance pack," Power BI Apps still win.

## Fabric Apps: the low-code web app on your data

A **Fabric App** (built with the Fabric app builder / Power Apps in Fabric context) is a web application that can **read and write** against items in your Fabric workspace: lakehouse tables, warehouse SQL, semantic models, even invoke notebooks or pipelines.

Think operational tooling, not just charts:

- Approvals and status updates written back to a table
- Field teams submitting inventory counts from a phone
- Lightweight CRUD on reference data without spinning up a separate Azure app service

**Best for:**

- Process apps where users must **change** data, not only view it
- Scenarios that outgrow "one more report page"
- Teams already on Fabric who want one security and lineage story

**Trade-offs:**

- More build and test effort than publishing a report app
- You own UX, validation, and error handling
- Governance must cover write paths, not just RLS on read

## Decision cheat sheet

| Question | Lean toward |
|----------|-------------|
| Users only view KPIs? | Power BI App |
| Users must submit or edit records? | Fabric App |
| Need mobile-first forms? | Fabric App |
| Need certified report catalog? | Power BI App |
| Must writes land in OneLake / warehouse? | Fabric App |

## Hybrid pattern we see in the field

Keep the **Power BI App** as the analytics front door. Add a **Fabric App** for the one workflow that breaks every month (budget adjustments, master data fixes, exception logging). Link between them from the report landing page. Same workspace, same Entra groups, two surfaces optimized for read vs write.

## Rollout tip

Pilot the Fabric App on a non-production workspace with real table schemas and RLS rules copied from Prod. Validate write volume and refresh impact before you publish broadly. Power BI Apps can go live faster; treat Fabric Apps like any internal web app with a short UAT checklist.

Building both on Fabric and not sure where the boundary falls for your team? [Book a 30-minute call](https://calendly.com/adrienyvin/30min). We map read vs write paths before you commit headcount.
