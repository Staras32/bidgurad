# BidGuard Design System

A small, production component library for the BidGuard app. Every screen in
this repo (`BidGuard`, the New Project Wizard) is built exclusively from these
components plus the tokens in [`lib/design-system/tokens.ts`](../../lib/design-system/tokens.ts).

**Rule of thumb:** if you're building a new screen and reach for a raw
`<input>`, `<button>`, `<table>`, or a hex color, stop — either an existing
component already covers it, or the design system is missing something and
should be extended here rather than worked around inline.

```tsx
import { Button, Input, Card, CardContent } from '@/components/ui';
```

Everything is re-exported from `components/ui/index.ts`, so always import
from `@/components/ui`, not individual files.

---

## Tokens

Source of truth: `lib/design-system/tokens.ts`, consumed by `tailwind.config.ts`.
Never hardcode hex colors, spacing, radius, or shadow values in a component —
use the Tailwind classes these generate (`bg-primary-600`, `text-danger-700`,
`rounded-lg`, `shadow-md`, …).

| Token group | Scale | Notes |
|---|---|---|
| `colors.primary` | 50–950 | Brand/accent (indigo). Buttons, focus rings, active nav/tab state. |
| `colors.success` / `warning` / `danger` | 50–900 | Semantic status. Always pair the `-50` background with the matching `-200` border and `-700`/`-800` text — see [Semantic color usage](#semantic-color-usage). |
| `colors.gray` | 50–950 | Neutral text, borders, surfaces. |
| `colors.background` / `colors.surface` / `colors.border` | — | Page background, card surfaces, default border color. |
| `spacing` | `xs`(4px) → `5xl`(96px) | Additive aliases on top of Tailwind's numeric scale — both work. |
| `radius` | `sm`(6px) / `md`(8px) / `lg`(12px) / `xl`(16px) | Form controls (`Input`, `Badge`, `Button` sm/md) = `md`. Containers (`Card`, `FileUpload`, `Dropdown`, `EmptyState`, `Table`) = `lg`. Overlays (`Modal`) = `xl`. `Button` size `lg` = `lg`. |
| `shadows` | `sm` / `md` / `lg` | Subtle, low-contrast — this system leans on borders for separation, not heavy shadows. |

Numeric prices/scores/IDs should use `font-mono tabular-nums` (see
[Typography](#typography)) so digits align in columns — there is no separate
monospace font token, this uses the system mono stack.

---

## Components

### Button
`components/ui/Button.tsx`

```tsx
<Button variant="primary" size="md" isLoading={saving} disabled={!canSave}>
  Save
</Button>
```

- **variant**: `primary` (solid indigo, default CTA) · `secondary` (white/bordered, the default "other" action) · `ghost` (text-only, lowest emphasis — tab-like or dismissive actions) · `danger` (destructive confirmation only — not for routine delete icons, see [Icon-only actions](#icon-only-actions))
- **size**: `sm` (32px, dense contexts like table rows/cards) · `md` (36px, default) · `lg` (44px, primary page-level CTA)
- **isLoading**: shows a spinner and disables the button — use instead of manually toggling `disabled` + a spinner
- Icons go directly as children before/after the label (`<Plus size={14} /> Add`), sized ~13–16px to match text

### Input / Textarea / NumberInput / SearchInput
`components/ui/{Input,Textarea,NumberInput,SearchInput}.tsx`

```tsx
<Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
<Textarea rows={4} placeholder="Description" value={desc} onChange={...} />
```

- All four share one visual language: `h-9` (Input/NumberInput/SearchInput), white background, `border-gray-200`, `focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500`. Never restyle borders/focus rings inline — if a field needs to look different, that's a sign it needs a new shared component, not a one-off override.
- **Input**: general text entry. Supports `error`, `leftIcon`, `rightIcon`.
- **Textarea**: multi-line, resizable vertically by default (`resize-y`) — pass `className="resize-none"` for fixed-height fields (used for the paste-import box and exclusion fields in `BidGuard`).
- **NumberInput**: numeric entry with optional up/down steppers (`onStep`); `onChange` returns a plain `string`, not an event.
- **SearchInput**: adds a search icon and an optional clear (`×`) button via `onClear`.
- There is **no native-`<select>` replacement** in the system yet. Where a `<select>` is unavoidable (see `BidGuard`'s import column-mapping), match `Input`'s exact class recipe (`h-9 rounded-md border-gray-200 ... focus:ring-2 focus:ring-primary-500/40`) rather than leaving it unstyled.

### Card
`components/ui/Card.tsx`

```tsx
<Card variant="danger">
  <CardHeader>
    <CardTitle>Riskiest bid</CardTitle>
    <CardDescription>Flagged for missing scope</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

- **variant**: `default` · `hover` (adds pointer + hover elevation for clickable cards) · `selected` (primary ring — "this needs your attention / is currently active", e.g. an open import-mapping panel) · `success` / `warning` / `danger` (tint the card for severity-coded content, e.g. risk flags, scope gaps)
- Compose with `CardHeader` (title + description, bottom border), `CardContent` (body padding), `CardFooter` (top border, right-aligned actions). Skip parts you don't need — e.g. a plain data card can be just `Card > CardContent`.

### Table
`components/ui/Table.tsx`

```tsx
<Table>
  <TableHeader>
    <TableRow hover={false}>
      <TableHeadCell>Document</TableHeadCell>
      <TableHeadCell>Rows</TableHeadCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>reference-boq.xlsx</TableCell>
      <TableCell className="font-mono tabular-nums">41</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

- `Table` provides its own scroll container and outer border — don't wrap it in another bordered `Card`.
- `TableRow` defaults to `hover={true}` (row highlight on hover) for scannable data lists; pass `hover={false}` for the header row and for tables that aren't meant to feel interactive (e.g. a static review summary).
- Use `TableSortableHeadCell` instead of `TableHeadCell` for sortable columns — it already wires up the asc/desc/none chevron icon.
- Numeric columns (prices, row counts, scores) get `className="font-mono tabular-nums"` on the `TableCell`.

### Badge
`components/ui/Badge.tsx`

```tsx
<Badge variant="warning"><AlertTriangle size={11} /> Fewer rows than reference</Badge>
```

- **variant**: `success` · `warning` · `danger` · `info` · `neutral` (default — plain gray tag, e.g. a file-type label)
- For status/severity meaning, always match the semantic variant (see [Semantic color usage](#semantic-color-usage)) — never `neutral` for something that means "this is risky."
- Badges can hold an icon + short label as children (icon first, `size={11}`–`12`); they're inline (`<span>`), not interactive — for a clickable pill/toggle, build a `<button>` reusing Badge's exact class recipe (`BidGuard`'s flag agree/false-positive toggle does this).

### Alert
`components/ui/Alert.tsx`

```tsx
<Alert variant="error" title="Couldn't read this file">
  Confirm it's a valid Excel file and try again.
</Alert>
```

- **variant**: `info` · `warning` · `error` · `success` — use for page/section-level banner messages (form-wide errors, one-off warnings). For a per-row or per-card status, use `Badge` instead; for "no data yet," use `EmptyState`.
- `title` is optional — omit it for a single short sentence (e.g. a form submission error).
- Pass `onClose` to make it dismissible.

### EmptyState
`components/ui/EmptyState.tsx`

```tsx
<EmptyState title="No saved projects yet" description="Run an analysis and save it to see it here." />
```

Use for every "nothing here yet" moment (empty lists, zero search results, no history) instead of an inline `<p>` — this is what makes empty states look intentional rather than like missing content.

### FileUpload
`components/ui/FileUpload.tsx`

```tsx
<FileUpload
  accept=".xlsx,.xls,.pdf"
  onFilesSelected={(files) => handleUpload(files[0])}
/>
```

- Handles click-to-browse and drag-and-drop internally; you only get `onFilesSelected(FileList)`.
- Default label/hint are already in Lithuanian to match the product's primary language — override `label`/`hint` only when the surrounding screen is intentionally in a different language (the New Project Wizard is English by spec).
- The dropzone is spacious by default (`px-6 py-8`); for compact contexts (e.g. one FileUpload per row in a dense list), override with `className="py-3"` etc. rather than building a separate compact variant.
- There's no built-in "uploaded file" preview state — compose one from `Card`/plain markup + `Badge` + a `Trash2` remove button, matching the `UploadedFileCard` pattern in `NewProjectWizard.tsx` / the reference-doc row in `BidGuard.tsx`.

### Modal
`components/ui/Modal.tsx`

```tsx
<Modal open={open} onClose={() => setOpen(false)}>
  <ModalHeader onClose={() => setOpen(false)}>
    <ModalTitle>Delete project?</ModalTitle>
  </ModalHeader>
  <ModalBody>This can't be undone.</ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="danger" onClick={confirmDelete}>Delete</Button>
  </ModalFooter>
</Modal>
```

- Portal-rendered, traps `Escape` to close, locks body scroll while open.
- **size**: `sm` / `md` (default) / `lg`.
- Reserve for true interrupt/confirm flows (destructive confirmations, focused single-task dialogs). Don't use it for inline configuration panels that live within a step's flow — those should stay in a `Card variant="selected"` (see `BidGuard`'s import column-mapping panel), since a modal changes the interaction model (blocks the page, needs explicit dismissal) and that's a bigger UX decision than a styling choice.

### Stepper
`components/ui/Stepper.tsx`

```tsx
<Stepper steps={[{ label: 'Project' }, { label: 'Documents' }]} currentStep={1} />
```

Numbered horizontal progress indicator for multi-step flows. `currentStep` is
1-indexed; steps before it render as completed (check mark), the current one
is outlined, the rest are muted.

### Sidebar / TopNav / Dropdown / Tooltip / Skeleton
`components/ui/{Sidebar,TopNav,Dropdown,Tooltip,Skeleton}.tsx`

- **TopNav** + **TopNavItem**: horizontal tab bar for switching between top-level views within a screen (`BidGuard`'s "Nauja analizė / Projektai / Rangovų istorija" tabs).
- **Sidebar** / **MobileSidebar**: desktop rail + mobile drawer shell for app-level navigation. Not currently used (single-screen app), but available once a persistent nav is needed — don't hand-roll a sidebar.
- **Dropdown** + **DropdownItem/Label/Separator**: click-triggered popover menu (closes on outside click / `Escape`). For a native form `<select>` use case, see the [Input](#input--textarea--numberinput--searchinput) note — `Dropdown` is for action menus, not value pickers.
- **Tooltip**: hover/focus label, four sides.
- **Skeleton** / **SkeletonText** / **SkeletonAvatar** / **SkeletonCard**: loading placeholders. Use while an async result (file parsing, upload) is pending instead of a bare spinner when the eventual content has known shape.

### Typography
`components/ui/Typography.tsx`

```tsx
<Heading level={2}>Kas rasta</Heading>
<Text muted>Suvesta iš visų išsaugotų projektų.</Text>
<Text size="caption" mono>41 rows detected</Text>
```

- **Heading**: `level` 1–4 maps to fixed sizes/weights (1 = page hero, 2 = section heading, 3–4 = card/subsection headings). Use `as` to change the rendered tag without changing the visual size (e.g. a `level={2}`-styled `h3` for correct document outline).
- **Text**: `size` `body` (default) / `small` / `caption`. `muted` = secondary gray-500 copy. `mono` = tabular numeric text.
- Never hand-write `text-sm text-gray-500` etc. for prose — use `Text` so type scale changes propagate everywhere.

---

## Conventions

### Semantic color usage
Status meaning always maps to the same variant name across every component —
this is what makes the system feel coherent:

| Meaning | `Badge`/`Alert`/`Card` variant | Typical use |
|---|---|---|
| Positive / safe / baseline | `success` | Risk score ≥ 75, "matches expected scope," saved confirmation |
| Needs attention / caution | `warning` | Risk score 45–74, fewer rows than reference, unresolved notice |
| Negative / blocking / destructive | `danger` | Risk score < 45, failed upload, delete action |
| Neutral fact, no judgement | `neutral` (Badge only) / `info` (Alert) | File type tag, informational banner |

### Icon-only actions
Row-level destructive actions (remove a line item, remove a supplier, delete
a saved project) are **not** wrapped in `Button variant="danger"` — that
variant is reserved for explicit, labeled destructive confirmations. Instead
use a bare icon button with the shared hover treatment:

```tsx
<button
  onClick={remove}
  aria-label="Remove item"
  className="rounded-md p-1.5 text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-100 hover:text-danger-600"
>
  <Trash2 size={16} />
</button>
```

Always include `aria-label` since there's no visible text.

### "Add another" rows
Dashed-border affordances for adding a repeatable item (a bid, a supplier, a
line item) share one recipe:

```tsx
className="... rounded-lg border border-dashed border-gray-200 text-gray-500
  transition-colors duration-150 ease-out
  hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600"
```

Adjust layout (`flex-col` card vs. horizontal bar) to fit the context; keep
the color/border/hover recipe identical.

### Loading states
- A button-triggered async action: `Button isLoading`.
- A background read whose result has a known shape (file parsing, initial
  data fetch): `Skeleton`/`SkeletonText` in place of the eventual content.
- Never introduce a new spinner style or ad hoc `animate-pulse` div — reuse
  `Loader2` (from `lucide-react`, `className="animate-spin"`) or `Skeleton`.

---

## Where this is used

- [`components/features/BidGuard.tsx`](../features/BidGuard.tsx) — main
  analysis screen: bid entry, file/paste import, AI risk results, saved
  projects, contractor history.
- [`components/features/NewProjectWizard.tsx`](../features/NewProjectWizard.tsx) —
  4-step new project flow (project info → reference document → supplier
  quotes → review).

Both are built exclusively from this library. If you need something a screen
doesn't have yet, extend a component here (and this doc) rather than styling
around it locally.
