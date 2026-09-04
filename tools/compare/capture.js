#!/usr/bin/env node
/**
 * Runtime behaviour capture. Serves a built `dist/mifosx-app`, drives it with
 * puppeteer against a fully mocked Fineract API and records, per scenario:
 *   - a full-page screenshot
 *   - a DOM summary (title, visible headings/buttons/labels/inputs, route)
 *   - console errors / failed requests
 *
 * Usage: node tools/compare/capture.js <snapshotDir> [--dist dist/mifosx-app] [--port 4300]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) || 'tools/compare/snapshots/current');
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const distDir = path.resolve(root, flag('dist', 'dist/mifosx-app'));
const port = Number(flag('port', 4300));
const apiFixtures = require('./fixtures/api');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
};

function serve(dir) {
  // Angular 17+ puts the browser bundle in dist/<app>/browser.
  const base = fs.existsSync(path.join(dir, 'browser', 'index.html')) ? path.join(dir, 'browser') : dir;
  if (!fs.existsSync(path.join(base, 'index.html'))) {
    throw new Error(`No index.html under ${dir}; build mifosx-app first`);
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(base, urlPath);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(base, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

function mockApi(page, log) {
  return page.setRequestInterception(true).then(() => {
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname === 'localhost' && url.port === String(port)) {
        return req.continue();
      }
      const apiIdx = url.pathname.indexOf('/fineract-provider/');
      if (apiIdx < 0) {
        log.blockedRequests.push(req.url());
        return req.abort();
      }
      const apiPath = url.pathname
        .slice(apiIdx + '/fineract-provider'.length)
        .replace(/^\/api\/v\d+/, '');
      const body = apiFixtures.respond(req.method(), apiPath, url.searchParams);
      log.apiCalls.push(`${req.method()} ${apiPath}`);
      return req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        body: JSON.stringify(body)
      });
    });
  });
}

const summarize = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const texts = (sel) =>
    [...document.querySelectorAll(sel)]
      .filter(visible)
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  return {
    title: document.title,
    hash: location.hash,
    headings: texts('h1,h2,h3,h4'),
    buttons: texts('button,a[mat-button],a[mat-raised-button],a[mat-icon-button]'),
    labels: texts('mat-label,label'),
    links: texts('a[href], a[routerLink]'),
    errors: texts('mat-error'),
    inputs: [...document.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .map((el) => `${el.tagName.toLowerCase()}[type=${el.type}][formcontrolname=${el.getAttribute('formcontrolname')}]`),
    disabledButtons: [...document.querySelectorAll('button')].filter(visible).filter((b) => b.disabled).map((b) => b.textContent.trim()),
    checkboxes: [...document.querySelectorAll('mat-checkbox')].filter(visible).map((c) => c.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim()
  };
};

async function settle(page) {
  // Give Angular a moment to render after navigation / async work.
  await new Promise((r) => setTimeout(r, 1500));
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve(distDir);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1']
  });
  const results = {};
  const failures = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const log = { consoleErrors: [], apiCalls: [], blockedRequests: [] };
    page.on('console', async (msg) => {
      if (msg.type() !== 'error') return;
      if (msg.text().startsWith('Failed to load resource')) return; // reported via blockedRequests
      const parts = await Promise.all(
        msg.args().map((a) =>
          a.evaluate((v) => (v instanceof Error ? `${v.name}: ${v.message}` : typeof v === 'object' ? JSON.stringify(v) : String(v))).catch(() => '?')
        )
      );
      log.consoleErrors.push((parts.length ? parts.join(' ') : msg.text()).split('\n')[0].slice(0, 300));
    });
    page.on('pageerror', (err) => log.consoleErrors.push(`pageerror: ${String(err).split('\n')[0]}`));
    await mockApi(page, log);

    const record = async (name, extra = {}) => {
      await settle(page);
      const summary = await page.evaluate(summarize);
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
      results[name] = {
        ...summary,
        ...extra,
        consoleErrors: log.consoleErrors.splice(0),
        apiCalls: log.apiCalls.splice(0),
        blockedRequests: log.blockedRequests.splice(0)
      };
      console.log(`  captured ${name}`);
    };

    const scenario = async (name, fn) => {
      console.log(`scenario: ${name}`);
      try {
        await fn();
      } catch (e) {
        failures.push({ name, error: String(e) });
        console.error(`  FAILED ${name}: ${e}`);
        await page.screenshot({ path: path.join(outDir, `${name}.failed.png`), fullPage: true }).catch(() => {});
      }
    };

    const base = `http://localhost:${port}/`;

    await scenario('login-page', async () => {
      await page.goto(`${base}#/login`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#login-form', { timeout: 30000 });
      await record('login-page');
    });

    await scenario('login-validation', async () => {
      await page.type('input[formcontrolname="username"]', 'x');
      await page.$eval('input[formcontrolname="username"]', (el) => {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.focus('input[formcontrolname="password"]');
      await page.$eval('input[formcontrolname="password"]', (el) => el.blur());
      await record('login-validation');
    });

    await scenario('login-password-toggle', async () => {
      await page.type('input[formcontrolname="password"]', 'password');
      await settle(page);
      const toggle = await page.$('button[matsuffix]');
      if (!toggle) throw new Error('password visibility toggle not rendered');
      const before = await page.$eval('input[formcontrolname="password"]', (el) => el.type);
      await toggle.hover();
      await page.mouse.down();
      await settle(page);
      const during = await page.$eval('input[formcontrolname="password"]', (el) => el.type);
      await page.mouse.up();
      await settle(page);
      const after = await page.$eval('input[formcontrolname="password"]', (el) => el.type);
      await record('login-password-toggle', { passwordInputType: { before, during, after } });
    });

    await scenario('login-submit-home', async () => {
      await page.type('input[formcontrolname="username"]', 'mifos');
      await page.click('#login-form button[type=submit], #login-form button.login-button[mat-raised-button]');
      await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 30000 });
      await page.waitForSelector('mat-toolbar, mifosx-toolbar', { timeout: 30000 });
      await record('home-after-login', {
        credentialsStored: await page.evaluate(
          () => !!(sessionStorage.getItem('mifosXCredentials') || localStorage.getItem('mifosXCredentials'))
        )
      });
    });

    await scenario('sidenav', async () => {
      const toggle = await page.$('mifosx-toolbar button[aria-label*="menu" i], mifosx-toolbar button.toggle-sidenav, mifosx-toolbar button:first-of-type');
      if (toggle) await toggle.click();
      await record('sidenav', {
        sidenavItems: await page.evaluate(() =>
          [...document.querySelectorAll('mat-sidenav a, mifosx-sidenav a, mat-nav-list a')]
            .map((a) => a.textContent.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
        )
      });
    });

    await scenario('not-found', async () => {
      await page.goto(`${base}#/this/route/does/not/exist`, { waitUntil: 'networkidle0' });
      await record('not-found');
    });

    await scenario('logout', async () => {
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
      await page.goto(`${base}#/home`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => location.hash.startsWith('#/login'), { timeout: 30000 });
      await record('redirect-to-login-when-logged-out');
    });
  } finally {
    await browser.close();
    server.close();
  }

  const meta = {
    capturedAt: new Date().toISOString(),
    angularCore: require(path.join(root, 'node_modules/@angular/core/package.json')).version,
    node: process.version,
    failures
  };
  fs.writeFileSync(path.join(outDir, 'runtime.json'), JSON.stringify({ meta, scenarios: results }, null, 2) + '\n');
  console.log(`runtime capture written to ${path.relative(root, outDir)}/runtime.json (${failures.length} failed scenarios)`);
  process.exit(failures.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
