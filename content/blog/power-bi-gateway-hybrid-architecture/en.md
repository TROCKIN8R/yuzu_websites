The gateway is still the plumbing between your locked-down ERP and cloud BI. Treat it like production infrastructure, not a laptop under someone's desk.

## Reference architecture

| Tier | Recommendation |
|------|----------------|
| Gateway hosts | Dedicated VMs, not shared app servers |
| Cluster | Minimum two nodes for HA |
| Sources | One gateway cluster per environment (Dev/Test/Prod) |
| Credentials | Service accounts with least privilege; no personal accounts |

Map datasets to the **correct cluster** before certifying reports. Wrong cluster = refresh works in Dev, fails mysteriously in Prod.

## Refresh reliability patterns

- **Separate schedules** so 40 datasets do not refresh at `:00`
- **Incremental refresh** where source supports it
- **Query folding** validated in Power Query (no full table pulls)
- Monitor **gateway performance counters** and disk space on hosts

## Hybrid to Fabric migration

Long term, land ERP data in OneLake via pipeline or third-party ingest, then attach Direct Lake or Import from lake files. Short term, gateway remains valid.

Migration slice:

1. Replicate one subject area to Bronze via existing gateway-driven refresh
2. Build Gold mart in lakehouse
3. Point semantic model to Gold; retire duplicate Import from ERP
4. Keep gateway only for sources without lake path yet

## Security checklist

- Disable unused data sources on gateway
- Audit who can republish credentials
- Log gateway admin changes

Still running critical dashboards through a single non-HA gateway? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).