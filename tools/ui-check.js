#!/usr/bin/env node
'use strict';
/* 全画面の検証: ブラウザで「囲い」「戦法」「対局図」「分類マップ」を巡回し、
   JSエラー・ページのスクロール(幅980px以上では出ない)・制約の追加/削除/連鎖・
   周期表の出し分け・相手の駒の有無・タブ間の遷移・ハッシュの往復を検査する。
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
const VIEWS = ['castle', 'tactic', 'board', 'cluster'];
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
// 盤の矩形（F1 の不変条件: 状態に依らず ±0.5px 以内）
const boardRect = page => page.evaluate(() => {
  const b = document.querySelector('#board').getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
const rectsEqual = (a, b) => a && b && Math.abs(a.x - b.x) <= .5 && Math.abs(a.y - b.y) <= .5
  && Math.abs(a.w - b.w) <= .5 && Math.abs(a.h - b.h) <= .5;
// ?debug で立つ window.__kakoi 経由の状態スナップショット
const snap = page => page.evaluate(() => {
  const st = __kakoi.store.state;
  const b = document.querySelector('#board').getBoundingClientRect();
  return {
    constraints: st.constraints, selected: st.selected, view: st.view,
    sides: Kakoi.constraints.sides(st.constraints),
    chips: [...document.querySelectorAll('#cbarOpp .cchip, #cbarMe .cchip')].map(c =>
      ({ who: c.dataset.who, kind: c.dataset.kind, implied: c.dataset.implied === 'true', text: c.textContent.trim() })),
    gote: document.querySelectorAll('#board .pc[data-owner="gote"]').length,
    canvas: !!document.querySelector('#board canvas'),
    threats: document.querySelectorAll('#board .ov-threat').length,
    bandOppEmpty: document.querySelector('#bandOpp').dataset.empty === 'true',
    rect: { x: b.x, y: b.y, w: b.width, h: b.height },
    // 右ドックは BoardDetailView が .bd-h/.bd-who に「自分（先手）の囲い」のように出す
    detailKind: (document.querySelector('#detail .bd-who') || {}).textContent || '',
    hash: location.hash,
  };
});

/* ---- 巡回: 盤（統合画面） ---- */
async function sweepBoard(page) {
  const r = {};
  r.rects = [];
  const mark = async () => r.rects.push(await boardRect(page));
  r.t0 = await snap(page);
  r.rects.push(r.t0.rect);
  // 左ドック: 上=相手（いない時は追加ボタンのみ）・下=自分（既定は囲いタブ）
  r.panes = await page.$$eval('#pickRail .dk-pane', els => els.length);
  r.oppEmpty = await page.$eval('#pickRail .dk-pane[data-who="opp"]', el => el.dataset.empty === 'true');
  r.bandGhost0 = r.t0.bandOppEmpty;
  r.sepHidden0 = await page.$eval('#pickRail .dk-sep', el => el.hidden);
  r.cards = await page.$$eval('#pickRail .dk-pane[data-who="me"] .dk-card', els => els.length);
  r.fams = await page.$$eval('#pickRail .dk-pane[data-who="me"] .dk-fam', els => els.length);
  r.segs = await page.$$eval('#pickRail .dk-strategy button[data-value]', els => els.length);
  // 系統ブロックの折りたたみ
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fam-h'); await wait(120);
  await mark();
  r.collapse = await page.$eval('#pickRail .dk-pane[data-who="me"] .dk-fam',
    el => el.dataset.closed === 'true' && el.querySelector('.dk-fam-h').getAttribute('aria-expanded') === 'false');
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fam-h'); await wait(120);
  await mark();
  // アコーディオン: 自分の面を畳む→ヘッダだけ（closed）。開き直す
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fold'); await wait(200);
  r.foldMe = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.closed === 'true'
    && __kakoi.store.state.dock.me.open === false);
  await mark();
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-fold'); await wait(200);
  r.unfoldMe = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.closed === 'false');
  await mark();

  // 「相手を加える」→ 相手の制約が増え、上の面が開いて戦法タイルが出る
  await page.click('#pickRail .dk-addopp'); await wait(400);
  r.t5 = await snap(page);
  r.rects.push(r.t5.rect);
  r.opp = !!r.t5.sides.opp && r.t5.constraints.some(e => e.who === 'opp');
  r.oppShown = r.t5.canvas || r.t5.gote > 0;
  r.oppPaneOpen = await page.$eval('#pickRail .dk-pane[data-who="opp"]', el => el.dataset.closed === 'false');
  r.items = await page.$$eval('#pickRail .dk-item', els => els.length);
  r.tiles = await page.$$eval('#pickRail .dk-pane[data-who="opp"] .dk-tile', els => els.length);
  r.vars = await page.$$eval('#pickRail .dk-pane[data-who="opp"] .dk-var', els => els.length);
  // F3: サムネイルの字は実効 12px 以上（SVG の表示倍率 × font-size。非表示のカードは除く）
  r.thumbMinPx = await page.evaluate(() => {
    let m = Infinity;
    for (const sc of document.querySelectorAll('.dk-card:not([hidden]) .thumb .sc')) {
      const svg = sc.querySelector('svg'); const t = svg && svg.querySelector('.mini-pc');
      if (!t) continue;
      const vb = svg.viewBox.baseVal.width, vh = svg.viewBox.baseVal.height;
      const rc = svg.getBoundingClientRect();
      const eff = parseFloat(getComputedStyle(t).fontSize) * Math.min(rc.width / vb, rc.height / vh);
      if (eff < m) m = eff;
    }
    return m;
  });
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
  await mark();
  await page.keyboard.press('ArrowUp'); await wait(150);
  r.splitBack = await page.evaluate(s => Math.abs(__kakoi.store.state.dock.split - s) < 1e-6, sp0);
  await mark();

  // 囲いを選ぶ → 制約が増え、チップが現れ、詳細が囲いになる
  const before = await page.evaluate(() => __kakoi.store.state.constraints.length);
  await page.click('#pickRail .dk-item[data-who="me"][data-kind="castle"]:not([hidden])'); await wait(350);
  r.t1 = await snap(page);
  r.rects.push(r.t1.rect);
  r.added = r.t1.constraints.length === before + 1
    && r.t1.constraints.some(e => e.who === 'me' && e.kind === 'castle')
    && r.t1.selected === 'me.castle' && r.t1.detailKind.includes('囲い');

  // 戦法を選ぶ: 下面を戦法タブに切り替えてからタイルを押す → selected=me.tactic・詳細が戦法。
  // （中央の盤の上に戦法の表は出さない。一覧はドックの筋タイル）
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="tactic"]'); await wait(250);
  await mark();
  r.tabSwitch = await page.evaluate(() =>
    document.querySelector('#pickRail .dk-pane[data-who="me"]').dataset.tab === 'tactic'
    && document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-tile').length > 0);
  // 筋の番号ヘッダ（.dk-fh）: 列は盤の絶対座標（左=9筋）なので両面とも ９…１
  r.fileHdr = await page.evaluate(() => {
    const hd = p => {
      const fh = document.querySelector(`#pickRail .dk-pane[data-who="${p}"] .dk-fh`);
      return fh && [...fh.querySelectorAll('span')].map(s => s.textContent).join('') === '９８７６５４３２１';
    };
    return hd('me') && hd('opp');
  });
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tile[data-who="me"]:not([hidden])'); await wait(350);
  r.t2 = await snap(page);
  r.rects.push(r.t2.rect);
  r.tacticSel = r.t2.selected === 'me.tactic' && r.t2.detailKind.includes('戦法');
  // 別のタイルを押す → 自分の戦法が変わる（周期表の代わり。タイルは正確に筋に載る）
  const tIdA = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-tile:not([hidden])')]
      .find(el => el.getAttribute('aria-current') !== 'true');
    if (t) t.click();
  });
  await wait(350);
  r.t3 = await snap(page);
  r.rects.push(r.t3.rect);
  const tIdB = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  r.dockPick = tIdA !== tIdB && r.t3.selected === 'me.tactic';
  // 戦略セグを切り替える → 合わない戦略の行が隠れる（分類は戦略だけ。「もう一方」は無い）
  const stratA = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.strategy);
  const stratB = stratA === 'ibisha' ? 'furibisha' : 'ibisha';
  await page.click(`#pickRail .dk-pane[data-who="me"] .dk-strategy button[data-value="${stratB}"]`); await wait(350);
  await mark();
  r.segFilter = await page.evaluate(s => {
    const st = Kakoi.constraints.sides(__kakoi.store.state.constraints).me;
    const rows = [...document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-trow')];
    return !!st && st.strategy === s && rows.length > 0
      && rows.every(x => x.hidden === (x.dataset.side !== s));
  }, stratB);
  // 囲いタブに戻す → 系統・カードも採用中の戦略で絞られる（両側を許す囲いだけは残る）
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="castle"]'); await wait(250);
  await mark();
  r.famFilter = await page.evaluate(() => {
    const st = Kakoi.constraints.sides(__kakoi.store.state.constraints).me;
    if (!st || !st.strategy) return false;
    const strat = st.strategy;
    const sidesOf = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);
    const byId = Object.fromEntries(Kakoi.CASTLES.map(c => [c.id, c]));
    const fams = [...document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-fam')];
    const cards = [...document.querySelectorAll('#pickRail .dk-pane[data-who="me"] .dk-card')];
    return fams.length > 0
      && fams.every(s => s.hidden === !s._sides.has(strat))
      && cards.every(c => c.hidden === !sidesOf(byId[c.dataset.id]).includes(strat));
  });
  await page.click('#pickRail .dk-pane[data-who="me"] .dk-card[data-who="me"]:not([hidden])'); await wait(350);
  r.t4 = await snap(page);
  r.rects.push(r.t4.rect);

  // 相手の戦法タイルを押す → 相手の戦法制約＋導出ラベル・脅威の帯が出る
  await page.click('#pickRail .dk-pane[data-who="opp"] .dk-tile:not([hidden])'); await wait(400);
  r.t5b = await snap(page);
  r.rects.push(r.t5b.rect);
  r.labels = r.t5b.chips.some(c => c.text.startsWith('#') && !c.kind);
  r.threatOn = r.t5b.threats >= 1;
  r.oppSel = r.t5b.selected === 'opp.tactic';
  // 脅威の帯スイッチを切る → 帯が消える（スイッチは左ドックの相手の面にある）
  const THREAT_SW = '#pickRail .dk-pane[data-who="opp"] .dk-threat input';
  await page.click(THREAT_SW); await wait(300);
  r.t6 = await snap(page);
  r.rects.push(r.t6.rect);
  r.threatOff = r.t6.threats === 0;
  await page.click(THREAT_SW); await wait(300);
  await mark();

  // 連鎖: cascade のある候補を選ぶと自動差し替えが起き、トーストが出る
  r.toast = '';
  r.badges = await page.$$eval('#pickRail .dk-item[data-cascade="true"], #pickRail .dk-item[data-vs="good"], #pickRail .dk-item[data-vs="bad"]', els => els.length);
  const csc = await page.$('#pickRail .dk-pane[data-who="me"] .dk-item[data-cascade="true"]:not([hidden])')
    || await page.$('#pickRail .dk-item[data-cascade="true"]:not([hidden])')
    || await page.$('#pickRail .dk-strategy button[data-cascade="true"]');
  r.cascadeTried = !!csc;
  let preList = null;
  if (csc) {
    preList = await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await csc.click(); await wait(400);
    const tv = await page.evaluate(() => {
      const t = document.querySelector('.toast.on');
      if (!t) return null;
      return { text: t.textContent, pos: getComputedStyle(t).position,
               host: t.parentElement && t.parentElement.id };
    });
    r.toast = tv ? tv.text : '';
    r.toastOverlay = tv && tv.pos === 'absolute' && tv.host === 'stageMain';   // 帯・盤を押し下げない（F1）
    r.t7 = await snap(page);
    r.rects.push(r.t7.rect);
    await mark();
  }
  // 「元に戻す」でクリック前の制約リストに戻る
  r.undo = null;
  if (r.toast) {
    await page.click('.toast .toast-act'); await wait(300);
    r.undo = await page.evaluate(l => ({
      sameAsPrev: JSON.stringify(__kakoi.store.state.constraints) === l,
      toastGone: !document.querySelector('.toast.on'),
    }), preList);
    await mark();
  }

  // × で制約を外す（相手のバーの1つ。自分側は暗黙が残るので消しても盤は壊れない）
  const xCount = await page.$$eval('#cbarOpp .cchip-x', els => els.length);
  if (xCount) {
    const n0 = await page.evaluate(() => __kakoi.store.state.constraints.length);
    await page.locator('#cbarOpp .cchip-x').last().click(); await wait(300);
    r.removed = await page.evaluate(n => __kakoi.store.state.constraints.length === n - 1, n0);
    await mark();
  }
  // 相手を全部はずす → 後手の駒と脅威の帯が退き、相手の帯は幽霊行に戻る（盤は動かない）
  await page.click('#pickRail .dk-pane[data-who="opp"] .dk-strategy button[data-value]').catch(() => {});
  await wait(350);
  await mark();
  const clearBtn = await page.$('#pickRail [data-clear="opp"]');
  if (clearBtn && await clearBtn.isVisible()) {
    await clearBtn.click(); await wait(400);
    r.t8 = await snap(page);
    r.rects.push(r.t8.rect);
    r.oppGone = r.t8.sides.opp === null && r.t8.threats === 0 && (r.t8.canvas || r.t8.gote === 0);
    r.bandGhost1 = r.t8.bandOppEmpty;
  } else {
    r.oppGone = null;
  }

  // 矢印キー: 戦法を選択しているとき ←→ で戦法が送れる（制約バーのチップで selected を戦法にする）
  const meTacticChip = await page.$('#cbarMe .cchip-b[data-who="me"][data-kind="tactic"]');
  if (meTacticChip) {
    await meTacticChip.click();
  } else {
    await page.click('#pickRail .dk-pane[data-who="me"] .dk-tab button[data-value="tactic"]'); await wait(200);
    await page.click('#pickRail .dk-pane[data-who="me"] .dk-item[data-who="me"][data-kind="tactic"]:not([hidden])');
  }
  await wait(300);
  await mark();
  const tId0 = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  await page.keyboard.press('ArrowRight'); await wait(250);
  const tId1 = await page.evaluate(() => Kakoi.constraints.sides(__kakoi.store.state.constraints).me.tacticId);
  r.keyNav = tId0 !== tId1;
  await mark();

  // U3: 矢印キーでフォーカスが失われない。
  //   - 盤（中央）では矢印は選択を動かし、フォーカスは盤に残る
  await page.focus('#board');
  await page.keyboard.press('ArrowRight'); await wait(200);
  r.focusBoard = await page.evaluate(() => document.activeElement && document.activeElement.id === 'board');
  await mark();
  //   - 制約チップでは矢印は roving がフォーカスだけを動かす（選択は変えず、body にも逃がさない）
  const chip = await page.$('#cbarMe .cchip-b');
  if (chip) {
    await chip.focus();
    await page.keyboard.press('ArrowRight'); await wait(200);
    r.focusChip = await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.classList.contains('cchip-b');
    });
  } else r.focusChip = null;
  await mark();

  // U2: Ctrl+Z（UndoHistory）で直前の制約変更だけが戻る（トーストの「元に戻す」とは別系統）
  {
    const pre = await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await page.click('#pickRail .dk-pane[data-who="me"] .dk-item[data-who="me"]:not([hidden])'); await wait(350);
    const mid = await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await mark();
    await page.keyboard.press('Control+z'); await wait(250);
    r.ctrlZ = await page.evaluate(p => JSON.stringify(__kakoi.store.state.constraints) === p, pre) && mid !== pre;
    await mark();
  }

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

  // U9: アドレスバーの書き換え（hashchange）が状態へ届く。明示制約を含む既知のハッシュを書く
  {
    const before2 = await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await page.evaluate(() => { location.hash = 'v=board&k=os:furibisha,mc:yagura&sel=mc&mw=0'; });
    await wait(400);
    r.hashChange = await page.evaluate(() => {
      const st = __kakoi.store.state;
      return st.constraints.length === 2
        && st.constraints.some(e => e.who === 'opp' && e.kind === 'strategy' && e.id === 'furibisha')
        && st.constraints.some(e => e.who === 'me' && e.kind === 'castle' && e.id === 'yagura')
        && st.selected === 'me.castle' && st.showThreat === false;
    }) && before2 !== await page.evaluate(() => JSON.stringify(__kakoi.store.state.constraints));
    await mark();
    // mw=0 で消した脅威の帯はスイッチを戻すと出る（hashchange がスイッチにも届く）
    await page.evaluate(() => { const sw = document.querySelector('#pickRail .dk-pane[data-who="opp"] .dk-threat input');
      sw.checked = true; sw.dispatchEvent(new Event('change')); });
    await wait(250);
    await mark();
  }
  // F1: 巡回の全ステップで盤の矩形が変わらない（±0.5px）
  const baseR = r.rects[0];
  r.rectDrift = r.rects.map(x => rectsEqual(x, baseR)).indexOf(false);   // -1 なら全一致
  return r;
}

/* ---- 巡回: 囲いタブ（図鑑。制約リストとは独立の閲覧状態） ---- */
async function sweepCastle(page, expect) {
  const r = {};
  const idOf = () => page.evaluate(() => __kakoi.store.state.castleId);
  r.cards0 = await page.$$eval('#cards .card', els => els.length);
  r.ptableHidden = await page.evaluate(() => {
    const p = document.querySelector('#ptable');
    return p.offsetHeight === 0 && getComputedStyle(p).display === 'none';
  });
  r.title = await page.$eval('#castleTitle', el => el.textContent.trim());
  r.secCount = await page.$$eval('#castleDetail .sec', els => els.length);
  // 別のカードを押す → castleId が変わり aria-current が移る
  const id0 = await idOf();
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('#cards .card')].find(x => x.getAttribute('aria-current') !== 'true');
    c && c.click();
  });
  await wait(300);
  r.selWorks = (await idOf()) !== id0
    && await page.evaluate(() => !!document.querySelector('#cards .card[aria-current="true"]'));
  // 戦型セグ → 振り飛車の一覧になる
  await page.click('#castleSideSeg button[data-value="furibisha"]'); await wait(300);
  r.sideSwitch = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const c = Kakoi.CASTLES.find(x => x.id === st.castleId);
    const n = document.querySelectorAll('#cards .card').length;
    return c && c.side === 'furibisha' && n === Kakoi.CASTLES.filter(x => x.side === 'furibisha').length;
  });
  // 系統チップで絞る → カードが減る・同じチップを再押しで解除（先頭は「すべて」なので2番目を使う）
  await page.click('#familyChips .fchip:not([data-family=""])'); await wait(250);
  r.chipFilter = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const side = Kakoi.CASTLES.find(c => c.id === st.castleId)?.side;
    // 一覧は選択中の戦型の囲いだけを出すので、件数も戦型で絞って比べる（anaguma/mino 等は両戦型にある）
    return !!st.familyFilter
      && document.querySelectorAll('#cards .card').length
        === Kakoi.CASTLES.filter(c => c.family === st.familyFilter && c.side === side).length;
  });
  await page.click('#familyChips .fchip'); await wait(250);
  r.chipReset = await page.evaluate(() => __kakoi.store.state.familyFilter === null);
  // ハッシュは v=castle&c=…（制約 k= も載るが閲覧状態は c=）
  r.hash = await page.evaluate(() => /[#&]v=castle/.test(location.hash) && /[#&]c=/.test(location.hash));
  // 「対局図で開く」→ board へ制約を持って移る
  const castleId = await idOf();
  await page.click('#castleDetail .mu-open'); await wait(350);
  r.openBoard = await page.evaluate(cid => {
    const st = __kakoi.store.state;
    return st.view === 'board'
      && st.constraints.some(e => e.who === 'me' && e.kind === 'castle' && e.id === cid)
      && st.selected === 'me.castle';
  }, castleId);
  await setView(page, 'castle'); await wait(250);
  return r;
}

/* ---- 巡回: 戦法タブ（周期表＋系統別一覧） ---- */
async function sweepTactic(page, expect) {
  const r = {};
  const idOf = () => page.evaluate(() => __kakoi.store.state.tacticId);
  r.ptableShown = await page.evaluate(() => document.querySelector('#ptable').offsetHeight > 0);
  r.cells = await page.$$eval('#ptable .pt-cell', els => els.length);
  r.railItems = await page.$$eval('#tacticRail .tr-item', els => els.length);
  r.title = await page.$eval('#tacticStage h2', el => el.textContent.trim());
  r.secCount = await page.$$eval('#tacticDetail .sec', els => els.length);
  // 周期表の別セル → tacticId が変わり aria-current が移る
  const id0 = await idOf();
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('#ptable .pt-cell')].find(x => x.getAttribute('aria-current') !== 'true');
    c && c.click();
  });
  await wait(300);
  r.cellPick = (await idOf()) !== id0;
  // 系統ピッカー → 別の系統の段になる（居飛車側に切り替えて試す: 振り飛車の系統は1系統しかない）
  await page.click('#tacticRail [data-role="seg"] button[data-value="ibisha"]'); await wait(300);
  const furibishaStart = await page.evaluate(() => {
    const K = window.Kakoi, st = window.__kakoi.store.state, side = 'furibisha';
    const valid = id => {
      const tactic = K.TACTICS.find(t => t.id === id);
      const family = tactic && K.TACTIC_FAMILIES.find(f => f.id === tactic.family);
      return family && family.side === side;
    };
    const saved = st.tacticLastBySide && st.tacticLastBySide[side];
    if (saved && valid(saved)) return saved;
    const family = K.TACTIC_FAMILIES.find(f => f.side === side && f.piece === '飛');
    const row = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS).find(r => r.family.id === family.id);
    const remembered = st.tacticLastByFam && st.tacticLastByFam[family.id];
    return remembered && row.tactics.some(t => t.id === remembered)
      ? remembered : (row.tactics.find(t => !t.variantOf) || row.tactics[0]).id;
  });
  await page.locator('#tacticRail [data-role="seg"] button[data-value="ibisha"]').focus();
  await page.keyboard.press('ArrowRight'); await wait(300);
  r.segmentArrowSingle = await idOf() === furibishaStart
    && await page.evaluate(() => {
      const K = window.Kakoi, id = window.__kakoi.store.state.tacticId;
      const tactic = K.TACTICS.find(t => t.id === id);
      return K.TACTIC_FAMILIES.find(f => f.id === tactic.family).side === 'furibisha';
    });
  await page.click('#tacticRail [data-role="seg"] button[data-value="ibisha"]'); await wait(300);
  const fam0 = await page.evaluate(() => document.querySelector('#ptable .pt-fam[aria-pressed="true"]')?.dataset.fam);
  r.famSiblings = await page.$$eval('#ptable .pt-fam', els => els.length);
  await page.evaluate(f => {
    const b = [...document.querySelectorAll('#ptable .pt-fam')].find(x => x.dataset.fam !== f);
    b && b.click();
  }, fam0);
  await wait(300);
  r.famPick = r.famSiblings > 1 && await page.evaluate(f =>
    document.querySelector('#ptable .pt-fam[aria-pressed="true"]')?.dataset.fam !== f, fam0);
  // 一覧のアイテムクリック → tacticId が変わる
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('#tacticRail .tr-item')].find(x => x.getAttribute('aria-current') !== 'true');
    c && c.click();
  });
  await wait(300);
  r.railPick = await page.evaluate(() => !!__kakoi.store.state.tacticId);
  r.hash = await page.evaluate(() => /[#&]v=tactic/.test(location.hash) && /[#&]t=/.test(location.hash));
  // 相性のよい囲い「→」→ 囲いタブへ
  await page.click('#tacticDetail .tc-go'); await wait(350);
  r.openCastle = await page.evaluate(() => __kakoi.store.state.view === 'castle');
  // 戻って「対局図で開く」（.tc-castle は相性のよい囲い）→ board へ
  await setView(page, 'tactic'); await wait(250);
  const castleChip = await page.$('#tacticDetail .tc-castle[data-act="matchup"]');
  if (castleChip) {
    await castleChip.click(); await wait(350);
    r.openBoard = await page.evaluate(() => {
      const st = __kakoi.store.state;
      return st.view === 'board' && st.constraints.some(e => e.who === 'me' && e.kind === 'tactic');
    });
    await setView(page, 'tactic'); await wait(250);
  } else r.openBoard = null;
  return r;
}

async function checkResizeAnimation(page) {
  if (await page.evaluate(() => window.__kakoi.board.layer.kind) !== '3d') return null;
  await page.evaluate(() => {
    const board = window.__kakoi.board, K = window.Kakoi;
    const start = K.Position.fromPieces('銀79', { leadSquare: '79' });
    const end = K.Position.fromPieces('銀46', { leadSquare: '46' });
    board.render(start, { mode: 'all', heat: null, animate: false });
    board.render(end, {
      mode: 'all', heat: null, animate: true,
      trace: { square: '46', piece: '銀', path: ['79', '68', '57', '46'] },
    });
  });
  await wait(100);
  return page.evaluate(() => {
    const layer = window.__kakoi.board.layer;
    const pc = layer.cur.find(x => x.p === '銀' && x.sq === '46');
    const before = Math.hypot(pc.group.position.x - layer._pos(pc.sq).x, pc.group.position.y - layer._pos(pc.sq).y);
    layer._resize();
    const after = Math.hypot(pc.group.position.x - layer._pos(pc.sq).x, pc.group.position.y - layer._pos(pc.sq).y);
    return before > 1 && after < 1 && !layer._tweens.some(t => t.pc === pc);
  });
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
      // ≤1180px の右ドロワーは閉じると translateX(100%) で画面外に待機する（正常）
      const tucked = getComputedStyle(el).transform !== 'none' && el.classList.contains('detail');
      return { cls: el.className, out: !tucked && (b.top < -1 || b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) };
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
        ibishaCastles: Kakoi.CASTLES.filter(c => c.side === 'ibisha').length,
      }));

      const b = await sweepBoard(page);
      ok(b.panes === 2, '左ドックは上下2面（上=相手・下=自分）', `${b.panes}面`);
      ok(b.oppEmpty, '相手がいないとき上の面は選択UIを出さない', '');
      ok(b.bandGhost0 && b.bandGhost1, '相手なしの間・はずした後は相手の帯が幽霊行', `初期=${b.bandGhost0} 後=${b.bandGhost1}`);
      ok(b.sepHidden0, '片方だけの時はスプリッタを出さない', '');
      ok(b.rectDrift === -1, '盤の矩形は全ステップで不変（F1 ±0.5px）', `ずれたステップ=${b.rectDrift}`);
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
      ok(b.tacticSel, '戦法を選ぶ→選択と詳細が戦法になる', `sel=${b.t2 && b.t2.selected}`);
      ok(b.dockPick, 'ドックの筋タイルで戦法が変わる', `sel=${b.t3 && b.t3.selected}`);
      ok(b.fileHdr, '戦法グリッドの上に筋の番号（９…１）', '');
      ok(b.segFilter && b.famFilter, '面の戦略に合わない行・系統・項目は表示しない', `rows=${b.segFilter} fams=${b.famFilter}`);
      ok(b.opp && b.oppShown && b.oppPaneOpen, '「相手を加える」→後手の駒と相手の面が出る', `sides.opp=${!!(b.t5 && b.t5.sides.opp)} gote=${b.t5 && b.t5.gote} open=${b.oppPaneOpen}`);
      ok(b.threatOn, '相手がいると脅威の帯が出る', `${b.t5b && b.t5b.threats}本`);
      ok(b.labels, '制約バーに導出ラベル（戦型）が出る', JSON.stringify(b.t5b && b.t5b.chips.filter(c => !c.kind)));
      ok(b.oppSel, '相手の戦法タイルで選択が相手の戦法になる', `sel=${b.t5b && b.t5b.selected}`);
      ok(b.badges > 0, 'タイルに2軸バッジ（cascade か ◎/△）が出る', `${b.badges}件`);
      ok(b.threatOff, '脅威の帯スイッチで帯を消せる', `${b.t6 && b.t6.threats}本`);
      if (!b.cascadeTried) warn('連鎖のある候補が見つからず、自動差し替えトーストを試せなかった');
      else {
        ok(b.toast.length > 0, '連鎖選択で自動差し替えトースト', b.toast.slice(0, 60));
        ok(b.toastOverlay === true, 'トーストは盤に重なるオーバーレイ（absolute）', JSON.stringify(b.toastOverlay));
        ok(b.undo && b.undo.sameAsPrev && b.undo.toastGone, '「元に戻す」で制約リストが戻る', JSON.stringify(b.undo));
      }
      ok(b.removed !== false, '×で制約を外せる', '');
      if (b.oppGone == null) warn('「はずす」ボタンが見つからなかった');
      else ok(b.oppGone, '「はずす」で相手の駒と帯が退く', JSON.stringify(b.t8 && b.t8.sides.opp));
      ok(b.keyNav, '矢印キーで戦法を送れる', '');
      ok(b.focusBoard && b.focusChip !== false, '矢印キーでフォーカスが保たれる（U3）',
        `盤=${b.focusBoard} チップ=${b.focusChip}`);
      ok(b.ctrlZ, 'Ctrl+Z で直前の制約が戻る（U2）', '');
      ok(b.thumbMinPx >= 12, 'サムネイルの字は12px以上（F3）', `${b.thumbMinPx}px`);
      ok(b.hashFormat, 'ハッシュは新形式（v=board&k=…）', '');
      ok(b.hashRoundTrip, 'ハッシュ往復で同じ状態が開ける', '');
      ok(b.hashChange, 'アドレスバーの書き換え（hashchange）が状態に届く（U9）', '');

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

      // ---- 囲いタブ ----
      await setView(page, 'castle'); await wait(400);
      const ca = await sweepCastle(page, expect);
      ok(ca.cards0 === expect.ibishaCastles, '囲いタブ: 居飛車のカード一覧', `${ca.cards0}枚`);
      ok(ca.title.length > 0 && ca.secCount >= 4, '囲いタブ: 見出しと詳細の節', `title=${ca.title} sec=${ca.secCount}`);
      ok(ca.ptableHidden, '囲いタブでは周期表を出さない', '');
      ok(ca.selWorks, '囲いタブ: カード選択で castleId が変わる', '');
      ok(ca.sideSwitch, '囲いタブ: 戦型セグで振り飛車の一覧', '');
      ok(ca.chipFilter && ca.chipReset, '囲いタブ: 系統チップで絞り込みと解除', `filter=${ca.chipFilter} reset=${ca.chipReset}`);
      ok(ca.hash, '囲いタブ: ハッシュに v=castle&c=', '');
      ok(ca.openBoard, '囲いタブ: 「対局図で開く」で制約を持って board へ', '');

      // ---- 戦法タブ ----
      await setView(page, 'tactic'); await wait(400);
      const ta = await sweepTactic(page, expect);
      ok(ta.ptableShown && ta.cells > 0, '戦法タブ: 周期表が盤の下に出る', `cells=${ta.cells}`);
      ok(ta.railItems > 0 && ta.title.length > 0 && ta.secCount >= 3,
        '戦法タブ: 一覧・見出し・詳細', `items=${ta.railItems} title=${ta.title} sec=${ta.secCount}`);
      ok(ta.cellPick, '戦法タブ: 周期表のセルで tacticId が変わる', '');
      ok(ta.famPick, '戦法タブ: 系統ピッカーで段が変わる', '');
      ok(ta.railPick, '戦法タブ: 一覧で戦法を選べる', '');
      ok(ta.hash, '戦法タブ: ハッシュに v=tactic&t=', '');
      ok(ta.openCastle, '戦法タブ: 「→」で囲いタブへ', '');
      ok(ta.openBoard !== false, '戦法タブ: 「対局図で開く」で制約を持って board へ', '');
      ok(ta.segmentArrowSingle, '戦法タブ: セグメントの矢印は戦法を二重に進めない', '');
      await setView(page, 'board'); await wait(300);
      ok(await page.evaluate(() => document.querySelector('#ptable').offsetHeight === 0),
        'board では周期表を出さない', '');

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

      // ---- w=1100: 右ドックはドロワー（§4-6）。タブ＋制約選択で開き、閉じても横スクロールしない ----
      await page.setViewportSize({ width: 1100, height: 900 });
      await setView(page, 'board'); await wait(400);
      const dw0 = await page.evaluate(() => ({
        toggleShown: getComputedStyle(document.querySelector('#detailToggle')).display !== 'none',
        open: document.body.dataset.drawer === 'open',
        sw: document.documentElement.scrollWidth, iw: innerWidth,
      }));
      await page.click('#detailToggle'); await wait(350);
      const dw1 = await page.evaluate(() => {
        const b = document.querySelector('.detail').getBoundingClientRect();
        return { open: document.body.dataset.drawer === 'open',
                 onscreen: b.left < innerWidth && b.right <= innerWidth + 1,
                 aria: document.querySelector('#detailToggle').getAttribute('aria-expanded') };
      });
      ok(dw0.toggleShown && !dw0.open && dw0.sw <= dw0.iw + 1,
        'w=1100 ドロワーは閉じて待機（タブのみ・横スクロールなし）', JSON.stringify(dw0));
      ok(dw1.open && dw1.onscreen && dw1.aria === 'true', 'w=1100 タブでドロワーが開く', JSON.stringify(dw1));
      // 制約チップを選ぶとドロワーが開く（§4-6）
      await page.click('#detailToggle'); await wait(350);
      await page.click('#pickRail .dk-pane[data-who="me"] .dk-card[data-who="me"]:not([hidden])'); await wait(400);
      const dw2 = await page.evaluate(() => ({
        open: document.body.dataset.drawer === 'open',
        sw: document.documentElement.scrollWidth, iw: innerWidth,
      }));
      ok(dw2.open && dw2.sw <= dw2.iw + 1, 'w=1100 制約を選ぶとドロワーが開く（開いても横スクロールなし）', JSON.stringify(dw2));
      await page.evaluate(() => { delete document.body.dataset.drawer; });
      await page.setViewportSize({ width: 1440, height: 900 }); await wait(250);
      await page.setViewportSize({ width: 390, height: 844 });
      // モバイル: 各画面で横スクロールなし＋盤は幅いっぱいに潰れない
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
      const resizePage = await browser.newPage({ viewport: { width: 1100, height: 850 } });
      resizePage.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
      await resizePage.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await resizePage.goto(baseDebug, { waitUntil: 'networkidle' });
      const resizeOk = await checkResizeAnimation(resizePage);
      if (resizeOk === null) warn('WebGL非対応のため立体駒リサイズテストをスキップ');
      else ok(resizeOk, '立体駒: リサイズ時に進行中アニメを完了させる');
      await resizePage.close();
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
