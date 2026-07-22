Medallion architecture is a filing system for data lake tables. In Fabric, OneLake makes the folders real — if your team agrees what each layer is for.

## Layer responsibilities

| Layer | Holds | Do not put here |
|-------|-------|-----------------|
| **Bronze** | Raw ingest, schema-on-read, full history | Business-friendly column names |
| **Silver** | Cleaned, conformed, deduped entities | Report-specific KPIs |
| **Gold** | Curated marts: star schemas, grain locked | Raw JSON blobs |

**Rule:** Power BI consumers read **Gold** (Direct Lake or Import from Gold shortcuts). Analysts explore Silver. Engineers own Bronze.

## Fabric workspace layout

Typical pattern per domain (Sales, Finance):

```
DomainLakehouse/
  Files/Bronze/source_system_x/
  Tables/Silver/customer/
  Tables/Gold/fact_sales_daily/
```

Use **shortcuts** to a central Bronze lakehouse if multiple domains ingest the same source. Do not copy raw files per workspace without retention policy.

## Naming that scales

- Tables: `{layer}_{entity}` or schema-per-layer folders
- Pipelines: `pl_{domain}_{source}_to_{layer}`
- Semantic models: `sm_{domain}_{subject}` linked to Gold only

Document grain in the Gold table description field. Future you (and Copilot) will need it.

## Power BI attachment

Prefer **Direct Lake** on Gold parquet when capacity supports it. Import from Gold only when DAX complexity or offline latency requirements demand it. Never bind executive dashboards directly to Bronze.

## Migration in slices

Pick one subject area. Land Bronze for two weeks, promote one Silver entity, ship one Gold mart and one report. Compare refresh time and query cost before replatforming the whole ERP extract.

Designing medallion layout on OneLake for your tenant? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).