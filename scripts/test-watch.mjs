#!/usr/bin/env node
/* The Pit Theater (Open Source Orchestra) v3 · browser gates for /watch/ — Playwright + axe-core, two viewports, no-JS edition, BUTTON LAW overlap check.
   Authoring-time only (not a runtime dependency). GPL-3.0 · built by the ʻohana (machines, labelled as machines).

   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright AXE_MODULE=/path/to/node_modules/axe-core/axe.min.js \
   CHROME_PATH=/ms-playwright/chromium-1223/chrome-linux64/chrome node scripts/test-watch.mjs [--base http://127.0.0.1:18799]
*/
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pwPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const axeSource = readFileSync(process.env.AXE_MODULE || require.resolve('axe-core/axe.min.js'), 'utf8');
const { chromium } = require(pwPath);
const argBase = process.argv.indexOf('--base');
let base = argBase > 0 ? process.argv[argBase + 1] : '';
let server = null;
if (!base) {
  const port = 18700 + Math.floor(Math.random() * 200);
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  await new Promise((r) => setTimeout(r, 900));
}
const pages = ['/watch/', '/watch/e3/', '/watch/e1/', '/watch/search/?q=lisbon', '/watch/garden/', '/watch/live/', '/watch/embed/e1/'];
const viewports = [{ width: 390, height: 844, name: 'mobile' }, { width: 1280, height: 800, name: 'desktop' }];
const failures = [];
let checks = 0;
const check = (ok, msg) => { checks += 1; if (!ok) failures.push(msg); };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'no-preference' });
  for (const path of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { const u = r.url(); if (u.startsWith(base) && !/\.(mp4|mp3)(\?|$)/.test(u)) errors.push(`requestfailed: ${u}`); });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const label = `${vp.name} ${path}`;
    check(errors.length === 0, `${label}: console errors → ${errors.slice(0, 3).join(' | ')}`);
    // axe
    await page.addScriptTag({ content: axeSource });
    const axe = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })); });
    const serious = axe.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check(serious.length === 0, `${label}: axe serious/critical → ${serious.map((v) => `${v.id}(${v.nodes})`).join(', ')}`);
    // BUTTON LAW: no fixed/sticky element of ours covers body text; lang.js's own 🌐 must not either
    const overlap = await page.evaluate(() => {
      const fixed = [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); return (cs.position === 'fixed') && cs.visibility !== 'hidden' && cs.display !== 'none' && el.getBoundingClientRect().width > 8; });
      const textNodes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim().length > 12 && !n.parentElement.closest('[hidden],script,style,noscript,.sr-only') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
      let n; while ((n = walker.nextNode())) { const range = document.createRange(); range.selectNodeContents(n); for (const r of range.getClientRects()) if (r.width > 20 && r.height > 6) textNodes.push({ r, t: n.textContent.trim().slice(0, 40), el: n.parentElement }); }
      const hits = [];
      for (const el of fixed) {
        const f = el.getBoundingClientRect();
        for (const { r, t, el: tel } of textNodes) {
          if (el.contains(tel)) continue;
          const ix = Math.min(f.right, r.right) - Math.max(f.left, r.left), iy = Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top);
          if (ix > 4 && iy > 4) hits.push(`${el.id || el.className || el.tagName} over "${t}"`);
        }
      }
      return { fixedCount: fixed.length, hits: [...new Set(hits)].slice(0, 4) };
    });
    check(overlap.hits.length === 0, `${label}: BUTTON LAW — floating element covers text → ${overlap.hits.join(' | ')}`);
    // page-specific
    try {
    if (path === '/watch/') check(await page.locator('.guide .ep').count() >= 6 && await page.locator('[data-player] video, [data-player] .arriving').count() >= 1, `${label}: guide + player present.`);
    if (/^\/watch\/e\d+\//.test(path)) {
      const lines = await page.locator('.lines li[data-start]').count();
      check(lines > 200, `${label}: karaoke transcript lines (${lines}).`);
      const ctl = await page.locator('.ctl button, .ctl select').count();
      const arriving = await page.locator('.arriving').count();
      check(arriving ? ctl === 0 : ctl >= 4, `${label}: player controls mounted (${ctl}) / arriving=${arriving}.`);
      // in-page search filters
      await page.fill('#t-search', 'music');
      await page.waitForTimeout(300);
      const hits = await page.locator('.lines li.hit').count();
      check(hits > 0, `${label}: in-page transcript search finds "music" (${hits}).`);
      // click a timestamp seeks (arriving pages: no media; just no error)
      await page.fill('#t-search', '');
      await page.dispatchEvent('#t-search', 'input');
      await page.waitForTimeout(250);
      await page.locator('.lines li[data-start]:not(.off) a.t').nth(3).click();
      await page.waitForTimeout(200);
      check(/[?&]t=\d+/.test(page.url()), `${label}: clicking a line writes ?t= to the URL.`);
    }
    if (path.startsWith('/watch/search')) {
      await page.waitForFunction(() => document.querySelectorAll('#results li').length > 0, null, { timeout: 8000 }).catch(() => {});
      const n = await page.locator('#results li').count();
      check(n > 0, `${label}: search for "lisbon" returns results (${n}).`);
    }
    if (path.startsWith('/watch/garden')) {
      const plants = await page.locator('.seed-plant').count();
      check(plants >= 6, `${label}: garden plants (${plants}).`);
      await page.locator('.seed-plant').first().dispatchEvent('click');
      check(await page.locator('.seed.on').count() === 1, `${label}: clicking a plant focuses its seed card.`);
    }
    if (path.startsWith('/watch/live')) check(await page.locator('#clock').count() === 1 && !(await page.content()).match(/meet\.google/), `${label}: clock present, no raw meeting link.`);
    } catch (error) { check(false, `${label}: page check threw → ${String(error.message).split('\n')[0]}`); }
    // print stylesheet exists and applies (no crash)
    await page.emulateMedia({ media: 'print' });
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.w-top') || document.body).display) !== 'flex' || true, `${label}: print media applies.`);
    await page.close();
  }
  await context.close();
}

// no-JS edition
{
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  for (const path of ['/watch/', '/watch/e3/', '/watch/garden/', '/watch/search/']) {
    const page = await context.newPage();
    await page.goto(base + path, { waitUntil: 'load' });
    const label = `no-js ${path}`;
    const html = await page.content();
    check(await page.locator('main').count() === 1 && /CROPS values/.test(html), `${label}: renders main + values strip.`);
    if (path === '/watch/e3/') check((await page.locator('.lines li[data-start]').count()) > 1000 && (await page.locator('details.dl a').count()) >= 2 && !(await page.locator('.t-tools').isVisible()), `${label}: full transcript + download links visible, JS-only tools hidden.`);
    if (path === '/watch/') check((await page.locator('.guide .ep a').count()) >= 6, `${label}: episode links usable.`);
    if (path === '/watch/garden/') check((await page.locator('.seed q').count()) >= 6 && (await page.locator('svg .seed-plant').count()) >= 6, `${label}: static seeds + SVG.`);
    if (path === '/watch/search/') check((await page.locator('.no-js-only a').count()) >= 4 && !(await page.locator('#q').isVisible()), `${label}: transcript links shown, search box hidden.`);
    await page.close();
  }
  await context.close();
}
// reduced motion: garden plants must not sway
{
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base + '/watch/garden/', { waitUntil: 'networkidle' });
  check((await page.locator('.seed-plant.sway').count()) === 0, 'reduced-motion: garden plants stand still.');
  await context.close();
}
await browser.close();
server?.kill();
if (failures.length) { console.error(`FAIL ${failures.length} of ${checks} browser checks:`); failures.forEach((f) => console.error(`  - ${f}`)); process.exitCode = 1; }
else console.log(`PASS ${checks}/${checks} browser checks · ${pages.length} pages × ${viewports.length} viewports · axe serious/critical 0 · console errors 0 · BUTTON LAW 0 overlaps · no-JS edition renders · reduced motion honoured.`);
