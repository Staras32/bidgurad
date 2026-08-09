# BOQ parser fixtures

These files are deterministic technical fixtures, not product demo data.

## `boq-deterministic-smoke.xlsx`

- Two worksheets with independently detected headers.
- Six valid BOQ positions.
- Lithuanian decimal commas.
- Document furniture: `TVIRTINU`, `SUDERINTA`, customer and responsible-person labels.
- Section and total rows that must not become BOQ positions.

Expected result: **6 accepted BOQ rows**. All remaining non-empty document rows must be excluded with an explicit reason and source reference.

## `boq-text-layer-smoke.pdf`

- Real selectable text layer.
- Four valid BOQ positions in deterministic line format.
- Boilerplate, total and page furniture that must be excluded.

Expected result: **4 accepted BOQ rows**, extraction method `text`.

## `boq-image-only-ocr-smoke.pdf`

- Image-only PDF with no selectable text layer.
- Four valid positioned BOQ rows and stable reference anchors.
- Forces the OCR path before table reconstruction.

Expected result: **4 accepted BOQ rows**, extraction method `ocr`.
