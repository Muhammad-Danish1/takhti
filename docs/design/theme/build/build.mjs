// Builds the theme deliverables from tokens.mjs:
//   theme/kashi-theme.html   the live preview page
//   theme/globals.css        the tokens in shadcn/ui + Tailwind v4 form (Kashi palette)
//   theme/logo/*.svg         the logo mark
// Run: node build/build.mjs   (from the theme folder)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { css } from './color.mjs';
import { hexOf, palettes, report } from './tokens.mjs';

const failures = report();
if (failures > 0) {
  console.error(`${failures} contrast failures. Fix tokens.mjs before building.`);
  process.exit(1);
}

const here = new URL('.', import.meta.url);
const out = new URL('../', here);

// ---- preview page ---------------------------------------------------------------------------------------

const declarations = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `--${name}:${hexOf(value)}`)
    .join(';');

const kashi = palettes.kashi;
const blocks = [
  `:root{${declarations(kashi.light)}}`,
  `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${declarations(kashi.dark)};color-scheme:dark}}`,
  `:root[data-theme="dark"]{${declarations(kashi.dark)};color-scheme:dark}`,
  `body[data-mode="light"]{${declarations(kashi.light)};color-scheme:light}`,
  `body[data-mode="dark"]{${declarations(kashi.dark)};color-scheme:dark}`,
];
for (const [id, palette] of Object.entries(palettes)) {
  if (id !== 'kashi') {
    blocks.push(`body[data-palette="${id}"][data-mode="light"]{${declarations(palette.light)};color-scheme:light}`);
    blocks.push(`body[data-palette="${id}"][data-mode="dark"]{${declarations(palette.dark)};color-scheme:dark}`);
  }
  // The palette switch shows each palette's own colour whatever theme is active.
  blocks.push(`.chip-${id}{background:linear-gradient(90deg,${hexOf(palette.light.primary)} 50%,${hexOf(palette.light.brand)} 50%)}`);
}

const pages = {
  left: 'M8 16 22.5 21V40L8 35Z',
  right: 'M40 16 25.5 21V40L40 35Z',
  spark: 'M24 6 29 11 24 16 19 11Z',
};
const iconDir = new URL('../icons/', here);
const icons = readdirSync(iconDir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => {
    const source = readFileSync(new URL(file, iconDir), 'utf8');
    const path = source.match(/<path d="([^"]+)"/)?.[1];
    if (!path) throw new Error(`No path in ${file}`);
    return `<symbol id="i-${file.replace('.svg', '')}" viewBox="0 -960 960 960"><path d="${path}"/></symbol>`;
  });
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="mark" viewBox="0 0 48 48"><rect width="48" height="48" fill="var(--logo-tile)"/><path d="${pages.left}" fill="var(--logo-page-1)"/><path d="${pages.right}" fill="var(--logo-page-2)"/><path d="${pages.spark}" fill="var(--logo-spark)"/></symbol>
<symbol id="mark-bare" viewBox="0 0 48 48"><path d="${pages.left}" fill="#fff"/><path d="${pages.right}" fill="#fff" fill-opacity="0.55"/><path d="${pages.spark}" fill="#fff"/></symbol>
${icons.join('\n')}
</defs></svg>`;

const template = readFileSync(new URL('template.html', here), 'utf8');
if (!template.includes('/*@TOKENS@*/') || !template.includes('<!--@SPRITE@-->')) throw new Error('Template placeholders are missing');
const page = template.replace('/*@TOKENS@*/', blocks.join('\n')).replace('<!--@SPRITE@-->', sprite);
writeFileSync(new URL('kashi-theme.html', out), page);

// ---- globals.css for the product (Kashi only) -----------------------------------------------------------

/** shadcn/ui names that map onto ours, then our own additions. */
const shadcnExtras = (t) => ({
  'sidebar-primary-foreground': t['brand-foreground'],
  'sidebar-ring': t.ring,
});
const skip = (name) => name.startsWith('logo-');
const cssBlock = (tokens) =>
  Object.entries({ ...tokens, ...shadcnExtras(tokens) })
    .filter(([name]) => !skip(name))
    .map(([name, value]) => `  --${name}: ${css(...value)}; /* ${hexOf(value)} */`)
    .join('\n');
const themeMap = Object.keys({ ...kashi.light, ...shadcnExtras(kashi.light) })
  .filter((name) => !skip(name))
  .map((name) => `  --color-${name}: var(--${name});`)
  .join('\n');

writeFileSync(
  new URL('globals.css', out),
  `/*
 * Kashi theme for shadcn/ui on Tailwind v4.
 * Generated from theme/build/tokens.mjs - change colours there, not here.
 * Every text/background pair in this file passes WCAG AA (see the contrast report in the build).
 */
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  /* Square corners everywhere: shadcn derives every radius from this one value. */
  --radius: 0rem;

${cssBlock(kashi.light)}
}

.dark {
${cssBlock(kashi.dark)}
}

@theme inline {
  --font-sans: var(--font-plex-sans), "Segoe UI", system-ui, sans-serif;
  --font-display: var(--font-lexend), "Segoe UI", system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, Consolas, monospace;
  --font-urdu: var(--font-nastaliq), "Jameel Noori Nastaleeq", serif;

  --radius-sm: 0rem;
  --radius-md: 0rem;
  --radius-lg: 0rem;
  --radius-xl: 0rem;

${themeMap}
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    border-radius: 0;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`,
);

// ---- logo files -----------------------------------------------------------------------------------------

mkdirSync(new URL('logo/', out), { recursive: true });
const c = kashi.light;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${body}</svg>\n`;
writeFileSync(
  new URL('logo/mark.svg', out),
  svg(
    `<rect width="48" height="48" fill="${hexOf(c['logo-tile'])}"/><path d="${pages.left}" fill="${hexOf(c['logo-page-1'])}"/><path d="${pages.right}" fill="${hexOf(c['logo-page-2'])}"/><path d="${pages.spark}" fill="${hexOf(c['logo-spark'])}"/>`,
  ),
);
writeFileSync(
  new URL('logo/mark-one-colour.svg', out),
  svg(`<rect width="48" height="48" fill="${hexOf(c['logo-tile'])}"/><path d="${pages.left}" fill="#fff"/><path d="${pages.right}" fill="#fff" fill-opacity="0.55"/><path d="${pages.spark}" fill="#fff"/>`),
);

console.log(`Built kashi-theme.html (${(page.length / 1024).toFixed(0)} KB), globals.css and logo/*.svg. ${icons.length} icons.`);
