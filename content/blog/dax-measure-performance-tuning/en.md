Slow reports rarely need a bigger SKU first. They need fewer bad measures competing at render time.

## Diagnose before rewriting

1. **Performance Analyzer** in Power BI Desktop: record visual load, note which measure dominates
2. **DAX Studio** Server Timings: split FE vs SE time
3. **VertiPaq Analyzer**: confirm high-cardinality columns feeding iterators

If Storage Engine time is high, fix the model (relationships, cardinality). If Formula Engine dominates, fix the DAX.

## Patterns that hurt

| Pattern | Symptom | Fix direction |
|---------|---------|---------------|
| `SUMX` over large fact | High FE time | Pre-aggregate in Power Query or calculated table |
| `FILTER` on whole table | Scan entire fact | Push filter to dimension or use `KEEPFILTERS` intentionally |
| Nested `CALCULATE` | Hard to read, slow plans | Split into variables with `VAR` |
| Iterator on text column | Cardinality explosion | Move logic to Gold SQL or remove column |

## Patterns that help

- **`VAR`** for repeated sub-expressions (readable + often faster)
- **Measure groups** for time intelligence instead of copy-paste YoY
- **Field parameters** instead of duplicating measures per scenario
- Document **base measures** (`Sales Amount Base`) and layer ratios on top

## Team guardrails

Add a PR checklist item: "New measure reviewed in DAX Studio on a cold cache." Store approved snippets in Git next to the semantic model. Copilot drafts measures; humans enforce patterns.

## When to stop tuning DAX

If the visual needs a 40M-row scan every click, move aggregation to the lakehouse Gold layer and expose a simple sum in the model. DAX is not a replacement for bad grain.

Report still choking after model cleanup? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).