# Transition Type: `none`

Status: `active`

## Steps

| Step | Description                                             | Elements | Timing | Easing |
| ---- | ------------------------------------------------------- | -------- | ------ | ------ |
| 1    | Skip exit animation and swap immediately.               | n/a      | `0ms`  | `none` |
| 2    | Render destination immediately with no enter animation. | n/a      | `0ms`  | `none` |

## Notes

- From route(s): any
- To route(s): any
- Trigger: `navigate(info: "skip")` or explicit override
- Mobile/desktop differences: none
- Reduced motion: same behavior

## Questions

-
