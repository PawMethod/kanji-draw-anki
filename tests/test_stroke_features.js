/**
 * Stroke Color & Stroke Style Feature Tests
 *
 * Validates the new stroke color palette and stroke style filter features.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const c1f = fs.readFileSync(path.join(__dirname, '..', 'Templates', 'Card-1', 'FrontTemplate.html'), 'utf-8');
const c2f = fs.readFileSync(path.join(__dirname, '..', 'Templates', 'Card-2', 'FrontTemplate.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, '..', 'Templates', 'Styling.css'), 'utf-8');

let pass = 0, fail = 0, total = 0;
function test(name, fn) {
  total++;
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`); }
}

console.log('═══════════════════════════════════════════════════');
console.log('  Stroke Color & Style Feature Tests');
console.log('═══════════════════════════════════════════════════\n');

// ── 1. Stroke Color Palette ──

console.log('── 1. Stroke color palette definitions ──');

const STROKE_COLORS = ['black', 'inkblue', 'violet', 'brown', 'teal', 'slate'];
const CORRECTION_COLORS_LIGHT = ['#56a83a', '#e5a821', '#e87c2a', '#d4483b']; // green, yellow, orange, red
const CORRECTION_COLORS_DARK = ['#6abe4e', '#f0c040', '#f09840', '#e85450'];

// Extract _strokeColors from JS
function extractStrokeColors(src) {
  const match = src.match(/var _strokeColors\s*=\s*(\{[\s\S]*?\n\s{4}\});/);
  if (!match) throw new Error('Could not extract _strokeColors');
  // Convert to evaluable JS
  const obj = eval('(' + match[1] + ')');
  return obj;
}

const c1Colors = extractStrokeColors(c1f);
const c2Colors = extractStrokeColors(c2f);

for (const name of STROKE_COLORS) {
  test(`Card-1: _strokeColors has '${name}' with light/dark/guide`, () => {
    assert(c1Colors[name], `Missing ${name}`);
    assert(c1Colors[name].light, `Missing ${name}.light`);
    assert(c1Colors[name].dark, `Missing ${name}.dark`);
    assert(c1Colors[name].guide, `Missing ${name}.guide`);
    assert(c1Colors[name].guide.light, `Missing ${name}.guide.light`);
    assert(c1Colors[name].guide.dark, `Missing ${name}.guide.dark`);
  });

  test(`Card-2: _strokeColors has '${name}'`, () => {
    assert(c2Colors[name], `Missing ${name} in Card-2`);
  });

  test(`Card-1 and Card-2 '${name}' palettes match`, () => {
    assert.strictEqual(c1Colors[name].light, c2Colors[name].light);
    assert.strictEqual(c1Colors[name].dark, c2Colors[name].dark);
  });
}

// ── 2. Color Contrast with Correction Colors ──

console.log('\n── 2. Stroke colors contrast with correction indicators ──');

function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function colorDistance(hex1, hex2) {
  const a = hexToRGB(hex1), b = hexToRGB(hex2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const MIN_DISTANCE = 60; // Minimum perceptual distance to correction colors

for (const name of STROKE_COLORS) {
  const lightColor = c1Colors[name].light;
  const darkColor = c1Colors[name].dark;

  for (const corr of CORRECTION_COLORS_LIGHT) {
    test(`Light '${name}' (${lightColor}) distinguishable from correction ${corr}`, () => {
      const dist = colorDistance(lightColor, corr);
      assert(dist >= MIN_DISTANCE,
        `Distance ${dist.toFixed(0)} < ${MIN_DISTANCE} — stroke may be confused with correction`);
    });
  }

  for (const corr of CORRECTION_COLORS_DARK) {
    test(`Dark '${name}' (${darkColor}) distinguishable from correction ${corr}`, () => {
      const dist = colorDistance(darkColor, corr);
      assert(dist >= MIN_DISTANCE,
        `Distance ${dist.toFixed(0)} < ${MIN_DISTANCE} — stroke may be confused with correction`);
    });
  }
}

// ── 3. CSS Swatch Classes ──

console.log('\n── 3. CSS swatch classes ──');

for (const name of STROKE_COLORS) {
  test(`CSS has .stroke-swatch-${name}`, () => {
    assert(css.includes(`.stroke-swatch-${name}`), `Missing CSS class .stroke-swatch-${name}`);
  });

  test(`CSS has nightMode override for .stroke-swatch-${name}`, () => {
    const has = css.includes(`.nightMode .stroke-swatch-${name}`) ||
                css.includes(`.night_mode .stroke-swatch-${name}`);
    assert(has, `Missing dark mode swatch for ${name}`);
  });
}

// ── 4. Stroke Style CSS Filters ──

console.log('\n── 4. Stroke style CSS filters ──');

const STROKE_STYLES = ['gel', 'ink', 'neon'];

for (const style of STROKE_STYLES) {
  test(`CSS has .stroke-style-${style} class`, () => {
    assert(css.includes(`.stroke-style-${style}`), `Missing CSS class .stroke-style-${style}`);
  });
}

test('CSS gel style uses drop-shadow for ink bleed effect', () => {
  const match = css.match(/\.stroke-style-gel[\s\S]*?stroke-width/);
  assert(match, 'Gel style missing stroke-width');
  const match2 = css.match(/\.stroke-style-gel[\s\S]*?drop-shadow/);
  assert(match2, 'Gel style missing drop-shadow for ink bleed');
});

test('CSS ink style uses stroke-linecap square + opacity on reference paths', () => {
  const match = css.match(/\.stroke-style-ink[\s\S]*?stroke-linecap:\s*square/);
  assert(match, 'Ink style missing square linecap for calligraphic feel');
  const match2 = css.match(/\.stroke-style-ink[\s\S]*?opacity/);
  assert(match2, 'Ink style missing opacity for organic look');
});

test('CSS neon style uses double drop-shadow on reference kanji', () => {
  const match = css.match(/\.stroke-style-neon[\s\S]*?drop-shadow[\s\S]*?drop-shadow/);
  assert(match, 'Neon style missing double drop-shadow');
});

test('CSS has nightMode neon override with stronger glow', () => {
  const match = css.match(/\.nightMode[\s\S]*?\.stroke-style-neon/);
  assert(match, 'Missing dark mode neon override');
});

// ── 5. Per-path stroke style (JS) ──

console.log('\n── 5. Per-path stroke style (JS) ──');

test('Card-1 has applyPathStyle helper function', () => {
  assert(c1f.includes('applyPathStyle'), 'Missing applyPathStyle function in Card-1');
});

test('Card-1 applyPathStyle handles gel/neon/ink styles', () => {
  assert(c1f.includes("case 'gel':"), 'applyPathStyle missing gel case');
  assert(c1f.includes("case 'neon':"), 'applyPathStyle missing neon case');
  assert(c1f.includes("case 'ink':"), 'applyPathStyle missing ink case');
});

test('Card-1 applies stroke style on startDrawing', () => {
  assert(c1f.includes('applyPathStyle(currentSVGPath)'), 'startDrawing should call applyPathStyle');
});

test('Card-1 applies style with colorOverride on correction strokes', () => {
  assert(c1f.includes('applyPathStyle(currentSVGPath, colorVar)'), 'Correction should pass color to applyPathStyle');
});

test('Card-1 has ink multi-segment brush via _inkGroup', () => {
  assert(c1f.includes('_inkGroup'), 'Missing _inkGroup variable for multi-segment ink');
  assert(c1f.includes('_inkGroup.appendChild'), 'draw handler should append to _inkGroup');
});

test('CSS filters only target #svg-bg and #svg-guide (not #draw-layer)', () => {
  // Ensure no CSS filter on #draw-layer — filters are applied per-path in JS
  const drawLayerFilter = css.match(/stroke-style-(?:gel|neon|ink)\s+#draw-layer/);
  assert(!drawLayerFilter, 'CSS should not apply filters to #draw-layer (per-path in JS now)');
});

test('No feTurbulence SVG filter in templates (removed for stability)', () => {
  assert(!c1f.includes('feTurbulence'), 'Card-1 should not contain feTurbulence');
  assert(!c2f.includes('feTurbulence'), 'Card-2 should not contain feTurbulence');
});

// ── 6. Storage Keys & Settings Integration ──

console.log('\n── 6. Storage keys & settings integration ──');

test('Card-1: keyMap has strokeColor → kanjiThemeStrokeColor', () => {
  assert(c1f.includes("strokeColor: 'kanjiThemeStrokeColor'"), 'Missing strokeColor key mapping');
});

test('Card-1: keyMap has strokeStyle → kanjiThemeStrokeStyle', () => {
  assert(c1f.includes("strokeStyle: 'kanjiThemeStrokeStyle'"), 'Missing strokeStyle key mapping');
});

test('Card-2: keyMap has strokeColor', () => {
  assert(c2f.includes("strokeColor: 'kanjiThemeStrokeColor'"), 'Missing strokeColor in Card-2');
});

test('Card-2: keyMap has strokeStyle', () => {
  assert(c2f.includes("strokeStyle: 'kanjiThemeStrokeStyle'"), 'Missing strokeStyle in Card-2');
});

test('Card-1: getGlobalConfig reads --default-theme-stroke-color', () => {
  assert(c1f.includes("'--default-theme-stroke-color'"), 'Missing CSS default read for stroke color');
});

test('Card-1: getGlobalConfig reads --default-theme-stroke-style', () => {
  assert(c1f.includes("'--default-theme-stroke-style'"), 'Missing CSS default read for stroke style');
});

test('CSS defines --default-theme-stroke-color', () => {
  assert(css.includes('--default-theme-stroke-color:'), 'Missing CSS variable');
});

test('CSS defines --default-theme-stroke-style', () => {
  assert(css.includes('--default-theme-stroke-style:'), 'Missing CSS variable');
});

// ── 7. HTML Radio Buttons ──

console.log('\n── 7. HTML radio buttons ──');

for (const name of STROKE_COLORS) {
  test(`Card-1: has radio for stroke color '${name}'`, () => {
    assert(c1f.includes(`name="theme-stroke-color" value="${name}"`),
      `Missing radio for ${name} in Card-1`);
  });

  test(`Card-2: has radio for stroke color '${name}'`, () => {
    assert(c2f.includes(`name="theme-stroke-color" value="${name}"`),
      `Missing radio for ${name} in Card-2`);
  });
}

for (const style of ['standard', ...STROKE_STYLES]) {
  test(`Card-1: has radio for stroke style '${style}'`, () => {
    assert(c1f.includes(`name="theme-stroke-style" value="${style}"`),
      `Missing radio for ${style} in Card-1`);
  });

  test(`Card-2: has radio for stroke style '${style}'`, () => {
    assert(c2f.includes(`name="theme-stroke-style" value="${style}"`),
      `Missing radio for ${style} in Card-2`);
  });
}

// ── 8. applyThemeSettings applies stroke color+style ──

console.log('\n── 8. applyThemeSettings stroke application ──');

test('Card-1: applyThemeSettings sets --stroke-active', () => {
  assert(c1f.includes("setProperty('--stroke-active', sActive)"),
    'Missing --stroke-active assignment');
});

test('Card-1: applyThemeSettings sets --stroke-guide', () => {
  assert(c1f.includes("setProperty('--stroke-guide', sGuide)"),
    'Missing --stroke-guide assignment');
});

test('Card-1: applyThemeSettings toggles stroke-style-* class', () => {
  assert(c1f.includes("'stroke-style-gel', 'stroke-style-ink', 'stroke-style-neon'"),
    'Missing stroke style class removal');
});

test('Card-2: applyThemeSettings sets --stroke-active', () => {
  assert(c2f.includes("setProperty('--stroke-active', sActive)"),
    'Missing --stroke-active in Card-2');
});

test('Card-2: applyThemeSettings toggles stroke-style-* class', () => {
  assert(c2f.includes("'stroke-style-gel', 'stroke-style-ink', 'stroke-style-neon'"),
    'Missing stroke style class removal in Card-2');
});

// ── 9. Radio onchange uses correct category ──

console.log('\n── 9. Onchange handlers correctness ──');

test('Card-1: stroke color radios call strokeColor category', () => {
  const matches = c1f.match(/name="theme-stroke-color"[\s\S]*?onchange="updateThemeSetting\('strokeColor'/g);
  assert(matches && matches.length === 6, `Expected 6 strokeColor onchange, got ${matches ? matches.length : 0}`);
});

test('Card-1: stroke style radios call strokeStyle category', () => {
  const matches = c1f.match(/name="theme-stroke-style"[\s\S]*?onchange="updateThemeSetting\('strokeStyle'/g);
  assert(matches && matches.length === 4, `Expected 4 strokeStyle onchange, got ${matches ? matches.length : 0}`);
});

// ── 10. Guide color varies with stroke color ──

console.log('\n── 10. Guide color consistency ──');

for (const name of STROKE_COLORS) {
  test(`'${name}' guide is lighter than active in light mode`, () => {
    const active = hexToRGB(c1Colors[name].light);
    const guide = hexToRGB(c1Colors[name].guide.light);
    const activeLum = 0.299 * active.r + 0.587 * active.g + 0.114 * active.b;
    const guideLum = 0.299 * guide.r + 0.587 * guide.g + 0.114 * guide.b;
    assert(guideLum > activeLum,
      `Guide (${c1Colors[name].guide.light}, lum=${guideLum.toFixed(0)}) should be lighter than active (${c1Colors[name].light}, lum=${activeLum.toFixed(0)})`);
  });

  test(`'${name}' guide is darker than active in dark mode`, () => {
    const active = hexToRGB(c1Colors[name].dark);
    const guide = hexToRGB(c1Colors[name].guide.dark);
    const activeLum = 0.299 * active.r + 0.587 * active.g + 0.114 * active.b;
    const guideLum = 0.299 * guide.r + 0.587 * guide.g + 0.114 * guide.b;
    assert(guideLum < activeLum,
      `Guide (${c1Colors[name].guide.dark}, lum=${guideLum.toFixed(0)}) should be darker than active (${c1Colors[name].dark}, lum=${activeLum.toFixed(0)})`);
  });
}

// ── Summary ──

console.log('\n═══════════════════════════════════════════════════');
console.log(`  Results: ${pass}/${total} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════');

if (fail > 0) process.exit(1);
