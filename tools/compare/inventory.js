#!/usr/bin/env node
/**
 * Static inventory of the workspace: things that must not change across a
 * framework upgrade (routes, component selectors, module/component counts,
 * translation keys, public API surface of the libraries).
 *
 * Usage: node tools/compare/inventory.js <out.json>
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function walk(dir, pred, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(p, pred, out);
    } else if (pred(p)) {
      out.push(p);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function sortedUnique(arr) {
  return [...new Set(arr)].sort();
}

const projects = ['mifosx-lib', 'mifosx-app', 'fineract-client'];
const tsFiles = walk(path.join(root, 'projects'), (p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'));

const inventory = {
  projects: {},
  routes: {},
  translationKeys: {},
  publicApi: {}
};

for (const project of projects) {
  const files = tsFiles.filter((f) => rel(f).startsWith(`projects/${project}/`));
  const components = [];
  const directives = [];
  const pipes = [];
  const modules = [];
  const injectables = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/@Component\(\{[\s\S]*?selector:\s*['"`]([^'"`]+)['"`]/g)) {
      components.push(m[1]);
    }
    for (const m of src.matchAll(/@Directive\(\{[\s\S]*?selector:\s*['"`]([^'"`]+)['"`]/g)) {
      directives.push(m[1]);
    }
    for (const m of src.matchAll(/@Pipe\(\{[\s\S]*?name:\s*['"`]([^'"`]+)['"`]/g)) {
      pipes.push(m[1]);
    }
    for (const m of src.matchAll(/@NgModule\([\s\S]*?export class (\w+)/g)) {
      modules.push(m[1]);
    }
    for (const m of src.matchAll(/@Injectable\([\s\S]*?export class (\w+)/g)) {
      injectables.push(m[1]);
    }
  }
  inventory.projects[project] = {
    tsFiles: files.length,
    components: sortedUnique(components),
    directives: sortedUnique(directives),
    pipes: sortedUnique(pipes),
    modules: sortedUnique(modules),
    injectables: sortedUnique(injectables)
  };
}

// Route paths: every `path: '...'` inside *-routing.module.ts files.
for (const f of tsFiles.filter((p) => p.endsWith('-routing.module.ts'))) {
  const paths = [];
  for (const m of read(f).matchAll(/path:\s*['"`]([^'"`]*)['"`]/g)) {
    paths.push(m[1]);
  }
  inventory.routes[rel(f)] = paths;
}

// Translation keys (flattened) for each language file.
const i18nDir = path.join(root, 'projects/mifosx-app/src/assets/translations');
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.push(key);
  }
  return out;
}
if (fs.existsSync(i18nDir)) {
  for (const f of fs.readdirSync(i18nDir).filter((n) => n.endsWith('.json')).sort()) {
    const keys = flatten(JSON.parse(read(path.join(i18nDir, f))), '', []);
    inventory.translationKeys[f] = { count: keys.length, sha: hash(keys.sort().join('\n')) };
  }
}

// Library public API surface.
for (const lib of ['mifosx-lib', 'fineract-client']) {
  const api = path.join(root, `projects/${lib}/src/public-api.ts`);
  if (fs.existsSync(api)) {
    inventory.publicApi[lib] = read(api)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('export'))
      .sort();
  }
}

function hash(s) {
  return require('crypto').createHash('sha1').update(s).digest('hex');
}

const out = process.argv[2];
const json = JSON.stringify(inventory, null, 2) + '\n';
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);
  console.log(`inventory written to ${rel(out)}`);
} else {
  process.stdout.write(json);
}
