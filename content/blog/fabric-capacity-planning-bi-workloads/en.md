Capacity planning fails when teams buy F64 for hope and run F32 until throttling ruins Monday refresh.

## Workload inputs that matter

| Workload | Drives capacity |
|----------|-----------------|
| Nightly Import refresh | Peak CU during refresh overlap |
| Direct Lake queries | Concurrent report users × query complexity |
| Spark / notebooks | Batch jobs sharing the same capacity |
| Real-time Eventhouse | Ingest + query spikes |

List **peak overlap**, not average daily use. Refresh at 2am plus Europe morning report load hits the same SKU.

## Read the Capacity Metrics app first

Before upgrading SKU:

1. **Throttling events** last 14 days
2. **Refresh duration trend** (getting longer = model or SKU problem)
3. **Interactive vs background** CU split
4. **Eviction** on large Import models

If throttling is zero but refresh finishes in window, stop shopping for SKUs.

## Sizing heuristics (starting points, not gospel)

- **Pilot / dev:** F2–F8 with strict workspace isolation
- **Department BI:** F16–F32 with monitored refresh overlap
- **Enterprise hub:** F32–F64+ with autoscale policy documented

Direct Lake often reduces Import storage pressure but not human concurrency. Test with **Analyze in Excel** and top ten dashboards simultaneously.

## Cost governance

- Separate **prod certified** capacity from sandbox experimentation
- Auto-pause dev capacity nights/weekends where policy allows
- Tag workspaces by cost center for chargeback conversations

## When to split capacities

If data engineering Spark regularly starves Power BI refresh, split ETL and BI into separate Fabric capacities or use job schedules that do not overlap peaks.

Sizing Fabric for your refresh and user peaks? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).