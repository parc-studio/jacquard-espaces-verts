# Page Transition Specs

Use this folder to define transition behavior before implementation.

## Structure

- `mappings/route-matrix.md` — route-pair to transition-type mapping
- `types/_template.md` — fill-in template for a single transition type
- `types/*.md` — one file per transition type

## Minimal Format

Each transition file should only include:

- Step
- Description
- Elements
- Timing
- Easing

## Workflow

1. Fill `mappings/route-matrix.md`.
2. Fill each `types/*.md` from `types/_template.md`.
3. Keep steps short and implementation-ready.

## Notes

- Keep selectors stable and specific.
- If behavior differs by breakpoint, add separate steps.
- Current active transition types: `fade`.
- Keep `none` as the fallback/no-animation transition.
