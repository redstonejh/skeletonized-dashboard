# CSS Tokenization Plan

Scope: tokenization-only value substitutions in `app/static/themes.css` and `app/static/dashboard-grid.css`, with new aliases in `app/static/tokens.css`.

Safe substitutions applied:

| Token | Value | Replaced declarations |
|---|---:|---:|
| `--radius-pill` | `999px` | `border-radius: 999px` |
| `--space-4` | `4px` | `gap: 4px` |
| `--space-5` | `5px` | `gap: 5px` |
| `--space-6` | `6px` | `gap: 6px` |
| `--space-8` | `8px` | `gap: 8px` |

No selectors, media queries, `!important` flags, or cascade order were edited. Existing captured custom properties were not rewritten.
