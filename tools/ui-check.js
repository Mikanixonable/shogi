#!/usr/bin/env node
'use strict';
/* フェーズ4の画面検証: ブラウザで全囲い・全戦法・分類マップを巡回し、
   JSエラー・ページのスクロール(幅980px以上では出ない)・パネルのはみ出し・周期表の列合わせを検査する。
   画面幅 1440/1280/1100/1024/390 ×ライト/ダーク のスクリーンショットを tools/shots/ に保存する。
   使い方: node tools/ui-check.js [--shots-only]  （システムの Chrome/Edge または ms-playwright の headless shell を使用） */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
const SHOTS_ONLY = process.argv.includes('--shots-only');
const WIDTHS = [1440, 1280, 1100, 1024, 390];   // 390以下はスクロール設計
const NO_SCROLL_MIN = 980;
const VIEWS = ['castle', 'tactic', 'cluster'];
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain' };

let fails = 0, passes = 0, warns = 0;
const ok = (c, name, detail) => { if (c) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? ' -- ' + detail : ''}`); } };
const warn = m => { warns++; console.log(`WARN ${m}`); };

/* ---- 簡易静的サーバ ---- */
function serve() {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, p === '/' ? 'castles.html' : p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })));
}

/* ---- ブラウザの起動（システムChrome優先、なければplaywrightキャッシュ） ---- */
async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel }); } catch (e) { /* 次へ */ }
  }
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const d of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse()) {
    const exe = path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (fs.existsSync(exe)) return chromium.launch({ executablePath: exe });
  }
  throw new Error('ブラウザが見つかりません（Chrome/Edge をインストールするか npx playwright install chromium）');
}

/* ---- ページのフック ---- */
function watch(page, errs) {
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => {
    if (new URL(r.url()).pathname === '/favicon.ico') return;   // ファビコン未指定の既定リクエスト
    if (new URL(r.url()).hostname === '127.0.0.1') errs.push(`requestfailed: ${r.url()}`);
    else warn(`外部リソース失敗: ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on('response', r => {                                   // favicon の404を無視するためレスポンス側でも除外
    if (r.status() === 404 && new URL(r.url()).pathname === '/favicon.ico') return;
    if (r.status() >= 400 && new URL(r.url()).hostname === '127.0.0.1') errs.push(`http ${r.status()}: ${r.url()}`);
  });
}

const setView = (page, v) => page.click(`#viewSeg button[data-value="${v}"]`);
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---- 巡回: 囲い（居飛車/振り飛車の両側） ---- */
async function sweepCastle(page) {
  let n = 0;
  for (const side of ['ibisha', 'furibisha']) {
    await page.click(`#sideSeg button[data-value="${side}"]`);
    await wait(150);
    const cnt = await page.$$eval('#cards .card', els => els.length);
    n += cnt;
    for (let i = 0; i < cnt; i++) { await page.locator('#cards .card').nth(i).click(); await wait(50); }
  }
  for (const v of ['all', 'core', 'dim']) await page.click(`#modeSeg button[data-value="${v}"]`);
  await page.click('#heat'); await wait(150);
  await page.click('#heatScopeSeg button[data-value="all"]'); await wait(150);
  await page.click('#heat'); await wait(150);
  await page.click('#skeleton'); await wait(150); await page.click('#skeleton');
  return n;
}

/* ---- 巡回: 戦法 ---- */
async function sweepTactic(page) {
  const n = await page.$$eval('#ptable .pt-cell', els => els.length);
  for (let i = 0; i < n; i++) { await page.locator('#ptable .pt-cell').nth(i).click(); await wait(60); } // nthで毎回引き直し（再描画対策）
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown');
  await page.click('.play-btn'); await wait(1400); await page.click('.play-btn');
  // 列合わせ: 選択中セルの中央が、主役の駒の筋の中央と一致する
  const id = await page.$eval('#ptable .pt-cell[aria-current="true"]', el => el.dataset.id);
  const file = await page.evaluate(tid => {
    const t = Kakoi.TACTICS.find(x => x.id === tid);
    return t ? Math.max(...t.lead.files) : null;
  }, id);
  const cellX = await page.$eval('#ptable .pt-cell[aria-current="true"]', el => {
    const r = el.getBoundingClientRect(); return r.left + r.width / 2;
  });
  const boardX = await page.$eval('.board', (el, f) => {
    const r = el.getBoundingClientRect();
    return r.left + r.width / 9 * (9 - f + 0.5);
  }, file);
  return { n, id, file, aligned: Math.abs(cellX - boardX) < 2.5, dx: (cellX - boardX).toFixed(2) };
}

/* ---- 巡回: 分類マップ ---- */
async function sweepCluster(page) {
  await page.click('#clChartSeg button[data-value="tree"]'); await wait(250);
  await page.click('#clChartSeg button[data-value="map"]'); await wait(250);
  const dotCount = await page.$$eval('.cl-svg .pt .dot', els => els.length);
  for (let i = 0; i < Math.min(6, dotCount); i++) {   // SVG内の点は座標クリック（g要素にヒットテストが無い）
    const b = await page.locator('.cl-svg .pt .dot').nth(i).boundingBox();
    if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await wait(60); }
  }
  const famCount = await page.$$eval('.cl-fam-h', els => els.length);
  for (let i = 0; i < famCount; i++) { await page.locator('.cl-fam-h').nth(i).click(); await wait(60); }
  for (let i = 0; i < famCount; i++) { await page.locator('.cl-fam-h').nth(i).click(); await wait(30); }
  return { dots: dotCount, fams: famCount };
}

/* ---- スクロール・はみ出し ---- */
async function checkFit(page, width) {
  const r = await page.evaluate(() => {
    const d = document.documentElement;
    const panes = [...document.querySelectorAll('.panel')].map(el => {
      const b = el.getBoundingClientRect();
      return { cls: el.className, out: b.top < -1 || b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1 };
    });
    return { sw: d.scrollWidth, sh: d.scrollHeight, iw: innerWidth, ih: innerHeight,
             overflowX: d.scrollWidth > innerWidth + 1, overflowY: d.scrollHeight > innerHeight + 1, panes };
  });
  ok(!r.overflowX, `w=${width} 横スクロールなし`, `scrollWidth=${r.sw} > ${r.iw}`);
  if (width >= NO_SCROLL_MIN) ok(!r.overflowY, `w=${width} 縦スクロールなし`, `scrollHeight=${r.sh} > ${r.ih}`);
  if (width >= NO_SCROLL_MIN) for (const p of r.panes.filter(p => p.out)) warn(`w=${width} パネルが画面外: ${p.cls}`);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, port } = await serve();
  const browser = await launch();
  const errs = [];
  try {
    const base = `http://127.0.0.1:${port}/castles.html`;
    if (!SHOTS_ONLY) {
      // ---- 巡回（1440px ライト） ----
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      watch(page, errs);
      await page.goto(base, { waitUntil: 'networkidle' });
      const cards = await sweepCastle(page);
      ok(cards === 18, '囲いカード 18枚', `${cards}`);

      await setView(page, 'tactic'); await wait(300);
      const t = await sweepTactic(page);
      ok(t.n === 12, '戦法セル 12個', `${t.n}`);
      ok(t.aligned, `周期表の列=盤の筋 (${t.id}: ${t.file}筋)`, `ずれ ${t.dx}px`);

      await setView(page, 'cluster'); await wait(400);
      const c = await sweepCluster(page);
      ok(c.dots > 0 && c.fams === 5, '分類マップの点と系統', `dots=${c.dots} fams=${c.fams}`);

      // ---- 各幅でのスクロール検査（全画面） ----
      for (const w of WIDTHS.filter(w => w >= NO_SCROLL_MIN)) {
        await page.setViewportSize({ width: w, height: 900 });
        for (const v of VIEWS) {
          await setView(page, v); await wait(250);
          const pv = `${v}@w${w}`;
          const r = await page.evaluate(() => { const d = document.documentElement; return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth }; });
          ok(r.sw <= r.iw + 1 && r.sh <= r.ih + 1, `${pv} ページスクロールなし`, `${r.sw}x${r.sh} > ${r.iw}x${r.ih}`);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await setView(page, 'castle'); await wait(250);
      await checkFit(page, 390);
      await page.close();
      ok(errs.length === 0, 'JSエラー・404なし', errs.slice(0, 5).join(' | '));
    }

    // ---- スクリーンショット ----
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage();
      await page.addInitScript(s => { try { localStorage.setItem('shogi-theme', s); } catch (e) {} document.documentElement.dataset.theme = s; }, scheme);
      watch(page, errs);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        for (const v of VIEWS) {
          await page.goto(base, { waitUntil: 'networkidle' });
          await setView(page, v); await wait(500);
          await page.screenshot({ path: path.join(SHOTS, `${v}-${w}-${scheme}.png`) });
        }
      }
      await page.close();
    }
  } finally {
    await browser.close(); srv.close();
  }
  console.log(`\n${passes} passed, ${fails} failed, ${warns} warnings → tools/shots/`);
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error('致命的:', e); process.exit(1); });
