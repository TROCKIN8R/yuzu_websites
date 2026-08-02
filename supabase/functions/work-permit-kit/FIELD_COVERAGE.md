# Work permit kit — field coverage

Smoke: `~/.deno/bin/deno run -A supabase/functions/work-permit-kit/smoke_work.ts`

Official blanks synced via `python3 scripts/sync_ircc_forms.py --forms imm1295,imm5710,imm5488,imm5556`.
Crypto meta: `python3 scripts/ircc_form_meta.py --write`.

## Form selection

| Location | Primary | Checklist | Always |
|----------|---------|-----------|--------|
| Outside Canada | IMM 1295 | IMM 5488 | IMM 5707 |
| Inside Canada | IMM 5710 | IMM 5556 | IMM 5707 |

Optional: IMM 5476 (representative), IMM 5475 (designee), IMM 5409 (common-law). **No IMM 5646**.

## IMM 1295 (outside) — `fill_1295.ts`

Shared personal/contact/passport/education/occupation/background via IMM 1294 `buildFilledForm1` shim, then work block replace:

| Area | Tags |
|------|------|
| Permit type | `WorkPermitType` (ELMO / LMOS / OWP / Other / SAWP / SBC) |
| Employer | `EmployerName`, `Address` |
| Location | `ProvinceState` (LIC e.g. `06`), `CityTown` (LIC e.g. `3812`), `Address` |
| Job | `jobTitle`, `posDesc`, `HowLongStudy` From/To, `LMO` |
| Caregiver | `ChildCare` / `Disabled` / `Elderly` / `Other`, `noPersons` |
| QC | `CAQ` CertNum / CertExpiry when provided |

**Skipped (by design):** `CRCNum`, office-use, `AdultFlag`, barcodes, LOV containers, section header dataGroups, wet-sign / `hand` / `Signature`.

## IMM 5710 (inside) — `fill_5710.ts`

| Area | Tags |
|------|------|
| Intent | `ApplyingFor`: RestoreStat, Extend, NewEmployer, TRP |
| Identity | FamilyName, GivenName, Sex, DOB*, PlaceBirth*, Citizenship |
| Status in Canada | CurrentCOR (country defaults **511**), PCR, marital |
| Passport / phones | PassportNum, CountryofIssue, Issue/Expiry, IntlNumber, Email |
| Entry | ComingIntoCda dates/places, PurposeOfVisit, PrevDocNum |
| Work | Employer Name/Addr, Location Prov/City/Addr, Job/Desc, Duration, LMO, CAQ, ProvNominee |
| History | Education EduLine*, EmpRec1–3, background q* |

## Acrobat Validate / barcodes

Same model as the study kit:

1. Server fills encrypted XFA datasets with a DocMDP-safe incremental update (no barcode generation).
2. Applicant opens the PDF in **Adobe Acrobat / Reader** and clicks **Validate** to generate IRCC barcodes.
3. Automated smoke asserts non-empty XFA tags + round-trip decrypt; it does **not** run Acrobat Validate (AppleScript automation against Acrobat DC is unreliable in this environment).

Manual check: open `scripts/_tmp_work_fields/imm1295e-smoke-filled.pdf` and `imm5710e-smoke-filled.pdf` → Validate.

## Remaining low-priority gaps

- Checklist document rows (5488/5556): pragmatic check-all / primary-form toggles, not per-upload binding.
- Alias / previous-spouse / residential-address secondary empties when indicators are N (expected).
- Wet signature and barcode fields remain for Acrobat.
