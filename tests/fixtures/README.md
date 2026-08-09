# BOQ parser fixtures

These files are deterministic technical fixtures, not product demo data.

## `boq-deterministic-smoke.xlsx`

- Two worksheets with independently detected headers.
- Six valid BOQ positions.
- Lithuanian decimal commas.
- Document furniture: `TVIRTINU`, `SUDERINTA`, customer and responsible-person labels.
- Section and total rows that must not become BOQ positions.

Expected result: **6 accepted BOQ rows**. All remaining non-empty document rows must be excluded with an explicit reason and source reference.
