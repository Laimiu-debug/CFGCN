import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { rustPalette } from './art-theme.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = 'packages/ui/src/tokens.css';
const generated = 'apps/website/public/games/xiyou/series.css';
const failures = [];
const files = [];
function walk(folder) {
  for (const entry of readdirSync(resolve(root, folder), { withFileTypes: true })) {
    if (
      ['node_modules', 'dist', 'pkg', 'assets', 'art', 'source', 'target', 'references'].includes(
        entry.name,
      )
    )
      continue;
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (/\.(?:css|tsx|ts|html|svg|rs)$/.test(path)) files.push(path);
  }
}
walk('apps');
walk('packages');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const approvedColors = new Set(
  [...read(canonical).matchAll(/#[\da-f]{3,8}\b/gi)].map((match) => match[0].toLowerCase()),
);
const definitions = new Set(['world-accent', 'card-accent']);
const sharedDefinitions = new Set(
  [...read(canonical).matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]),
);
for (const file of files.filter((f) => f.endsWith('.css') && f !== generated)) {
  for (const match of read(file).matchAll(/--([\w-]+)\s*:/g)) definitions.add(match[1]);
}
function cssErrors(source, palette = false) {
  const errors = [];
  source = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = /([\w-]+)\s*:\s*([^;{}]+)[;}]?/g;
  for (const match of source.matchAll(declarations)) {
    const [, property, value] = match;
    const colorLiteral =
      /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(value);
    if (colorLiteral && !(palette && property.startsWith('--')))
      errors.push(`${property}: literal color must use the series palette`);
    if (
      /^(?:color|background(?:-color|-image)?|border(?:-[\w-]+)?|outline(?:-[\w-]+)?|(?:box|text)-shadow|fill|stroke|accent-color)$/.test(
        property,
      ) &&
      !(palette && property.startsWith('--'))
    ) {
      const words = value.replace(/url\([^)]*\)|var\([^)]*\)/g, '').match(/[a-z][a-z-]*/gi) ?? [];
      const allowed = new Set([
        'linear-gradient',
        'radial-gradient',
        'circle',
        'ellipse',
        'conic-gradient',
        'color-mix',
        'in',
        'srgb',
        'to',
        'right',
        'left',
        'top',
        'bottom',
        'transparent',
        'currentcolor',
        'none',
        'inherit',
        'unset',
        'initial',
        'revert',
        'solid',
        'dashed',
        'dotted',
        'inset',
        'calc',
        'min',
        'max',
        'clamp',
        'center',
        'cover',
        'contain',
        'px',
        'em',
        'rem',
        'vh',
        'vw',
        'svh',
        'deg',
        'turn',
        'important',
      ]);
      if (words.some((word) => !allowed.has(word.toLowerCase())))
        errors.push(`${property}: unapproved color or color function`);
    }
    if (
      /^(?:font-family|font)$/.test(property) &&
      !['inherit', 'initial', 'unset'].includes(value.trim()) &&
      !value.includes('var(--font-') &&
      !value.includes('var(--serif)')
    )
      errors.push(`${property}: use a shared font token`);
    if (
      property === 'border-radius' &&
      !['0', '50%'].includes(value.trim()) &&
      !/var\(--series-(?:pill-)?radius\)/.test(value)
    )
      errors.push('border-radius: use a shared shape token');
  }
  return errors;
}
function jsxErrors(source, file) {
  const errors = [];
  if (file.endsWith('.html'))
    source = source.replace(
      /<meta\s+name="theme-color"\s+content="([^"]+)"\s*\/>/g,
      (tag, color) => {
        const paper = /--paper:\s*([^;]+);/.exec(read(canonical))?.[1];
        if (color !== paper) errors.push('browser theme-color must match --paper');
        return '';
      },
    );
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(tree);
      let parent = node,
        wrapper = false;
      while (parent) {
        if (
          ts.isFunctionDeclaration(parent) &&
          parent.name?.text === 'Button' &&
          file === 'packages/ui/src/index.tsx'
        )
          wrapper = true;
        parent = parent.parent;
      }
      if (name === 'button' && !wrapper)
        errors.push('native button must use the shared Button component');
      if (
        name === 'Button' &&
        node.attributes.properties.some(
          (p) => ts.isJsxAttribute(p) && p.name.getText(tree) === 'style',
        )
      )
        errors.push('Button inline styles bypass the shared variants');
      if (
        name === 'input' &&
        node.attributes.properties.some(
          (p) =>
            ts.isJsxAttribute(p) &&
            p.name.getText(tree) === 'type' &&
            /^(?:"|')(?:button|submit|reset)(?:"|')$/.test(p.initializer?.getText(tree) ?? ''),
        )
      )
        errors.push('input action must use the shared Button component');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (/['"`]#[\da-f]{3,8}\b/i.test(source))
    errors.push('inline color must reference the shared palette');
  return errors;
}
if (process.argv.includes('--self-test')) {
  for (const bad of [
    'a{color:#ff00ff;}',
    'a{background:rgb(1,2,3);}',
    'a{background:tan;}',
    'a{background:linear-gradient(pink,orange);}',
    'a{font-family:Comic Sans;}',
    'a{border-radius:28px;}',
  ])
    assert(cssErrors(bad).length > 0, `guard missed ${bad}`);
  assert.deepEqual(
    cssErrors(
      'a{color:var(--ink);background:color-mix(in srgb,var(--paper) 90%,transparent);border:1px solid var(--line);font-family:var(--font-body);border-radius:var(--series-radius);}',
    ),
    [],
  );
  assert.deepEqual(
    cssErrors(
      'a{background:radial-gradient(circle,color-mix(in srgb,var(--paper) 75%,transparent),transparent 72%);}',
    ),
    [],
  );
  assert(cssErrors('a{background:radial-gradient(ellipse,red,transparent);}').length > 0);
  assert(jsxErrors('const A=()=> <button>Go</button>;', 'apps/demo/src/A.tsx').length);
  assert(
    jsxErrors('const A=()=> <Button style={{color:"red"}}>Go</Button>;', 'apps/demo/src/A.tsx')
      .length,
  );
  assert.deepEqual(
    jsxErrors('const A=()=> <Button variant="primary">Go</Button>;', 'apps/demo/src/A.tsx'),
    [],
  );
}
for (const file of files) {
  if (file === generated) continue;
  const source = read(file);
  const errors = file.endsWith('.css')
    ? cssErrors(source, file === canonical)
    : /\.(?:tsx|ts|html)$/.test(file)
      ? jsxErrors(source, file)
      : [];
  if (file.endsWith('.css') && file !== canonical) {
    for (const match of source.matchAll(/--([\w-]+)\s*:/g)) {
      if (sharedDefinitions.has(match[1]) || /^(?:font-|series-)/.test(match[1]))
        errors.push(`shared token --${match[1]} must only be defined in ${canonical}`);
    }
  }
  if (file.endsWith('.svg'))
    for (const color of source.match(/#[\da-f]{3,8}\b/gi) ?? [])
      if (!approvedColors.has(color.toLowerCase()))
        errors.push('SVG color must come from the shared palette');
  if (file.endsWith('.rs')) {
    if (/Color::(?:srgb|linear_rgb|srgba|linear_rgba)\s*\(/.test(source))
      errors.push('runtime colors must use series_color and the shared palette');
    for (const match of source.matchAll(/series_color\("([\w-]+)"\)/g))
      if (!sharedDefinitions.has(match[1])) errors.push(`undefined renderer color --${match[1]}`);
  }
  for (const error of errors) failures.push(`${file}: ${error}`);
  for (const match of source.matchAll(/var\(--([\w-]+)/g))
    if (!definitions.has(match[1])) failures.push(`${file}: undefined design token --${match[1]}`);
}
if (!existsSync(resolve(root, generated)) || read(generated) !== read(canonical))
  failures.push(`${generated}: run npm run sync:art after editing the canonical tokens`);
const rustTheme = 'apps/xiyou/rust/src/palette.rs';
if (!existsSync(resolve(root, rustTheme)) || read(rustTheme) !== rustPalette(read(canonical)))
  failures.push(`${rustTheme}: run npm run sync:art after editing the canonical tokens`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Series art style: ${files.length} source files checked; palette, fonts, shapes, shared buttons and iframe theme agree. Visual asset review remains required.`,
  );
