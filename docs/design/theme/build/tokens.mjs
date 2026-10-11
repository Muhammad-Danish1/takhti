// Single source of truth for every colour in the theme.
// Each token is [lightness, chroma, hue] in OKLCH. `node build/tokens.mjs` prints the contrast report.
import { contrast, hex } from './color.mjs';

const WHITE = [1, 0, 0];

/** Status colours are the same in every palette: they carry meaning, not brand. */
const status = {
  light: {
    success: [0.44, 0.115, 155],
    'success-subtle': [0.958, 0.038, 155],
    'success-border': [0.84, 0.075, 155],
    warning: [0.47, 0.11, 65],
    'warning-subtle': [0.962, 0.05, 88],
    'warning-border': [0.85, 0.105, 85],
    danger: [0.49, 0.19, 27],
    'danger-subtle': [0.958, 0.028, 20],
    'danger-border': [0.86, 0.07, 22],
    info: [0.46, 0.09, 215],
    'info-subtle': [0.958, 0.028, 210],
    'info-border': [0.85, 0.06, 208],
    destructive: [0.53, 0.21, 27],
    'destructive-foreground': WHITE,
  },
  dark: {
    success: [0.8, 0.13, 155],
    'success-subtle': [0.27, 0.05, 155],
    'success-border': [0.4, 0.075, 155],
    warning: [0.84, 0.13, 85],
    'warning-subtle': [0.28, 0.05, 80],
    'warning-border': [0.42, 0.075, 80],
    danger: [0.78, 0.13, 22],
    'danger-subtle': [0.27, 0.06, 22],
    'danger-border': [0.42, 0.1, 22],
    info: [0.8, 0.09, 210],
    'info-subtle': [0.27, 0.04, 215],
    'info-border': [0.4, 0.06, 212],
    destructive: [0.56, 0.205, 27],
    'destructive-foreground': WHITE,
  },
};

/** Chart series colours, validated with the data-viz checker against the card surface of each mode. */
const charts = {
  light: {
    'chart-1': [0.5, 0.2, 267],
    'chart-2': [0.68, 0.17, 48],
    'chart-3': [0.64, 0.115, 200],
    'chart-4': [0.76, 0.15, 85],
    'chart-5': [0.6, 0.17, 350],
  },
  dark: {
    'chart-1': [0.62, 0.17, 267],
    'chart-2': [0.66, 0.16, 48],
    'chart-3': [0.67, 0.11, 200],
    'chart-4': [0.66, 0.125, 85],
    'chart-5': [0.63, 0.16, 350],
  },
};

/**
 * A palette is described by a few choices; the rest of the tokens follow from them.
 * `p` = primary hue, `n` = hue the greys lean towards.
 */
function build({ p, n, primary, primaryDark, brand, spark, sidebar, tableHeader, logo, mono = false }) {
  const logoOn = (set) => ({
    'logo-tile': set.tile,
    'logo-page-1': set.page1,
    'logo-page-2': set.page2,
    'logo-spark': set.spark,
  });
  // The same mark sits on the dark sidebar in both modes, so its "on dark" colours are tokens too.
  const logoInv = {
    'logo-inv-tile': (logo.inv ?? logo).tile,
    'logo-inv-page-1': (logo.inv ?? logo).page1,
    'logo-inv-page-2': (logo.inv ?? logo).page2,
    'logo-inv-spark': (logo.inv ?? logo).spark,
  };
  const light = {
    background: [0.975, 0.004, n],
    foreground: [0.22, 0.035, n],
    card: WHITE,
    'card-foreground': [0.22, 0.035, n],
    popover: WHITE,
    'popover-foreground': [0.22, 0.035, n],
    primary: primary.fill,
    'primary-foreground': WHITE,
    'primary-hover': primary.hover,
    link: primary.text,
    secondary: [0.955, 0.006, n],
    'secondary-foreground': [0.22, 0.035, n],
    muted: [0.955, 0.006, n],
    'muted-foreground': [0.5, 0.025, n],
    accent: mono ? [0.945, 0.008, n] : [0.955, 0.022, p],
    'accent-foreground': mono ? [0.22, 0.035, n] : primary.text,
    border: [0.905, 0.008, n],
    'border-strong': [0.82, 0.012, n],
    input: [0.65, 0.02, n],
    ring: primary.ring,
    brand: brand.fill,
    'brand-foreground': [0.2, 0.05, n],
    'brand-text': brand.text,
    spark,
    sidebar: sidebar.base,
    'sidebar-foreground': [0.93, 0.015, p],
    'sidebar-muted': [0.72, 0.04, p],
    'sidebar-accent': sidebar.active,
    'sidebar-accent-foreground': WHITE,
    'sidebar-border': sidebar.border,
    'sidebar-primary': brand.fill,
    'table-header': tableHeader.light,
    'table-header-foreground': WHITE,
    'row-hover': mono ? [0.97, 0.005, n] : [0.972, 0.012, p],
    ...status.light,
    ...charts.light,
    'chart-grid': [0.92, 0.006, n],
    ...logoOn(logo),
    ...logoInv,
  };

  const dark = {
    background: [0.18, 0.024, n],
    foreground: [0.95, 0.008, n],
    card: [0.215, 0.03, n],
    'card-foreground': [0.95, 0.008, n],
    popover: [0.25, 0.034, n],
    'popover-foreground': [0.95, 0.008, n],
    primary: primaryDark.fill,
    'primary-foreground': primaryDark.on,
    'primary-hover': primaryDark.hover,
    link: primaryDark.text,
    secondary: [0.27, 0.035, n],
    'secondary-foreground': [0.95, 0.008, n],
    muted: [0.255, 0.03, n],
    'muted-foreground': [0.74, 0.028, n],
    accent: mono ? [0.29, 0.035, n] : [0.29, 0.075, p],
    'accent-foreground': mono ? [0.95, 0.008, n] : [0.9, 0.05, p],
    border: [0.31, 0.036, n],
    'border-strong': [0.39, 0.04, n],
    input: [0.52, 0.04, n],
    ring: primaryDark.ring,
    brand: brand.fillDark,
    'brand-foreground': [0.2, 0.05, n],
    'brand-text': brand.textDark,
    spark,
    sidebar: sidebar.baseDark,
    'sidebar-foreground': [0.93, 0.015, p],
    'sidebar-muted': [0.74, 0.04, p],
    'sidebar-accent': sidebar.activeDark,
    'sidebar-accent-foreground': WHITE,
    'sidebar-border': sidebar.borderDark,
    'sidebar-primary': brand.fillDark,
    'table-header': tableHeader.dark,
    'table-header-foreground': WHITE,
    'row-hover': mono ? [0.25, 0.03, n] : [0.25, 0.045, p],
    ...status.dark,
    ...charts.dark,
    'chart-grid': [0.3, 0.03, n],
    ...logoOn(logo.inv ?? logo),
    ...logoInv,
  };

  return { light, dark };
}

export const palettes = {
  // Recommended. Cobalt and turquoise on white: the three glazes of Multani kashi tile work.
  kashi: {
    label: 'Kashi',
    note: 'Cobalt and turquoise',
    ...build({
      p: 267,
      n: 264,
      primary: { fill: [0.45, 0.218, 267], hover: [0.39, 0.195, 267], text: [0.45, 0.218, 267], ring: [0.55, 0.2, 267] },
      primaryDark: { fill: [0.56, 0.21, 267], on: WHITE, hover: [0.5, 0.21, 267], text: [0.78, 0.12, 267], ring: [0.72, 0.15, 267] },
      brand: { fill: [0.72, 0.115, 205], text: [0.48, 0.088, 210], fillDark: [0.76, 0.12, 200], textDark: [0.82, 0.11, 200] },
      spark: [0.82, 0.16, 82],
      sidebar: {
        base: [0.22, 0.085, 267],
        active: [0.34, 0.14, 267],
        border: [0.3, 0.09, 267],
        baseDark: [0.25, 0.09, 267],
        activeDark: [0.37, 0.14, 267],
        borderDark: [0.33, 0.09, 267],
      },
      tableHeader: { light: [0.36, 0.165, 267], dark: [0.34, 0.13, 267] },
      logo: { tile: [0.45, 0.218, 267], page1: WHITE, page2: [0.72, 0.115, 205], spark: [0.82, 0.16, 82] },
    }),
  },
  // Alternative. Pakistan green with gold. Note that the primary sits close to the "paid / present" green.
  sabz: {
    label: 'Sabz',
    note: 'Emerald and gold',
    ...build({
      p: 162,
      n: 170,
      primary: { fill: [0.42, 0.1, 162], hover: [0.36, 0.088, 162], text: [0.42, 0.1, 162], ring: [0.55, 0.12, 162] },
      primaryDark: { fill: [0.52, 0.12, 162], on: WHITE, hover: [0.46, 0.11, 162], text: [0.8, 0.12, 162], ring: [0.72, 0.13, 162] },
      brand: { fill: [0.8, 0.15, 85], text: [0.5, 0.11, 75], fillDark: [0.82, 0.15, 85], textDark: [0.84, 0.14, 85] },
      spark: [0.82, 0.16, 82],
      sidebar: {
        base: [0.23, 0.045, 165],
        active: [0.34, 0.075, 162],
        border: [0.31, 0.05, 165],
        baseDark: [0.25, 0.05, 165],
        activeDark: [0.36, 0.08, 162],
        borderDark: [0.33, 0.055, 165],
      },
      tableHeader: { light: [0.35, 0.085, 162], dark: [0.34, 0.075, 162] },
      logo: { tile: [0.42, 0.1, 162], page1: WHITE, page2: [0.8, 0.15, 85], spark: [0.8, 0.15, 85] },
    }),
  },
  // Alternative. Ink only, with saffron as the single colour.
  siyahi: {
    label: 'Siyahi',
    note: 'Ink and saffron',
    ...build({
      p: 267,
      n: 267,
      mono: true,
      primary: { fill: [0.24, 0.04, 267], hover: [0.32, 0.045, 267], text: [0.3, 0.06, 267], ring: [0.5, 0.06, 267] },
      primaryDark: { fill: [0.94, 0.008, 267], on: [0.2, 0.04, 267], hover: [0.86, 0.012, 267], text: [0.9, 0.02, 267], ring: [0.8, 0.03, 267] },
      brand: { fill: [0.76, 0.165, 62], text: [0.52, 0.13, 55], fillDark: [0.78, 0.165, 62], textDark: [0.82, 0.15, 65] },
      spark: [0.76, 0.165, 62],
      sidebar: {
        base: [0.2, 0.03, 267],
        active: [0.3, 0.04, 267],
        border: [0.28, 0.035, 267],
        baseDark: [0.235, 0.035, 267],
        activeDark: [0.33, 0.045, 267],
        borderDark: [0.31, 0.04, 267],
      },
      tableHeader: { light: [0.27, 0.035, 267], dark: [0.31, 0.04, 267] },
      logo: {
        tile: [0.24, 0.04, 267],
        page1: WHITE,
        page2: [0.76, 0.165, 62],
        spark: [0.76, 0.165, 62],
        inv: { tile: [0.76, 0.165, 62], page1: [0.2, 0.04, 267], page2: WHITE, spark: [0.2, 0.04, 267] },
      },
    }),
  },
};

/** Pairs that must stay readable: [text token, background token, minimum ratio]. */
export const requirements = [
  ['foreground', 'background', 7],
  ['foreground', 'card', 7],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['link', 'card', 4.5],
  ['link', 'background', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['brand-foreground', 'brand', 4.5],
  ['brand-text', 'card', 4.5],
  ['success', 'success-subtle', 4.5],
  ['success', 'card', 4.5],
  ['warning', 'warning-subtle', 4.5],
  ['warning', 'card', 4.5],
  ['danger', 'danger-subtle', 4.5],
  ['danger', 'card', 4.5],
  ['info', 'info-subtle', 4.5],
  ['info', 'card', 4.5],
  ['sidebar-foreground', 'sidebar', 7],
  ['sidebar-muted', 'sidebar', 4.5],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['table-header-foreground', 'table-header', 4.5],
  ['input', 'card', 3],
  ['ring', 'card', 3],
  ['ring', 'background', 3],
];

export const hexOf = (triplet) => hex(...triplet);

export function report() {
  let failures = 0;
  for (const [id, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark']) {
      const t = palette[mode];
      for (const [fg, bg, min] of requirements) {
        const ratio = contrast(hexOf(t[fg]), hexOf(t[bg]));
        if (ratio < min) {
          failures += 1;
          console.log(`FAIL ${id}/${mode}  ${fg} on ${bg}: ${ratio.toFixed(2)} (needs ${min})`);
        }
      }
    }
  }
  return failures;
}
