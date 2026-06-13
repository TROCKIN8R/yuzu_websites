# Yuzu Solutions Design System

Single source of truth for the Yuzu Solutions brand. **Not deployed with the public website.**

## Files

| File | Purpose |
|------|---------|
| `handbook.html` | Interactive visual handbook — open in any browser |
| `tokens.css` | Machine-readable CSS custom properties for import into projects |
| `logo.css` | Three SVG logo lockups — mark, horizontal, stacked |
| `assets/yuzu-mark.svg` | Icon mark (Y + seeded slice) |
| `assets/yuzu-horizontal.svg` | Horizontal lockup |
| `assets/yuzu-stacked.svg` | Stacked lockup |
| `logo-declinations.html` | Palette surface tests — color overrides only |

## Logo lockups

| Lockup | File | Use |
|--------|------|-----|
| **Mark** | `assets/yuzu-mark.svg` | Favicon, avatars, compact UI |
| **Horizontal** | `assets/yuzu-horizontal.svg` | Navigation, headers |
| **Stacked** | `assets/yuzu-stacked.svg` | Footers, hero, print |

Standard colors (override via CSS only — geometry is fixed in SVG):

| Element | Token | Hex |
|---------|-------|-----|
| Text | `--logo-text` | Carbon 500 `#2D3436` |
| Slice | `--logo-slice` | Yuzu 500 `#F8C607` |
| Seeds | `--logo-seeds` | Yuzu 100 `#FEF6DA` |

```html
<link rel="stylesheet" href="path/to/yuzu_design_system/logo.css">
<a class="yuzu-logo yuzu-logo--horizontal yuzu-logo--nav" href="/">
  <object type="image/svg+xml" data="assets/yuzu-horizontal.svg" class="yuzu-logo__media"></object>
</a>
```

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
