#!/usr/bin/env node
'use strict';
/* 統合画面の検証: ブラウザで「盤」「分類マップ」を巡回し、
   JSエラー・ページのスクロール(幅980px以上では出ない)・制約の追加/削除/連鎖・
   周期表の出し分け・相手の駒の有無・ハッシュの往復を検査する。
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
const VIEWS = ['board', 'cluster'];
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain' };

let fails = 0, passes = 0, warns = 0;
const ok = (c, name, detail) => { if (c) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? ' -- ' + detail : ''}`); } };
const warn = m => { warns++; console.log(`WARN ${m}`); };

/* ---- 簡易静的サーバ ---- */
function serve() {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
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
// ?debug で立つ window.__kakoi 経由の状態スナップショット
const snap = page => page.evaluate(() => {
  const st = __kakoi.store.state;
  return {
    constraints: st.constraints, selected: st.selected, view: st.view,
    sides: Kakoi.constraints.sides(st.constraints),
    chips: [...document.querySelectorAll('#cbarOpp .cchip, #cbarMe .cchip')].map(c =>
      ({ who: c.dataset.who, kind: c.dataset.kind, implied: c.dataset.implied === 'true', text: c.textContent.trim() })),
    gote: document.querySelectorAll('#board .pc[data-owner="gote"]').length,
    canvas: !!document.querySelector('#board canvas'),
    threats: document.querySelectorAll('#board .ov-threat').length,
    ptableOn: document.querySelector('#boardwrap').dataset.pt === 'on',
    ptCells: document.querySelectorAll('#ptable .pt-cell').length,
    // 右ドックは BoardDetailView が .bd-h/.bd-who に「自分（先手）の囲い」のように出す
    detailKind: (document.querySelector('#detail .bd-who') || {}).textContent || '',
    hash: location.hash,
  };
});

/* ---- 巡回: 盤（統合画面） ---- */
async function sweepBoard(page) {
  const r = {};
  r.t0 = await snap(page);
  // 左ドック: 上=相手（いない時は追加ボタンのみ）・下=自分（既定は囲いタブ）
  r.panes = await page.$$eval('#pickRail .dk-pane', els => els.length);
  r.oppEmpty = await page.$eval('#pickRail .dk-pane[data-who="opp"]', el => el.dataset.empty === 'true');
  r.sepHidden0 = await page.$eval('#pickRail .dk-sep', el => el.hidden);
  r.cards = await page.$$eval('#pickRail .dk-pane[data-who="me"] .dk-card', els => els.length);
  r.fams = await page.$$eval('#pickRail .dk-pane[data-who="me"] .dk-fam', els => els.length);
  r.segs = await page.$$eval('#pickRail .dk-strategy button[data-value]', els => els.length);
  // 系統ブロックの折りたたみ
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fam-h'); await wait(120);
  r.collapse = await page.$eval('#pickRail .dk-pane[data-who="me"] .dk-fam',
    el => el.dataset.closed === 'true' && el.querySelector('.dk-fam-h').getAttribute('aria-expanded') === 'false');
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fam-h'); await wait(120);
  // アコーディオン: 自分の面を畳む→ヘッダだけ（closed）。開き直す
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fold'); await wait(200);
  r.foldMe = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.closed === 'true'
    && __kakoi.store.state.dock.me.open === false);
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fold'); await wait(200);
  r.unfoldMe = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.closed === 'false');

  // 「相手を加える」→ 相手の制約が増え、上の面が開いて戦法タイルが出る
  await page.click('#pickRail .dk-addopp'); await wait(400);
  r.t5 = await snap(page);
  r.opp = !!r.t5.sides.opp && r.t5.constraints.some(e => e.who === 'opp');
  r.oppShown = r.t5.canvas || r.t5.gote > 0;
  r.oppPaneOpen = await page.$eval('#pickRail .dk-pane[data-who="opp"]', el => el.dataset.closed === 'false');
  r.items = await page.$$eval('#pickRail .dk-item', els => els.length);
  r.tiles = await page.$$eval('#pickRail .dk-pane[data-who="opp"] .dk-tile', els => els.length);
  r.vars = await page.$$eval('#pickRail .dk-pane[data-who="opp"] .dk-var', els => els.length);
  // 相手の面は筋が反転: 四間飛車（先手6筋の戦法）は盤の4筋=グリッド列6に置かれる
  r.flipCol = await page.evaluate(() => {
    const t = document.querySelector('#pickRail .dk-pane[data-who="opp"] .dk-tile[data-id="shikenbisha"]');
    const cell = t && t.closest('.dk-cell');
    return cell ? getComputedStyle(cell).gridColumnStart : null;
  });
  // スプリッタ（両面が開いている時だけ出る）: ↑↓キーで比率が5%刻みで動く
  r.sep = await page.evaluate(() => {
    const s = document.querySelector('#pickRail [role="separator"]');
    return s && !s.hidden ? { orient: s.getAttribute('aria-orientation'), now: +s.getAttribute('aria-valuenow'), tab: s.tabIndex } : null;
  });
  await page.focus('#pickRail .dk-sep');
  const sp0 = await page.evaluate(() => __kakoi.store.state.dock.split);
  await page.keyboard.press('ArrowDown'); await wait(150);
  r.splitKey = await page.evaluate(s => Math.abs(__kakoi.store.state.dock.split - (s + .05)) < 1e-6, sp0);
  await page.keyboard.press('ArrowUp'); await wait(150);
  r.splitBack = await page.evaluate(s => Math.abs(__kakoi.store.state.dock.split - s) < 1e-6, sp0);

  // 囲いを選ぶ → 制約が増え、チップが現れ、詳細が囲いになる
  const before = await page.evaluate(() => __kakoi.store.state.constraints.length);
  await page.click('#pickRail .dk-item[data-who="me"][data-kind="castle"]'); await wait(350);
  r.t1 = await snap(page);
  r.added = r.t1.constraints.length === before + 1
    && r.t1.constraints.some(e => e.who === 'me' && e.kind === 'castle')
    && r.t1.selected === 'me.castle' && r.t1.detailKind.includes('囲い');

  // 戦法を選ぶ: 下面を戦法タブに切り替えてからタイルを押す → 周期表が出る。selected=me.tactic
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="tactic"]'); await wait(250);
  r.tabSwitch = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.tab === 'tactic'
    && document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-tile').length > 0);
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tile[data-who="me"]'); await wait(350);
  r.t2 = await snap(page);
  r.ptOn = r.t2.ptableOn && r.t2.selected === 'me.tactic' && r.t2.detailKind.includes('戦法');
  // 筋ボタン（周期表のセル）を押す → その側の戦法が変わる
  const cells = r.t2.ptCells;
  if (cells > 1) {
    await page.locator('#ptable .pt-cell').nth(1).click(); await wait(350);
  }
  r.t3 = await snap(page);
  r.ptPick = r.t3.ptableOn && r.t3.selected === 'me.tactic' && r.t3.constraints.some(e => e.kind === 'tactic');
  // 囲いを選び直す → 周期表が消える（selected だけの変更で駒は再描画されない構造）
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="castle"]'); await wait(250);
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-card[data-who="me"]'); await wait(350);
  r.t4 = await snap(page);
  r.ptOff = !r.t4.ptableOn;

  // 相手の戦法タイルを押す → 相手の戦法制約＋導出ラベル・脅威の帯が出る
  await page.click('#pickRail .dk-pane[data-who="opp"] .dk-tile'); await wait(400);
  r.t5b = await snap(page);
  r.labels = r.t5b.chips.some(c => c.text.startsWith('#') && !c.kind);
  r.threatOn = r.t5b.threats >= 1;
  // 相手の戦法を選択すると周期表が反転して出る（data-side="opp"）
  r.oppTable = await page.evaluate(() => {
    const el = document.querySelector('#ptable');
    return document.querySelector('#boardwrap').dataset.pt === 'on' && el.dataset.side === 'opp';
  });
  // 脅威の帯スイッチを切る → 帯が消える
  await page.click('#threatSw'); await wait(300);
  r.t6 = await snap(page);
  r.threatOff = r.t6.threats === 0;
  await page.click('#threatSw'); await wait(300);

  // 連鎖: cascade のある候補を選ぶと自動差し替えが起き、トーストが出る
  r.toast = '';
  r.badges = await page.$$eval('#pickRail .dk-item[data-cascade="true"], #pickRail .dk-item[data-vs="good"], #pickRail .dk-item[data-vs="bad"]', els => els.length);
  const csc = await page.$('#pickRail .dk-pane[data-who="me"] .dk-item[data-cascade="true"]')
    || await page.$('#pickRail .dk-item[data-cascade="true"]');
  r.cascadeTried = !!csc;
  let preList = null;
  if (csc) {
    preList = await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await csc.click(); await wait(400);
    r.toast = await page.evaluate(() => (document.querySelector('.toast.on') || {}).textContent || '');
    r.t7 = await snap(page);
  }
  // 「元に戻す」でクリック前の制約リストに戻る
  r.undo = null;
  if (r.toast) {
    await page.click('.toast .toast-act'); await wait(300);
    r.undo = await page.evaluate(l => ({
      sameAsPrev: JSON.stringify(__kakoi.store.state.constraints) === l,
      toastGone: !document.querySelector('.toast.on'),
    }), preList);
  }

  // × で制約を外す（相手のバーの1つ。自分側は暗黙が残るので消しても盤は壊れない）
  const xCount = await page.$$eval('#cbarOpp .cchip-x', els => els.length);
  if (xCount) {
    const n0 = await page.evaluate(() => __kakoi.store.state.constraints.length);
    await page.locator('#cbarOpp .cchip-x').last().click(); await wait(300);
    r.removed = await page.evaluate(n => __kakoi.store.state.constraints.length === n - 1, n0);
  }
  // 相手を全部はずす → 後手の駒と脅威の帯が退く（直前の × で相手が空になった場合に備えて足しておく）
  await page.click('#pickRail .dk-pane[data-who="opp"] .dk-strategy button[data-value]').catch(() => {});
  await wait(350);
  const clearBtn = await page.$('#pickRail [data-clear="opp"]');
  if (clearBtn && await clearBtn.isVisible()) {
    await clearBtn.click(); await wait(400);
    r.t8 = await snap(page);
    r.oppGone = r.t8.sides.opp === null && r.t8.threats === 0 && (r.t8.canvas || r.t8.gote === 0);
  } else {
    r.oppGone = null;
  }

  // 矢印キー: 戦法を選択しているとき ←→ で戦法が送れる（制約バーのチップで selected を戦法にする）
  const meTacticChip = await page.$('#cbarMe .cchip-b[data-who="me"][data-kind="tactic"]');
  if (meTacticChip) {
    await meTacticChip.click();
  } else {
    await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="tactic"]'); await wait(200);
    await page.click('#pickRail .dk-pane[data-who="me"] .dk-item[data-who="me"][data-kind="tactic"]');
  }
  await wait(300);
  const tId0 = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  await page.keyboard.press('ArrowRight'); await wait(250);
  const tId1 = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  r.keyNav = tId0 !== tId1;

  // ハッシュ往復: いまのハッシュで開き直すと同じ制約・選択になる
  const cur = await page.evaluate(() => ({
    hash: location.hash,
    constraints: JSON.stringify(__kakoi.store.state.constraints),
    selected: __kakoi.store.state.selected,
  }));
  r.hashFormat = /^#v=board&k=/.test(cur.hash) || /^#v=board/.test(cur.hash);
  // hash だけの遷移では再読み込みされないので、ダミーのクエリを足して実際に開き直す
  await page.goto(page.url().split('#')[0] + '&rt=1' + cur.hash, { waitUntil: 'networkidle' });
  await wait(400);
  const back = await page.evaluate(() => ({
    constraints: JSON.stringify(__kakoi.store.state.constraints),
    selected: __kakoi.store.state.selected,
  }));
  r.hashRoundTrip = back.constraints === cur.constraints && back.selected === cur.selected;
  return r;
}

/* ---- 巡回: 分類マップ ---- */
async function sweepCluster(page) {
  const dotCount = await page.$$eval('.cl-svg .pt .dot', els => els.length);   // 木の図の葉（.pt .dot）
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
    const base = `http://127.0.0.1:${port}/index.html`;
    const baseDebug = `${base}?debug`;
    if (!SHOTS_ONLY) {
      // ---- 巡回（1440px ライト。?debug で window.__kakoi を立てて状態を見る） ----
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      watch(page, errs);
      // 保存値に左右されないよう、このページの localStorage を空にしてから開く
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(baseDebug, { waitUntil: 'networkidle' });
      // 期待件数はデータから導出する（追加のたびに書き換えない）
      const expect = await page.evaluate(() => ({
        castles: Kakoi.CASTLES.length,
        tactics: Kakoi.TACTICS.length,
        fams: Kakoi.CASTLE_FAMILIES.length,
        famsUsed: new Set(Kakoi.CASTLES.map(c => c.family)).size,
        tacticTiles: Kakoi.TACTICS.filter(t => !t.variantOf).length,   // 派生は親タイルのチップに束ねる
        tacticVars: Kakoi.TACTICS.filter(t => !!t.variantOf).length,
      }));

      const b = await sweepBoard(page);
      ok(b.panes === 2, '左ドックは上下2面（上=相手・下=自分）', `${b.panes}面`);
      ok(b.oppEmpty, '相手がいないとき上の面は選択UIを出さない', '');
      ok(b.sepHidden0, '片方だけの時はスプリッタを出さない', '');
      ok(b.foldMe && b.unfoldMe, '面を畳んで開き直せる（アコーディオン）', `fold=${b.foldMe} unfold=${b.unfoldMe}`);
      // 上下に積む面の区切りバーは横方向の separator（ARIA の separator は自身の向きを示す）
      ok(b.sep && b.sep.orient === 'horizontal' && b.sep.tab === 0 && b.sep.now >= 20 && b.sep.now <= 80,
        'ドックのスプリッタ（role=separator + aria）', JSON.stringify(b.sep));
      ok(b.items === expect.tactics + expect.castles, '左ドックの選択肢（戦法タイル＋派生チップ＋囲いカード）', `${b.items}件`);
      ok(b.tiles === expect.tacticTiles && b.vars === expect.tacticVars,
        '戦法タイル（1マス1タイル＋派生はチップ）', `tiles=${b.tiles} vars=${b.vars}`);
      ok(b.cards === expect.castles, '囲いタイル', `${b.cards}枚`);
      ok(b.fams === expect.famsUsed, '囲いのクラスタ見出し（系統ごと）', `${b.fams}系統`);
      ok(b.segs === 4, '戦略セグは各面に常時表示', `${b.segs}個`);
      ok(b.flipCol === '6', '相手の面は筋が反転（四間飛車=盤の4筋の列）', `列=${b.flipCol}`);
      ok(b.collapse, '系統ブロックを折りたためる', '');
      ok(b.splitKey && b.splitBack, 'スプリッタを↑↓キーで5%刻みに動かせる', `down=${b.splitKey} up=${b.splitBack}`);
      ok(b.tabSwitch, '面のタブ切替（囲い→戦法）', '');
      ok(b.added, '囲いを選ぶ→制約とチップが増える', JSON.stringify(b.t1 && b.t1.constraints));
      ok(b.ptOn, '戦法を選ぶ→筋ボタン（周期表）が出る', `ptableOn=${b.t2.ptableOn} sel=${b.t2.selected}`);
      ok(b.ptPick, '筋ボタンで選択中の側の戦法が変わる', JSON.stringify(b.t3 && b.t3.selected));
      ok(b.ptOff, '囲いを選ぶ→筋ボタンが消える', `ptableOn=${b.t4.ptableOn}`);
      ok(b.opp && b.oppShown && b.oppPaneOpen, '「相手を加える」→後手の駒と相手の面が出る', `sides.opp=${!!(b.t5 && b.t5.sides.opp)} gote=${b.t5 && b.t5.gote} open=${b.oppPaneOpen}`);
      ok(b.threatOn, '相手がいると脅威の帯が出る', `${b.t5b && b.t5b.threats}本`);
      ok(b.labels, '制約バーに導出ラベル（戦型）が出る', JSON.stringify(b.t5b && b.t5b.chips.filter(c => !c.kind)));
      ok(b.oppTable, '相手の戦法を選択→周期表は相手側（反転）', '');
      ok(b.badges > 0, 'タイルに2軸バッジ（cascade か ◎/△）が出る', `${b.badges}件`);
      ok(b.threatOff, '脅威の帯スイッチで帯を消せる', `${b.t6 && b.t6.threats}本`);
      if (!b.cascadeTried) warn('連鎖のある候補が見つからず、自動差し替えトーストを試せなかった');
      else {
        ok(b.toast.length > 0, '連鎖選択で自動差し替えトースト', b.toast.slice(0, 60));
        ok(b.undo && b.undo.sameAsPrev && b.undo.toastGone, '「元に戻す」で制約リストが戻る', JSON.stringify(b.undo));
      }
      ok(b.removed !== false, '×で制約を外せる', '');
      if (b.oppGone == null) warn('「はずす」ボタンが見つからなかった');
      else ok(b.oppGone, '「はずす」で相手の駒と帯が退く', JSON.stringify(b.t8 && b.t8.sides.opp));
      ok(b.keyNav, '矢印キーで戦法を送れる', '');
      ok(b.hashFormat, 'ハッシュは新形式（v=board&k=…）', '');
      ok(b.hashRoundTrip, 'ハッシュ往復で同じ状態が開ける', '');

      // 駒の表示モード・利き・骨格線のスイッチが盤に効く
      for (const v of ['all', 'core', 'dim']) await page.click(`#modeSeg button[data-value="${v}"]`);
      await page.click('#heat'); await wait(200);
      const heatOn = await page.$$eval('#board .sq .h', els => els.length);
      ok(heatOn > 0, '守りの利きを点けるとヒートが出る', `${heatOn}マス`);
      await page.click('#heat'); await wait(200);
      await page.click('#skeleton'); await wait(300);
      const sk = await page.$$eval('#board .overlay .sk', els => els.length);
      ok(sk > 0, '骨格線を点けると線が出る', `${sk}本`);
      await page.click('#skeleton');

      await setView(page, 'cluster'); await wait(400);
      const c = await sweepCluster(page);
      ok(c.dots > 0 && c.fams === expect.fams, '分類マップの点と系統', `dots=${c.dots} fams=${c.fams}`);

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
      // モバイル: 各画面で横スクロールなし＋盤は幅いっぱい（戦法の周期表があっても潰れない）
      for (const v of VIEWS) {
        await setView(page, v); await wait(250);
        await checkFit(page, 390);
        if (v !== 'cluster') {
          const bw = await page.evaluate(() => Math.round(document.querySelector('#board').getBoundingClientRect().width));
          ok(bw >= 300, `w=390 ${v} 盤が幅いっぱい`, `${bw}px`);
        }
      }
      // モバイル: 表示設定は歯車で開閉する
      const tools = await page.evaluate(() => {
        const btn = document.querySelector('#toolsToggle'), panel = document.querySelector('#tools');
        const hidden = getComputedStyle(panel.querySelector('.setting')).display === 'none' || panel.offsetHeight === 0;
        btn.click();
        const open = panel.classList.contains('open') && panel.offsetHeight > 0;
        btn.click();
        const closed = !panel.classList.contains('open');
        return { shown: getComputedStyle(btn).display !== 'none', hidden, open, closed };
      });
      ok(tools.shown && tools.hidden && tools.open && tools.closed, 'w=390 表示設定の開閉', JSON.stringify(tools));
      await setView(page, 'cluster'); await wait(300);
      const cb = await page.evaluate(() => Math.round(document.querySelector('#clusterStage .cl-body').getBoundingClientRect().height));
      ok(cb >= 300, `w=390 分類マップに十分な高さ`, `${cb}px`);
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
