# Route Matrix

Status: `active`

Map route pairs to transition types.

## Mapping

| From route pattern | To route pattern | Transition type | Trigger (`auto` / `navigate(info)`) | Notes    |
| ------------------ | ---------------- | --------------- | ----------------------------------- | -------- |
| `*`                | `*`              | `fade`          | `auto`                              | default  |
| any                | any              | `none`          | `navigate(info: "skip")`            | explicit |

## Questions

-
