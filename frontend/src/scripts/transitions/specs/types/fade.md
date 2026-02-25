# Transition Type: `fade`

Status: `active`

## Steps

| Step | Description                                          | Elements | Timing  | Easing         |
| ---- | ---------------------------------------------------- | -------- | ------- | -------------- |
| 1    | Fade out current page content.                       | `<main>` | `400ms` | `power3.inOut` |
| 2    | DOM swap occurs (handled by Astro View Transitions). | n/a      | `0ms`   | n/a            |
| 3    | Fade in new page content.                            | `<main>` | `400ms` | `power3.inOut` |

## Notes

- From route(s): `*` (default fallback)
- To route(s): `*`
- Trigger: `auto`
- Mobile/desktop differences: none
- Reduced motion: duration reduced to `180ms`, no slide

## Questions

-
