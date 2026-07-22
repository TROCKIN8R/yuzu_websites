Incremental refresh saves hours until someone changes a filter and unknowingly triggers a full reload of history.

## Prerequisites on the source

- Reliable **date column** (prefer `datetime`, not sortable text)
- Source supports **filtered queries** (SQL `WHERE`, not full file read)
- Time zone documented — midnight UTC vs local breaks partitions

## Parameter pattern

Use `RangeStart` and `RangeEnd` in Power Query filters. Policies in the semantic model define:

- **Archive period:** how much history to keep in model
- **Incremental period:** window reloaded each run (e.g. last 3 days)

Match incremental window to **late-arriving data** latency. Too narrow misses corrections; too wide negates savings.

## Partition sizing

| Data volume | Starting policy |
|-------------|-----------------|
| < 10M rows / year | Daily incremental, 2–3 year archive |
| High volume facts | Monthly partitions + shorter incremental |
| Event streams | Consider Direct Lake instead |

## Detect silent full refresh

Monitor:

- Refresh duration spike vs 7-day median
- Rows processed in refresh history
- Gateway bytes transferred

Alert when duration exceeds 2× incremental baseline.

## Common failures

- Changed Power Query step removes date filter → full load
- Source column not indexed → incremental still slow
- Duplicate rows when incremental merge keys wrong

Test incremental in Dev with **Process Recycle** before Prod promote.

Incremental refresh design review on your largest fact? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).