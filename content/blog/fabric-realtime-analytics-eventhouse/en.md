Batch BI still runs the business. But ops teams now ask for minutes, not nightly refresh. Fabric's real-time path connects Eventstream, Eventhouse, and your existing Power BI layer.

## The streaming stack in Fabric

Typical flow:

1. **Eventstream** ingests IoT, app events, or CDC streams
2. **Eventhouse (KQL database)** stores high-velocity tables optimized for time-series queries
3. **Semantic model or DirectQuery** exposes curated views to Power BI
4. Optional **Real-Time dashboard** for sub-second ops tiles without full report chrome

You do not need every event in a Import model. Most teams aggregate in KQL, then surface hourly or 5-minute grains to BI.

## Power BI vs Real-Time dashboards

| Need | Surface |
|------|---------|
| Exec KPIs with drill-down | Power BI report on aggregated KQL export or DirectQuery |
| NOC wall, line status, alerts | Real-Time dashboard |
| Combined batch + live | Hybrid: Import history + live tile from KQL |

## Governance at velocity

- **Retention policies** on raw Eventhouse tables (7 days hot, archive to OneLake)
- **PII scrubbing** in Eventstream before persist
- Separate workspace for streaming experiments vs certified BI models
- Document which measures are **live** vs **delayed** on report headers

## BI developer tips

- Push complex shaping to **KQL materialized views**, not DAX on billion-row imports
- Test query cost on capacity during peak event rates
- Name streams and databases like warehouse schemas (`ops.machine_events`, not `test123`)

## Pilot scope

One line of business, one event type, one dashboard with three metrics. Run parallel to batch report for two weeks. Compare incident response time before expanding.

Exploring Eventstream to Power BI for your plant or app telemetry? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
