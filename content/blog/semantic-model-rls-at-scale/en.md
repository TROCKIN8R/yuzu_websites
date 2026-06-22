Row-level security breaks when headcount changes faster than your DAX. A few patterns survive reorgs and audit season.

## Pattern 1: Entra group-driven RLS

Map `USERPRINCIPALNAME()` or `USERNAME()` to a **UserAccess** table maintained by IT, not by analysts pasting emails into Excel.

Columns: UserEmail, Region, CostCenter, Role. Refresh UserAccess from HR or Entra nightly.

**DAX filter example logic:** user sees rows where `UserAccess[Region] = Sales[Region]` via relationship or `LOOKUPVALUE`.

## Pattern 2: Bridge table for many-to-many

User belongs to multiple regions or brands. Do not duplicate RLS rules per report. Use a **UserRegionBridge** table:

`UserEmail | RegionKey`

Relationship: Users → Bridge → Region dimension → Fact.

One rule scales when marketing adds a region.

## Pattern 3: Dynamic security on dimension, not fact

Apply RLS on **Region** or **Customer** tables, not on the 40M-row fact. Smaller filter context, faster queries, easier validation.

## Testing before pipeline promote

Automated minimum:

1. **Test accounts:** three Entra test users (full access, restricted, no access)
2. **View as role** in Power BI Desktop before commit
3. **XMLA script** or Tabular Editor role preview in CI for regression

In deployment pipeline Test stage, run a smoke report render per role if API allows.

## Common failures

- Hard-coded emails in DAX (`IF( user = "jane@..." )`)
- RLS on calculated columns that break query folding
- Forgetting service accounts used by subscriptions

Document break-glass admin roles separately. Auditors prefer explicit admin over hidden backdoors.

## When to escalate to object-level security

OLS on table/column for PII (salary columns, national ID). Combine with RLS: user sees region rows but not salary column at all.

Rolling out RLS on a live model used by 200 people? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
