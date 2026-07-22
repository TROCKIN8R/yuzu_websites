Refresh failures are silent until Monday morning. By then the CFO has already screenshot a blank tile and tagged IT in Teams.

## What to monitor first

| Signal | Where | Why it matters |
|--------|-------|----------------|
| Refresh status | Dataset settings / Fabric job history | First failure flag |
| Gateway performance | On-premises data gateway logs | Timeouts masquerading as DAX errors |
| Capacity throttling | Fabric Capacity Metrics app | Refresh queued, not failed — still broken |
| Subscription errors | Power BI service emails | Users notice before ops |

Start with **one certified dataset** that feeds exec dashboards. Expand after alert noise is tuned.

## Alert design that works

Bad alert: "Refresh failed" with no dataset name, no owner, no retry link.

Good alert includes:

1. **Dataset + workspace** in subject line
2. **Last successful refresh** timestamp
3. **Named owner** (Entra group, not a departed analyst)
4. **Runbook link** with retry steps and escalation path

Route to Slack or Teams via Power Automate or a lightweight GitHub Action that polls the REST API. Pager only for prod-certified models during business hours.

## Minimum runbook (one page)

- Confirm failure in service vs gateway (error code)
- Retry once manually; capture error text
- Check source system maintenance window
- If gateway: restart service on schedule, not randomly
- Communicate ETA to report owners before they ask

## Fabric vs classic workspace notes

In Fabric, refreshes may run on **semantic model** items tied to lakehouse shortcuts. Verify the failure is on the model refresh, not an upstream Spark job. Chain dependencies in documentation so on-call knows which job to fix first.

## Anti-patterns

- Email-only alerts nobody reads
- Monitoring every sandbox dataset equally
- No owner field in the dataset description

Need help wiring refresh observability into your deployment pipeline? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).