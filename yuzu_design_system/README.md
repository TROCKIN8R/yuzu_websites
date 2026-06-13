# Yuzu Solutions Design System

Single source of truth for the Yuzu Solutions brand. **Not deployed with the public website.**

## Files

| File | Purpose |
|------|---------|
| `handbook.html` | Interactive visual handbook — open in any browser |
| `tokens.css` | Machine-readable CSS custom properties for import into projects |

## Quick start

```html
<link rel="stylesheet" href="path/to/yuzu_design_system/tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono&display=swap" rel="stylesheet">
```

## Brand palette (base values)

| Name | Token | Hex | Role |
|------|-------|-----|------|
| Electric Yuzu | `--yuzu-500` | `#F8C607` | Primary CTAs |
| Zest Green | `--zest-500` | `#86C54A` | Success / growth |
| Soft Kumquat | `--kumquat-500` | `#FF9F43` | Warnings / accents |
| Carbon Slate | `--carbon-500` | `#2D3436` | Text / structure |
| Paper White | `--paper-500` | `#F9F9F9` | Backgrounds |

Each color has seven tones: `25`, `50`, `100`, `300`, `500` (base), `700`, `900`. The `25` and `50` tints are the lightest backgrounds; `500` is the canonical brand value.

## Distribution rule

70% Paper · 15% Carbon · 10% Yuzu · 5% Accents
