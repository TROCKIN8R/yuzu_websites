Microsoft ships Power BI updates every month. Most of them are not migration projects. A slice of the **April through June 2026** rollouts are small, high-leverage changes you can turn on this week without replatforming your warehouse.

This article filters the [June 2026 feature summary](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264), [April 2026 summary](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-April-2026-Feature-Summary/ba-p/5173904), and related GA posts down to wins that BI admins and report authors can act on now.

## 1. Org apps with audiences (generally available)

**Org apps** are Fabric's rethink of workspace apps: multiple app items per workspace, branding, overview pages, and navigation you control. In mid-2026 they reached **general availability**, including **audiences**: one app surface, different content and nav visibility per group (execs, managers, frontline).

Why it beats "share the workspace link":

- Users discover org apps in **Recent** and item lists without a separate install step
- You can run **multiple org apps per workspace** (exec pack, ops pack) or **one app + audiences**
- Share flow lets you assign users to audiences directly when you grant access

**Small win this week:** Pick your noisiest workspace. Create one org app with two audiences (e.g. Leadership vs Analyst). Add an **Overview** landing page. Retire the "which link is official?" wiki page.

Legacy workspace apps remain supported; no forced migration. Plan new distribution on org apps.

## 2. Report landing page (generally available)

**Set as landing page** lets authors pin the page viewers should see first. Right-click a report page tab or use the page formatting pane. This shipped GA in the May 2026 wave and pairs well with org apps: the app gets you to the report; the landing page gets you to the *right* page.

**Do this on:** board packs, metric trees, and any report where page 1 is still "scratch" from 2022.

## 3. Date picker slicer (preview)

The **date picker** option for slicers (June 2026 preview) targets a boring but expensive chore: reopening reports every month to reset date ranges. You publish a **relative** default (e.g. last 12 months anchored to last data date). Viewers can still pick manual ranges from one control.

Enable under **Options > Preview features** in Desktop, then set a date column slicer to **Date picker**.

**Skip if:** you already use a robust relative date pattern in DAX and bookmarks. **Use if:** business users constantly ask why the report "stopped at last month."

## 4. DAX user-defined functions (generally available)

**DAX UDFs** graduated to GA in June 2026. Define a function once (typed signature, optional parameters), reuse across measures, columns, and visual calculations. UDFs live in the model, sync when you rename dependencies, and can be edited in **web modeling** or Desktop Model View.

Examples that pay off quickly:

- Shared currency conversion or working-day logic
- Approved margin calculations referenced by many measures
- TMDL-friendly snippets you can store in Git with the semantic model

**Team rule:** treat approved UDFs like shared libraries. PR review before adding to the golden model.

## 5. Copilot in web modeling (preview)

Also rolling out in June 2026: **Copilot in web modeling** in the Power BI service. Natural-language help to analyze model structure, rename tables/columns, add relationships, and draft measures in the browser.

**Practical guardrail:** use it in **Dev/Test** workspaces first. Let Copilot propose; humans approve before promote. Pair with Fabric Git so renames land in a PR, not silently in Prod.

## 6. Copilot on Power BI mobile (expanded)

April 2026 expanded **in-report Copilot on mobile** from canned prompts to **multi-turn chat** grounded in the open report, with **citations back to visuals**. Voice dictation on iOS speeds exec check-ins away from desk.

**Small win:** Enable on your top three mobile-heavy reports. Add one slide to the report readme: example questions that work well vs questions that need desktop.

## 7. Matrix auto-expand and date picker maintenance

Two reporting tweaks that reduce support ping-pong:

- **Matrix auto-expand (GA):** New hierarchy levels can default to expanded row/column headers. Helps **Personalize this visual** users who add fields and otherwise see collapsed empty-looking matrices.
- **Fixed size layout for card/button/list slicers (April GA):** Pixel-level control for slicer tiles when "fit to space" layouts break on dark themes or dense pages.

## 8. PBIR default-on: developer hygiene, not user-facing flash

Microsoft resumed the **PBIR (Enhanced Report Format) default-on** rollout in the service in June 2026, with Desktop default-on targeted later in the summer. PBIR aligns PBIX internals with **PBIP** for Git, CI/CD, and programmatic editing. PBIX remains the author-facing format; the swap is largely internal metadata.

**If you use PBIP + GitHub today:** keep investing. Opt in on Desktop if you have not. **If you are PBIX-only:** no user training needed; watch June/July release notes for any report-level quirks on upgrade.

**Desktop Bridge (preview)** connects agent-based report authoring to local Desktop for teams experimenting with **Fabric agent skills** for report build/validate/publish. Treat as R&D until your governance model catches up.

## 9. Azure Maps and tooltip polish (low effort, visible UX)

- **Azure Maps shape selection on by default (June GA):** Region lasso and travel-time selection show up without authors enabling controls. Turn off per visual if it clutters simple geo reports.
- **Tooltip sentence mode (June GA):** Explain metrics in plain language in the format pane without a custom tooltip page or extra DAX measure.

Confirm **Azure Maps tenant settings** if maps broke after the 2025 split controls rollout (Desktop April 2025+ required, regional processing toggles for non-US/EU tenants).

## What to defer (preview hype vs daily wins)

Build 2026 headlines (**Agent Skills end-to-end**, **Fabric Apps on semantic models**) are real but belong in a **pilot workspace** with Copilot capacity, Git, and sign-off rules. They are not "small wins" for a team still fighting refresh failures.

| Adopt now | Pilot separately |
|-----------|------------------|
| Org apps + audiences | Agent skills report authoring |
| Landing pages + overview | Fabric Apps on semantic models |
| DAX UDFs in golden model | Desktop Bridge automation |
| Date picker slicer (preview) | Fabric IQ in M365 Copilot (Frontier) |
| Mobile Copilot chat | Copilot web modeling in Prod |

## One-afternoon checklist

1. Create or upgrade one **org app** with two audiences and an Overview page
2. Set **landing page** on your top exec report
3. Enable **date picker** on one monthly ops report (preview)
4. Extract one repeated DAX pattern into a **UDF** in Dev
5. Confirm **Azure Maps** tenant settings and Desktop minimum version
6. Skim the [June 2026 summary](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264) for one GA visual tweak relevant to your brand theme (slicer icon color, bar axis padding, card hover)

These moves will not replace a Fabric migration or semantic model refactor. They cut friction while Microsoft pushes toward agentic BI, and they give your users a cleaner front door this quarter.

Want help prioritizing org app audiences or UDF standards for your golden model? [Book a 30-minute call](https://calendly.com/adrienyvin/30min).
