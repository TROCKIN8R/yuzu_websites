Storage mode picks used to be Import vs DirectQuery. Fabric adds **Direct Lake**: query parquet in OneLake without importing into VertiPaq. That changes the math for large models.

## Import mode: still the comfort zone

**Import** copies data into the semantic model engine. Queries are fast. DAX is full-featured. Offline refresh windows are predictable.

**Choose Import when:**

- Dataset is small enough for nightly refresh (rough rule: under a few GB in model, depends on SKU)
- You rely on complex DAX, calculated tables, or legacy patterns
- Source systems cannot tolerate live query load

**Watch for:** duplicate storage (lake + model), long refresh chains, and drift between warehouse truth and imported snapshot.

## DirectQuery: live SQL, live trade-offs

**DirectQuery** sends queries to the source at report runtime. No big local copy. Latency and load follow user activity.

**Choose DirectQuery when:**

- Data must be near real-time and model size forbids Import
- Source is a tuned SQL endpoint or warehouse with capacity headroom

**Watch for:** slow visuals, restricted DAX, and report user spikes hammering the warehouse.

## Direct Lake: query the lake in place

**Direct Lake** reads OneLake files (often parquet from a shortcut lakehouse) through the semantic model without a full Import. Less duplication, shorter refresh for the cached portion, alignment with medallion architecture.

**Choose Direct Lake when:**

- Gold layer already lives in OneLake
- You want Import-like performance on lake files without doubling storage
- Fabric capacity supports Direct Lake for your item types

**Watch for:** preview/feature availability by region, mixed tables (some Import fallback), and team skill gap on lake file layout.

## Quick comparison

| Factor | Import | DirectQuery | Direct Lake |
|--------|--------|-------------|-------------|
| Data freshness | Refresh schedule | Near live | Refresh + lake files |
| Model size pressure | High | Low | Medium |
| DAX flexibility | Highest | Limited | Growing |
| Ops complexity | Refresh jobs | Source load | Lake + model sync |

## Migration path we recommend

Do not flip a 200-table model overnight. Start with a **new subject area** on Direct Lake (one gold mart). Run parallel reports for one sprint. Compare refresh time, query latency, and developer ergonomics. Then decide domain by domain.

Need help sizing Direct Lake for your lakehouse layout? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
