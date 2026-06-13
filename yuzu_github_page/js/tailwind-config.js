/**
 * Yuzu.solutions — Tailwind theme bound to design tokens.
 * ---------------------------------------------------------------------------
 * Every color/font/radius/shadow points at a CSS variable defined in
 * css/design-tokens.css, so the brand palette is the single source of truth.
 *
 * Brand-named scales (yuzu / zest / kumquat / carbon / paper) are available as
 * utilities like `bg-yuzu-500` or `text-carbon-300`. The legacy Tailwind color
 * names used across the markup (yellow, lime, green, amber, orange, stone,
 * gray, neutral, zinc, red) are aliased onto the same variables so existing
 * classes render the design system without hardcoded hex values.
 */
(function () {
  var v = function (name) { return 'var(--' + name + ')'; };

  var ramp = function (base) {
    return {
      50:  v(base + '-50'),
      100: v(base + '-100'),
      200: v(base + '-200'),
      300: v(base + '-300'),
      400: v(base + '-400'),
      500: v(base + '-500'),
      600: v(base + '-600'),
      700: v(base + '-700'),
      800: v(base + '-800'),
      900: v(base + '-900'),
      950: v(base + '-950'),
    };
  };

  var yuzu    = ramp('yuzu');
  var zest    = ramp('zest');
  var kumquat = ramp('kumquat');
  var carbon  = ramp('carbon');
  var error   = ramp('error');
  var paper   = {
    50:  v('paper-50'),  100: v('paper-100'), 200: v('paper-200'),
    300: v('paper-300'), 400: v('paper-400'), 500: v('paper-500'),
    600: v('paper-600'), 700: v('paper-700'), 800: v('paper-800'),
    900: v('paper-900'),
  };

  tailwind.config = {
    theme: {
      extend: {
        colors: {
          /* Brand-named scales */
          yuzu: yuzu,
          zest: zest,
          kumquat: kumquat,
          carbon: carbon,
          paper: paper,
          ink: carbon,
          success: zest,
          warning: kumquat,
          error: error,
          info: {
            50: v('info-50'), 100: v('info-100'), 300: v('info-300'),
            500: v('info-500'), 700: v('info-700'), 900: v('info-900'),
          },

          /* Legacy Tailwind names aliased to the brand palette */
          yellow: yuzu,
          amber: kumquat,
          orange: kumquat,
          lime: zest,
          green: zest,
          stone: carbon,
          gray: carbon,
          neutral: carbon,
          zinc: carbon,
          red: error,
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
          mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        },
        borderRadius: {
          none: '0',
          sm: v('radius-sm'),
          DEFAULT: v('radius-sm'),
          md: v('radius-md'),
          lg: v('radius-md'),
          xl: v('radius-lg'),
          '2xl': v('radius-xl'),
          '3xl': v('radius-2xl'),
          full: v('radius-full'),
        },
        boxShadow: {
          sm: v('shadow-sm'),
          DEFAULT: v('shadow-md'),
          md: v('shadow-md'),
          lg: v('shadow-lg'),
          xl: v('shadow-xl'),
          '2xl': v('shadow-xl'),
          inner: 'inset 0 2px 4px rgba(45, 52, 54, 0.06)',
          none: 'none',
        },
        backgroundImage: {
          'yuzu-gradient': v('gradient-yuzu'),
        },
      },
    },
  };
})();
