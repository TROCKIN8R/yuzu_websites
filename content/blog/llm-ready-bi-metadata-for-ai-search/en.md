Search engines and LLMs do not read your DAX. They read **names, descriptions, and surrounding docs**. If metadata is empty, AI will invent definitions.

## What AI systems actually consume

| Source | Used by | Your action |
|--------|---------|-------------|
| Table/column descriptions | Copilot for Power BI, Fabric | Write plain English definitions |
| Measure names + descriptions | NLQ, agents | Avoid `Measure7`; use `Net Revenue` |
| Report titles & workspace names | Enterprise search | Consistent domain vocabulary |
| External docs (llms.txt, wiki) | LLM crawlers, RAG | Link canonical definitions |

Treat semantic model metadata like **public API docs**: precise, boring, maintained.

## Minimum metadata standard

For every certified model:

1. **Table description:** grain, source system, refresh SLA
2. **Column description:** business meaning, allowed values, PII flag
3. **Measure description:** formula intent in words, not DAX paste
4. **Synonym line:** "Also called: net sales, revenue after returns"

Copilot uses this context. So do internal GPT bots wired to your data catalog.

## llms.txt and AI SEO for BI teams

Public-facing BI guidance (blog, internal portal) should mirror model language. If the model says `Customer Lifetime Value`, your docs should not say `CLV metric v2`.

Publish a plain-text summary page listing:

- Certified datasets and what questions they answer
- Owner contact and freshness guarantees
- Links to glossary entries

Same pattern as [llms.txt for websites](https://yuzu.solutions/llms.txt) — structured, crawlable, no JavaScript required.

## Governance hook

Block promote to Prod if top measures lack descriptions. Tabular Editor scripts can export metadata to JSON for CI diff. AI quality follows metadata quality.

Want a metadata sprint on your top three models? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).