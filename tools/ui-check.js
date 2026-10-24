#!/usr/bin/env node
'use strict';
/* 画面の検証: ブラウザで唯一の画面（対局図）を巡回し、
   JSエラー・ページのスクロール(幅980px以上では出ない)・スロットの選択/解除・
   両立しない選択の✕と直す候補・相手の表示ON/OFF・左ドックのタブ・
   ハッシュ（pushState）と「戻る」の往復を検査する。
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
    slots: st.slots, showOpp: st.showOpp, selected: st.selected,
    sides: Kakoi.constraints.sides(st.slots, st.showOpp),
    chips: [...document.querySelectorAll('#cbarOpp .cchip, #cbarMe .cchip')].map(c =>
      ({ who: c.dataset.who, kind: c.dataset.kind, implied: c.dataset.implied === 'true', ng: c.dataset.ng === 'true',
        mark: (c.querySelector('.cchip-ng') || {}).textContent || '', text: c.textContent.trim(),
        name: (c.querySelector('.cchip-nm') || {}).textContent || '',
        type: (c.querySelector('.cchip-type') || {}).textContent || '',
        remove: !!c.querySelector('.cchip-x'),
        hasDescription: !!c.querySelector('.cchip-desc') })),
    gote: document.querySelectorAll('#board .pc[data-owner="gote"]').length,
    canvas: !!document.querySelector('#board canvas'),
    threats: document.querySelectorAll('#board .ov-threat').length,
    bandOppEmpty: document.querySelector('#bandOpp').dataset.empty === 'true',
    relationships: [...document.querySelectorAll('#relationshipLabels .relation-chip')].map(el => el.textContent.trim()),
    rect: { x: b.x, y: b.y, w: b.width, h: b.height },
    // 右ドックは BoardDetailView が .bd-h/.bd-who に「自分（先手）の囲い」のように出す
    detailKind: (document.querySelector('#detail .bd-who') || {}).textContent || '',
    hash: location.hash, hist: history.length,
  };
});
const DOCK = '#pickRail';

/* ---- 巡回: 対局図（唯一の画面） ---- */
async function sweepBoard(page, expect) {
  const r = {};
  r.rects = [];
  const mark = async () => r.rects.push(await boardRect(page));
  r.t0 = await snap(page);
  r.rects.push(r.t0.rect);
  r.boardStageOffset = await page.evaluate(() => {
    const a = document.querySelector('.boardarea').getBoundingClientRect();
    const b = document.querySelector('#board').getBoundingClientRect();
    return Math.abs((b.top + b.bottom - a.top - a.bottom) / 2);
  });
  r.boardOrder = await page.evaluate(() => {
    const opp = document.querySelector('#bandOpp').getBoundingClientRect();
    const rel = document.querySelector('#relationshipLabels').getBoundingClientRect();
    const board = document.querySelector('#board').getBoundingClientRect();
    const me = document.querySelector('#bandMe').getBoundingClientRect();
    return document.querySelector('#bandOpp').dataset.empty === 'true'
      ? getComputedStyle(document.querySelector('#bandOpp')).visibility === 'hidden'
        && getComputedStyle(document.querySelector('#relationshipLabels')).visibility === 'hidden'
        && me.bottom <= board.top
      : opp.bottom <= rel.top && rel.bottom <= me.top && me.bottom <= board.top;
  });
  r.boardBandGaps = await page.evaluate(() => {
    const opp = document.querySelector('#bandOpp').getBoundingClientRect();
    const rel = document.querySelector('#relationshipLabels').getBoundingClientRect();
    const board = document.querySelector('#board').getBoundingClientRect();
    const me = document.querySelector('#bandMe').getBoundingClientRect();
    return document.querySelector('#bandOpp').dataset.empty === 'true'
      ? [board.top - me.bottom]
      : [rel.top - opp.bottom, me.top - rel.bottom, board.top - me.bottom];
  });
  // 初期状態: 左ドックは1枚の面（自分・囲い）。相手タブから相手を表示できる。ハッシュは空。
  r.panes = await page.$$eval(`${DOCK} .dk-pane`, els => els.length);
  r.layerTabs = await page.$$eval(`${DOCK} .dk-tab button`, els => els.map(el => el.textContent.trim()));
  r.layerBinder = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#pickRail .dk-tab button')];
    const active = tabs.find(tab => tab.getAttribute('aria-pressed') === 'true');
    const inactive = tabs.find(tab => tab !== active);
    return tabs.length === 2 && active && inactive
      && Math.abs(active.getBoundingClientRect().height - inactive.getBoundingClientRect().height) < 1
      && getComputedStyle(active).borderTopLeftRadius !== '0px'
      && getComputedStyle(active).backgroundColor !== getComputedStyle(inactive).backgroundColor
      && getComputedStyle(active).borderBottomColor === getComputedStyle(document.body).backgroundColor;
  });
  r.layerSwitchStable = await page.evaluate(async () => {
    const group = document.querySelector('#pickRail .dk-tab');
    const bounds = () => {
      const { x, y, width, height } = group.getBoundingClientRect();
      return [x, y, width, height];
    };
    const before = bounds();
    document.querySelector('#pickRail .dk-tab button[data-value="tactic"]').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const switched = bounds();
    document.querySelector('#pickRail .dk-tab button[data-value="castle"]').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const restored = bounds();
    return [switched, restored].every(rect => rect.every((value, i) => Math.abs(value - before[i]) < .5));
  });
  r.strategyOrder = await page.$$eval(`${DOCK} .dk-strategy button`, els => els.map(el => el.dataset.value));
  r.controlOrder = await page.evaluate(() => {
    const strategy = document.querySelector('#pickRail .dk-strategy').getBoundingClientRect();
    const tabs = document.querySelector('#pickRail .dk-tab').getBoundingClientRect();
    const sort = document.querySelector('#pickRail .dk-sort-seg').getBoundingClientRect();
    return strategy.bottom < tabs.top && tabs.bottom <= sort.top;
  });
  r.legendRow = await page.evaluate(() => {
    const sort = document.querySelector('#pickRail .dk-sort-seg').getBoundingClientRect();
    const help = document.querySelector('#pickRail .dk-legend').getBoundingClientRect();
    return help.width > 0 && Math.abs(sort.top + sort.height / 2 - help.top - help.height / 2) < 1;
  });
  await page.click(`${DOCK} .dk-legend`);
  r.legendAnchor = await page.evaluate(() => {
    const button = document.querySelector('#pickRail .dk-legend').getBoundingClientRect();
    const popover = document.querySelector('#pickRail .dk-legend-pop').getBoundingClientRect();
    return popover.top >= button.bottom && Math.abs(popover.right - button.right) < 1;
  });
  await page.click(`${DOCK} .dk-legend`);
  r.binderStyle = await page.evaluate(() => {
    const binder = document.querySelector('#pickRail .dk-binder').getBoundingClientRect();
    const opp = document.querySelector('#pickRail .dk-pc[data-who="opp"]').getBoundingClientRect();
    const me = document.querySelector('#pickRail .dk-pc[data-who="me"]').getBoundingClientRect();
    const ghost = document.querySelector('#pickRail .dk-pc-ghost');
    return getComputedStyle(ghost).display !== 'none'
      && Math.abs(opp.top - binder.top - 30) < 1
      && Math.abs(me.top - opp.bottom) < 1
      && Math.round(me.width) === 46;
  });
  r.oppTabEnabled = await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled);
  r.noOldUi = await page.evaluate(() => !document.querySelector('#viewSeg, [data-view], #addOpp, #clearAll, #clearMe, #clearOpp, #skeleton, #heatScopeSeg, .dk-sep, .dk-fold, .dk-addopp, .dk-threat'));
  r.noClusterCss = await page.evaluate(() => ![...document.styleSheets].some(s => /clusters\.css/.test(s.href || '')));
  r.hashEmpty0 = r.t0.hash === '' || r.t0.hash === '#';
  r.selected0 = r.t0.selected;
  r.cards = await page.$$eval(`${DOCK} .dk-card`, els => els.length);
  r.fams = await page.$$eval(`${DOCK} .dk-fam`, els => els.length);
  r.segs = await page.$$eval(`${DOCK} .dk-strategy button[data-value]`, els => els.length);
  r.thumbMinPx = await page.evaluate(() => {   // F3: サムネイルの字は実効 12px 以上（非表示のカードは除く）
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
  // 系統ブロックの折りたたみ
  await page.click(`${DOCK} .dk-fam-h`); await wait(120);
  await mark();
  r.collapse = await page.$eval(`${DOCK} .dk-fam`,
    el => el.dataset.closed === 'true' && el.querySelector('.dk-fam-h').getAttribute('aria-expanded') === 'false');
  await page.click(`${DOCK} .dk-fam-h`); await wait(120);
  await mark();
  r.bandGhost0 = r.t0.bandOppEmpty && r.t0.gote === 0;

  // 囲いを選ぶ → スロットが埋まり、チップが現れ、詳細が囲いになり、ハッシュが書かれ履歴が積まれる
  await page.click(`${DOCK} .dk-card:not([hidden])`); await wait(350);
  r.t1 = await snap(page);
  r.rects.push(r.t1.rect);
  r.added = !!r.t1.slots.me.castle && r.t1.selected === 'me.castle' && r.t1.detailKind.includes('囲い')
    && r.t1.chips.some(c => c.who === 'me' && c.kind === 'castle' && !c.implied
      && c.type === '囲い' && c.name.length > 0 && c.remove && !c.hasDescription);
  r.resetInMeBar = await page.evaluate(() => {
    const bar = document.querySelector('#cbarMe');
    const btn = bar.querySelector('.dk-clear');
    const chip = bar.querySelector('.cchip');
    const br = btn.getBoundingClientRect(), cr = chip.getBoundingClientRect(), barRect = bar.getBoundingClientRect();
    return btn.textContent === '×' && btn.getAttribute('aria-label') === '自分の囲い・戦法をリセット'
      && getComputedStyle(btn).borderRadius === '50%'
      && Math.abs((br.top + br.bottom - cr.top - cr.bottom) / 2) < 2
      && Math.abs(barRect.right - br.right) < 2
      && !document.querySelector('#pickRail .dk-clear');
  });
  r.pushed = /k=mc:/.test(r.t1.hash) && r.t1.hist === r.t0.hist + 1;

  // 戦法を選ぶ: 戦法タブに切り替えてからタイルを押す → selected=me.tactic・詳細が戦法
  await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`); await wait(250);
  await mark();
  r.tabSwitch = await page.evaluate(() =>
    __kakoi.store.state.selected === 'me.tactic' && document.querySelectorAll('#pickRail .dk-tile').length > 0);
  r.legendInTactic = await page.evaluate(() => getComputedStyle(document.querySelector('#pickRail .dk-legend')).display !== 'none'
    && getComputedStyle(document.querySelector('#pickRail .dk-sort-seg')).display === 'none');
  r.tiles = await page.$$eval(`${DOCK} .dk-tile`, els => els.length);
  r.vars = await page.$$eval(`${DOCK} .dk-var`, els => els.length);
  r.variantStyle = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#pickRail .dk-trow:not([hidden])')];
    const variants = rows.flatMap(row => [...row.querySelectorAll('.dk-var')]);
    const basics = rows.flatMap(row => [...row.querySelectorAll('.dk-tile[data-basic="true"]')]);
    return variants.length > 0 && variants.every(el => !el.hidden
      && getComputedStyle(el).display !== 'none' && !!el.querySelector('.dk-branch'))
      && basics.length > 0 && basics.every(el => !!el.querySelector('.dk-seal'))
      && !document.querySelector('.dk-vshow');
  });
  r.fileHdr = await page.evaluate(() => {   // 筋の番号ヘッダ: 列は盤の絶対座標（左=9筋）
    const fh = document.querySelector('#pickRail .dk-fh');
    return !!fh && [...fh.querySelectorAll('span')].map(s => s.textContent).join('') === '９８７６５４３２１';
  });
  await page.click(`${DOCK} .dk-tile:not([hidden])`); await wait(350);
  r.t2 = await snap(page);
  r.rects.push(r.t2.rect);
  r.tacticSel = !!r.t2.slots.me.tactic && r.t2.selected === 'me.tactic' && r.t2.detailKind.includes('戦法');
  r.horizontalChips = await page.evaluate(() => {
    const host = document.querySelector('#cbarMe .cbar-x');
    const chips = [...host.querySelectorAll('.cchip')];
    return getComputedStyle(host).flexWrap === 'nowrap'
      && chips.map(c => c.dataset.kind).join(',') === 'strategy,castle,tactic'
      && chips.map(c => c.dataset.position).join(',') === 'first,middle,last'
      && chips.every(c => ['ibisha', 'furibisha'].includes(c.dataset.strategy))
      && chips.every(c => getComputedStyle(c, '::before').clipPath.includes('polygon'))
      && chips.slice(0, 2).every(c => c.dataset.strategy === 'ibisha'
        ? getComputedStyle(c, '::after').clipPath.includes('polygon')
        : parseFloat(getComputedStyle(c, '::after').width) === 15)
      && Math.abs(chips[0].getBoundingClientRect().top - chips[2].getBoundingClientRect().top) < 1;
  });
  // 戦型チップ（先頭）: スロットではないが、押すと右ドックにその戦型の情報が出る。
  // 選択だけなので履歴は積まず、sel=ms がハッシュに乗る
  await page.click('#cbarMe .cchip-b[data-kind="strategy"]'); await wait(300);
  r.strategySel = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const d = document.querySelector('#detail');
    const chip = document.querySelector('#cbarMe .cchip[data-kind="strategy"]');
    const nm = chip.querySelector('.cchip-nm').textContent;
    return st.selected === 'me.strategy'
      && chip.dataset.sel === 'true'
      && chip.querySelector('.cchip-b').tagName === 'BUTTON'
      && (d.querySelector('.bd-who') || {}).textContent.includes('自分（先手・▲）の戦型')
      && (d.querySelector('.bd-t') || {}).textContent.includes(nm)
      && /スロットを持たず/.test(d.textContent)
      && d.querySelectorAll('.vchip[data-act="set"]').length > 0
      && /sel=ms/.test(location.hash);
  });
  // 別のタイルを押す → 自分の戦法が変わる（囲いは自動では変わらない）
  const tA = r.t2.slots.me.tactic, cA = r.t2.slots.me.castle;
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#pickRail .dk-tile:not([hidden])')]
      .find(el => el.getAttribute('aria-current') !== 'true');
    if (t) t.click();
  });
  await wait(350);
  r.t3 = await snap(page);
  r.rects.push(r.t3.rect);
  r.dockPick = r.t3.slots.me.tactic && r.t3.slots.me.tactic !== tA && r.t3.slots.me.castle === cA;
  // 戦略セグは絞り込み専用: 戦法・囲いのスロットも導出した戦略も変えず、合わない行だけ隠れる
  const stratA = r.t3.sides.me.strategy;
  const stratB = stratA === 'ibisha' ? 'furibisha' : 'ibisha';
  await page.click(`${DOCK} .dk-strategy button[data-value="${stratB}"]`); await wait(350);
  await mark();
  r.segFilter = await page.evaluate(([s, slots, strat]) => {
    const now = __kakoi.store.state;
    const rows = [...document.querySelectorAll('#pickRail .dk-trow')];
    return rows.length > 0 && rows.every(x => x.hidden === (x.dataset.side !== s))
      && JSON.stringify(now.slots) === JSON.stringify(slots)
      && Kakoi.constraints.sides(now.slots, now.showOpp).me.strategy === strat;
  }, [stratB, r.t3.slots, stratA]);
  // 囲いタブに戻す → 系統・カードも絞り込んだ戦略で絞られる（両側を許す囲いだけは残る）
  await page.click(`${DOCK} .dk-tab button[data-value="castle"]`); await wait(250);
  await mark();
  r.famFilter = await page.evaluate(strat => {
    const sidesOf = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);
    const byId = Object.fromEntries(Kakoi.CASTLES.map(c => [c.id, c]));
    const fams = [...document.querySelectorAll('#pickRail .dk-fam')];
    const cards = [...document.querySelectorAll('#pickRail .dk-card')];
    return fams.length > 0
      && fams.every(s => s.hidden === !s._sides.has(strat))
      && cards.every(c => c.hidden === !sidesOf(byId[c.dataset.id]).includes(strat));
  }, stratB);
  await page.click(`${DOCK} .dk-strategy button[data-value="${stratA}"]`); await wait(250);
  // 並べ方: 発展ツリーは from の子を字下げした行で出し、性質順は段（5→1）のブロックにする。
  await page.click(`${DOCK} .dk-sort-seg button[data-value="tree"]`); await wait(250);
  r.sortTree = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#pickRail .dk-tree .dk-row')];
    const shownRows = rows.filter(row => !row.hidden && !row.closest('.dk-fam').hidden);
    const byId = Object.fromEntries(Kakoi.CASTLES.map(c => [c.id, c]));
    return rows.length > 0 && rows.some(x => x.dataset.depth !== '0')
      && rows.filter(x => x.dataset.depth !== '0').every(x => byId[x.dataset.id].from)
      && shownRows.every(x => {
        const thumb = x.querySelector('.thumb').getBoundingClientRect();
        return Math.round(thumb.width) === 54 && Math.round(thumb.height) === 36;
      });
  });
  await page.click(`${DOCK} .dk-sort-seg button[data-value="hard"]`); await wait(250);
  r.sortAxis = await page.evaluate(() => [...document.querySelectorAll('#pickRail .dk-fam')]
    .every(s => [...s.querySelectorAll('.dk-card')].every(c =>
      `hard${Kakoi.CASTLES.find(x => x.id === c.dataset.id).ratings.hard}` === s.dataset.family)));
  await page.click(`${DOCK} .dk-sort-seg button[data-value="family"]`); await wait(250);
  // A「系統の色と印」: 系統ブロックは系統色の帯（4px）を持ち、並べ方は開かずに全部見える選択肢
  r.famColors = await page.evaluate(() => {
    const fams = [...document.querySelectorAll('#pickRail .dk-fam:not([hidden])')];
    const sorts = [...document.querySelectorAll('#pickRail .dk-sort-seg button')];
    const sortIds = sorts.map(button => button.dataset.value);
      const strategy = document.querySelector('#pickRail .dk-strategy').getBoundingClientRect();
      const tabs = document.querySelector('#pickRail .dk-tab').getBoundingClientRect();
      const sortBar = document.querySelector('#pickRail .dk-sort-seg').getBoundingClientRect();
    const cards = document.querySelector('#pickRail .dk-cards');
    const thumb = document.querySelector('#pickRail .dk-card .thumb').getBoundingClientRect();
    return fams.length > 0 && fams.every(s => s.style.getPropertyValue('--fam').startsWith('var(--f-')
        && getComputedStyle(s).borderLeftWidth === '4px')
      && sorts.length === Kakoi.dockGrids.CASTLE_SORTS.length && sorts.every(b => b.offsetWidth > 0)
      && !sortIds.includes('wide') && !sortIds.includes('quick')
        && strategy.bottom < tabs.top
        && tabs.bottom <= sortBar.top
      && getComputedStyle(cards).gridTemplateColumns.split(' ').length === 3
      && Math.round(thumb.height) === 50
      && !document.querySelector('#pickRail .dk-sort select');
  });
  r.basicStyle = await page.evaluate(() => {
    const basics = [...document.querySelectorAll('#pickRail .dk-item[data-basic="true"]')];
    return basics.length > 0 && basics.every(el => !!el.querySelector('.dk-seal'))
      && !document.querySelector('.dk-basic');
  });

  // 両立しない選択: いまの戦法と合わない囲い（✕の破線枠）を選んでも他の層は差し替わらず、
  // チップに ✕ と理由、右ドックに理由と直す候補が出る。候補を押すと両立する選択に直る
  const badBadge = await page.evaluate(() => [...document.querySelectorAll('#pickRail .dk-card')]
    .filter(c => c.dataset.ng === 'true').length);
  r.ngBadges = badBadge;
  const tBefore = (await snap(page)).slots.me.tactic;
  await page.evaluate(() => document.querySelector('#pickRail .dk-card[data-ng="true"]').click());
  await wait(400);
  r.t4 = await snap(page);
  r.rects.push(r.t4.rect);
  r.ngKept = r.t4.slots.me.tactic === tBefore && !!r.t4.slots.me.castle;   // 自動で差し替えない
  r.ngChip = r.t4.chips.some(c => c.who === 'me' && c.kind === 'castle' && c.ng && c.mark === '✕')
    && await page.evaluate(() => /両立しない/.test(document.querySelector('#cbarMe .cchip[data-kind="castle"] .cchip-b').title));
  r.ngDetail = await page.evaluate(() => {
    const d = document.querySelector('#detail');
    return /両立しません/.test(d.textContent) && d.querySelectorAll('.vchip[data-act="set"]').length > 0;
  });
  r.noToast = await page.evaluate(() => !document.querySelector('.toast.on'));   // 連動トーストは無い
  const ngId = r.t4.slots.me.castle;
  await page.locator('#detail .vchip[data-act="set"]').first().click(); await wait(400);
  r.t4b = await snap(page);
  r.rects.push(r.t4b.rect);
  r.ngFixed = !!r.t4b.slots.me.castle && r.t4b.slots.me.castle !== ngId && r.t4b.slots.me.tactic === tBefore
    && !r.t4b.chips.some(c => c.ng);
  await mark();

  // 相手の駒の見出しを押して、相手の表示 ON と相手側への選択を同時に行う
  r.oppOffInit = await page.evaluate(() => !__kakoi.store.state.showOpp
    && document.querySelector('#pickRail .dk-binder').dataset.show === 'false');
  await page.click(`${DOCK} .dk-pc[data-who="opp"]`);
  r.oppOnAnimation = await page.evaluate(() => document.querySelector('#bandOpp').getAnimations()
    .some(animation => animation.playState === 'running'));
  await wait(450);
  r.t5 = await snap(page);
  r.rects.push(r.t5.rect);
  r.boardOrderOppOn = await page.evaluate(() => {
    const opp = document.querySelector('#bandOpp').getBoundingClientRect();
    const rel = document.querySelector('#relationshipLabels').getBoundingClientRect();
    const board = document.querySelector('#board').getBoundingClientRect();
    const me = document.querySelector('#bandMe').getBoundingClientRect();
    return opp.bottom <= rel.top && rel.bottom <= me.top && me.bottom <= board.top;
  });
  r.oppOn = r.t5.showOpp && (r.t5.canvas || r.t5.gote > 0) && !r.t5.bandOppEmpty
    && await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled)
    && r.t5.selected.startsWith('opp.') && /opp=1/.test(r.t5.hash);
  r.threatOn = r.t5.threats >= 1;
  r.labels = r.t5.relationships.length > 0
    && await page.$eval('#relationshipLabels', el => el.dataset.empty === 'false');
  // 相手タブは相手の面（筋が反転）を選択した状態になっている
  r.oppTab = await page.evaluate(() => __kakoi.store.state.selected.startsWith('opp.')
    && document.querySelector('#pickRail .dk').dataset.who === 'opp');
  await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`); await wait(250);
  r.flipCol = await page.evaluate(() => {   // 相手の面は筋が反転: 四間飛車（先手6筋）は盤の4筋=グリッド列6
    const t = document.querySelector('#pickRail .dk-tile[data-id="shikenbisha"]');
    const cell = t && t.closest('.dk-cell');
    return cell ? getComputedStyle(cell).gridColumnStart : null;
  });
  await page.click(`${DOCK} .dk-tile:not([hidden])`); await wait(400);
  r.t5b = await snap(page);
  r.rects.push(r.t5b.rect);
  r.oppSel = !!r.t5b.slots.opp.tactic && r.t5b.selected === 'opp.tactic';
  r.resetInOppBar = await page.evaluate(() => {
    const btn = document.querySelector('#cbarOpp .dk-clear');
    return btn && btn.textContent === '×' && btn.getAttribute('aria-label') === '相手の囲い・戦法をリセット';
  });
  r.oppSmaller = await page.evaluate(() => {
    const o = document.querySelector('#cbarOpp .cchip');
    const m = document.querySelector('#cbarMe .cchip');
    return !!o && !!m && o.getBoundingClientRect().height < m.getBoundingClientRect().height;
  });
  // 相手側の戦型チップも押せる: 右ドックに相手の戦型の情報が出る（sel=os がハッシュに乗る）
  await page.click('#cbarOpp .cchip-b[data-kind="strategy"]'); await wait(300);
  r.oppStrategySel = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const d = document.querySelector('#detail');
    const chip = document.querySelector('#cbarOpp .cchip[data-kind="strategy"]');
    return st.selected === 'opp.strategy'
      && chip.dataset.sel === 'true'
      && (d.querySelector('.bd-who') || {}).textContent.includes('相手（後手・△）の戦型')
      && (d.querySelector('.bd-t') || {}).textContent.includes(chip.querySelector('.cchip-nm').textContent)
      && /合わせた戦型/.test(d.textContent)   // 相手がいるときは組み合わせの戦型も出る
      && /sel=os/.test(location.hash);
  });
  await page.click(`${DOCK} .dk-pc-x`);
  r.oppOffAnimation = await page.evaluate(() => document.querySelector('#bandOpp').getAnimations()
    .some(animation => animation.playState === 'running'));
  await wait(350);
  r.oppDockOff = await page.evaluate(() => {
    const st = __kakoi.store.state;
    return !st.showOpp && !st.selected.startsWith('opp.')
      && document.querySelector('#pickRail .dk-binder').dataset.show === 'false'
      && document.querySelector('.dk-pc-x').hidden;
  });
  await page.click(`${DOCK} .dk-pc[data-who="opp"]`); await wait(350);
  r.oppDockOn = await page.evaluate(() => __kakoi.store.state.showOpp
    && __kakoi.store.state.selected.startsWith('opp.'));
  // 表示設定のポップオーバー: 脅威の帯を切ると帯が消える（盤の状態には載らない）
  await page.click('#toolsToggle'); await wait(150);
  r.popover = await page.evaluate(() => {
    const t = document.querySelector('#tools');
    return t.classList.contains('open') && t.offsetHeight > 0
      && [...t.querySelectorAll('#modeSeg button')].length === 2
      && !!t.querySelector('#heat') && !!t.querySelector('#threat') && !!t.querySelector('#resetSettings');
  });
  await page.keyboard.press('Escape');
  r.toolsEscape = await page.evaluate(() => !document.querySelector('#tools').classList.contains('open')
    && document.querySelector('#toolsToggle').getAttribute('aria-expanded') === 'false'
    && document.activeElement === document.querySelector('#toolsToggle'));
  await page.click('#toolsToggle');
  await page.locator('h1').click();
  r.toolsOutside = await page.evaluate(() => !document.querySelector('#tools').classList.contains('open')
    && document.querySelector('#toolsToggle').getAttribute('aria-expanded') === 'false');
  await page.click('#toolsToggle');
  await page.click('#threat'); await wait(300);
  r.t6 = await snap(page);
  r.rects.push(r.t6.rect);
  r.threatOff = r.t6.threats === 0;
  r.threatPref = await page.evaluate(() => localStorage.getItem('shogi-castle:showThreat') === 'false'
    && !/mw=/.test(location.hash));
  await page.click('#threat'); await wait(300);
  await page.click('#toolsToggle');
  await mark();

  // × でスロットを外す（相手のバーの明示チップ）。外すと既定チップに変わる
  const xCount = await page.$$eval('#cbarOpp .cchip-x', els => els.length);
  if (xCount) {
    const n0 = await page.evaluate(() => Object.values(__kakoi.store.state.slots.opp).filter(Boolean).length);
    await page.locator('#cbarOpp .cchip-x').last().click(); await wait(300);
    r.removed = await page.evaluate(n => Object.values(__kakoi.store.state.slots.opp).filter(Boolean).length === n - 1, n0);
    await mark();
  }

  // 相手の表示を OFF → 後手の駒・脅威の帯が退き、相手タブは有効のまま、選択は自分側へ戻る
  const oppSlots = JSON.stringify((await snap(page)).slots.opp);
  await page.click(`${DOCK} .dk-pc-x`); await wait(400);
  r.t8 = await snap(page);
  r.rects.push(r.t8.rect);
  r.oppOff = !r.t8.showOpp && r.t8.threats === 0 && (r.t8.canvas || r.t8.gote === 0)
    && r.t8.bandOppEmpty && r.t8.selected.startsWith('me.')
    && await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled)
    && JSON.stringify(r.t8.slots.opp) === oppSlots;

  // 制約バーの「リセット」: 見ている側の戦法・囲いを両方外し、トーストの「元に戻す」で戻る
  const preClear = JSON.stringify((await snap(page)).slots);
  await page.click('#cbarMe .dk-clear'); await wait(400);
  r.t9 = await snap(page);
  r.cleared = !r.t9.slots.me.tactic && !r.t9.slots.me.castle && JSON.stringify(r.t9.slots.opp) === oppSlots
    && !!(await page.$('.toast.on .toast-act'));
  await page.click('.toast .toast-act'); await wait(400);
  r.undoClear = await page.evaluate(p => JSON.stringify(__kakoi.store.state.slots) === p, preClear);

  // 矢印キー: 戦法を選択しているとき ←→ で戦法が送れる（制約バーのチップで selected を戦法にする）
  await page.click('#cbarMe .cchip-b[data-who="me"][data-kind="tactic"]'); await wait(300);
  await mark();
  const tId0 = await page.evaluate(() => __kakoi.store.state.slots.me.tactic);
  await page.focus('#board');
  await page.keyboard.press('ArrowRight'); await wait(250);
  const tId1 = await page.evaluate(() => __kakoi.store.state.slots.me.tactic);
  r.keyNav = tId0 !== tId1;
  // U3: 矢印キーでフォーカスが失われない。盤（中央）では矢印は選択を動かし、フォーカスは盤に残る
  r.focusBoard = await page.evaluate(() => document.activeElement && document.activeElement.id === 'board');
  await mark();
  //   制約チップでは矢印は roving がフォーカスだけを動かす（選択は変えず、body にも逃がさない）
  const chip = await page.$('#cbarMe .cchip-b:not([data-kind="strategy"])');
  if (chip) {
    await chip.focus();
    await page.keyboard.press('ArrowRight'); await wait(200);
    r.focusChip = await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('cchip-b'));
  } else r.focusChip = null;
  await mark();

  // 守りの利き: ON/OFF のみ（数える範囲は囲いの駒に固定）。駒の表示は全駒／囲いを強調の2択
  await page.click('#toolsToggle');
  for (const v of ['all', 'dim']) await page.click(`#modeSeg button[data-value="${v}"]`);
  await page.click('#heat'); await wait(250);
  r.heatOn = await page.$$eval('#board .sq .h', els => els.length);
  await page.click('#heat'); await wait(200);
  await page.click('#toolsToggle');

  // 履歴: 「戻る」で直前のスロットの変更だけが戻る（undo.js は無い。Ctrl+Z は使わない）
  {
    const pre = JSON.stringify((await snap(page)).slots);
    await page.click(`${DOCK} .dk-item:not([hidden]):not([aria-current="true"])`); await wait(350);
    const mid = JSON.stringify((await snap(page)).slots);
    await mark();
    await page.goBack(); await wait(400);
    r.goBack = JSON.stringify((await snap(page)).slots) === pre && mid !== pre;
    await page.goForward(); await wait(400);
    r.goForward = JSON.stringify((await snap(page)).slots) === mid;
    await mark();
  }
  // 選択だけの変更は履歴を積まない（replaceState）
  {
    const h0 = (await snap(page)).hist;
    await page.click('#cbarMe .cchip-b[data-kind="castle"]'); await wait(250);
    await page.click('#cbarMe .cchip-b[data-kind="tactic"]'); await wait(250);
    await page.click('#cbarMe .cchip-b[data-kind="strategy"]'); await wait(250);
    r.selNoPush = (await snap(page)).hist === h0;
  }

  // ハッシュ往復: いまのハッシュで開き直すと同じスロット・選択・相手の表示になる
  const cur = await snap(page);
  r.hashFormat = /^#k=/.test(cur.hash) && !/[#&]v=/.test(cur.hash) && !/[#&]k=[^&]*[mo]s:/.test(cur.hash);
  await page.goto(page.url().split('#')[0] + '&rt=1' + cur.hash, { waitUntil: 'networkidle' });
  await wait(400);
  const back = await snap(page);
  r.hashRoundTrip = JSON.stringify(back.slots) === JSON.stringify(cur.slots)
    && back.selected === cur.selected && back.showOpp === cur.showOpp;
  // アドレスバーの書き換え（popstate）が状態へ届く
  {
    await page.evaluate(() => { location.hash = 'k=ot:shikenbisha,mc:yagura&opp=1&sel=mc'; });
    await wait(400);
    r.hashChange = await page.evaluate(() => {
      const st = __kakoi.store.state;
      return st.slots.opp.tactic === 'shikenbisha' && st.slots.me.castle === 'yagura' && st.showOpp
        && st.selected === 'me.castle';
    });
    await mark();
  }
  // 旧形式のハッシュ・旧保存値は初期状態で開く（移行コードは無い）
  {
    await page.goto(page.url().split('#')[0] + '&legacy=1#v=castle&c=yagura&k=os:furibisha,ms:ibisha&sel=ms&mw=0',
      { waitUntil: 'networkidle' });
    await wait(300);
    r.legacyInitial = await page.evaluate(() => {
      const st = __kakoi.store.state;
      return JSON.stringify(st.slots) === JSON.stringify(Kakoi.constraints.emptySlots()) && !st.showOpp
        && st.showThreat === true && (location.hash === '' || location.hash === '#');
    });
  }

  // 盤をリセット（表示設定のポップオーバー）: ハッシュが空になり、「戻る」で戻れる
  {
    await page.goto(page.url().split('#')[0] + '#k=mt:bougin,mc:funa&opp=1&sel=mc', { waitUntil: 'networkidle' });
    await wait(300);
    await page.reload({ waitUntil: 'networkidle' }); await wait(300);
    await page.click('#toolsToggle');
    await page.click('#resetSettings'); await wait(400);
    await page.click('#toolsToggle');
    r.reset = await page.evaluate(() => {
      const st = __kakoi.store.state;
      return JSON.stringify(st.slots) === JSON.stringify(Kakoi.constraints.emptySlots()) && !st.showOpp
        && (location.hash === '' || location.hash === '#');
    });
    await page.goBack(); await wait(400);
    r.resetBack = await page.evaluate(() => __kakoi.store.state.slots.me.castle === 'funa' && __kakoi.store.state.showOpp);
  }
  // F1: 巡回の全ステップで盤の矩形が変わらない（±0.5px）
  const baseR = r.rects[0];
  r.rectDrift = r.rects.map(x => rectsEqual(x, baseR)).indexOf(false);   // -1 なら全一致
  return r;
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

// DOM 駒（?flat）は静止表示: 局面を切り替えても .pc は即座に新しいマスにあり、滑らせる処理を持たない
async function checkFlat(page) {
  await page.evaluate(() => {
    const board = window.__kakoi.board, K = window.Kakoi;
    board.render(K.Position.fromPieces('銀79', { leadSquare: '79' }), { mode: 'all', heat: null, animate: false });
    board.render(K.Position.fromPieces('銀46', { leadSquare: '46' }), {
      mode: 'all', heat: null, animate: true,
      trace: { square: '46', piece: '銀', path: ['79', '68', '57', '46'] },
    });
  });
  return page.evaluate(() => {
    const layer = window.__kakoi.board.layer;
    const pcs = [...document.querySelectorAll('#board .pc')];
    return layer.kind === 'flat' && layer.animates === false && pcs.length === 1
      && pcs[0].parentElement.dataset.sq === '46' && pcs[0].getAnimations().length === 0
      && !document.querySelector('#board canvas');
  });
}

async function checkRookArrows(browser, url, errs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, errs);
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${url}&flat`, { waitUntil: 'networkidle' });
  await page.click(`${DOCK} .dk-strategy button[data-value="furibisha"]`);
  await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`);
  await page.click(`${DOCK} .dk-tile[data-id="mukaibisha"]`);
  await page.click(`${DOCK} .dk-pc[data-who="opp"]`);
  await page.click(`${DOCK} .dk-strategy button[data-value="furibisha"]`);
  await page.click(`${DOCK} .dk-tile[data-id="mukaibisha"]`);
  await wait(300);
  const result = await page.evaluate(() => {
    const routes = [...document.querySelectorAll('#board .rt-g .rt')];
    const throughRoutes = [...document.querySelectorAll('#board .rt-through-g .rt')];
    const me = routes.find(el => el.classList.contains('rt-ink'));
    const opp = routes.find(el => el.classList.contains('rt-bad'));
    const routeZ = getComputedStyle(document.querySelector('#board .overlay')).zIndex;
    const through = document.querySelector('#board .overlay-through');
    const squareZ = getComputedStyle(document.querySelector('#board .sq')).zIndex;
    const pieceZ = getComputedStyle(document.querySelector('#board .pc')).zIndex;
    const endpoint = route => route && route.getAttribute('points').split(' ').at(-1).split(',').map(Number);
    const meEnd = endpoint(me), oppEnd = endpoint(opp);
    return routes.length === 2 && throughRoutes.length === 2 && meEnd && oppEnd
      && routeZ === '0' && squareZ === '1' && pieceZ === '1'
      && getComputedStyle(through).zIndex === '3' && Math.abs(parseFloat(getComputedStyle(through).opacity) - .2) < .01
      && Math.abs(Math.hypot(meEnd[0] - 1.5, meEnd[1] - 7.5) - .42) < .01
      && Math.abs(Math.hypot(oppEnd[0] - 7.5, oppEnd[1] - 1.5) - .42) < .01;
  });
  await page.close();
  return result;
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
      ok(await checkRookArrows(browser, baseDebug, errs),
        '飛車の矢印は駒の後ろを通り、駒上では薄く透けて見える');
      // ---- 巡回（1440px ライト。?debug で window.__kakoi を立てて状態を見る） ----
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      watch(page, errs);
      // 保存値に左右されないよう、このページの localStorage を空にしてから開く（巡回の途中で開き直しても保つ）
      await page.addInitScript(() => { try { if (!sessionStorage.getItem('ui-check')) { localStorage.clear(); sessionStorage.setItem('ui-check', '1'); } } catch (e) {} });
      await page.goto(baseDebug, { waitUntil: 'networkidle' });
      // 期待件数はデータから導出する（追加のたびに書き換えない）
      const expect = await page.evaluate(() => ({
        castles: Kakoi.CASTLES.length,
        tactics: Kakoi.TACTICS.length,
        famsUsed: new Set(Kakoi.CASTLES.map(c => c.family)).size,
        tacticTiles: Kakoi.TACTICS.filter(t => !t.variantOf).length,   // 派生は親タイルのチップに束ねる
        tacticVars: Kakoi.TACTICS.filter(t => !!t.variantOf).length,
      }));

      const b = await sweepBoard(page, expect);
      ok(b.panes === 1 && b.oppTabEnabled, '左ドックは1枚の面（自分/相手タブ）。相手タブは OFF 時も有効', `panes=${b.panes} 相手タブ有効=${b.oppTabEnabled}`);
      ok(b.binderStyle, 'バインダーは上下端に配置し、相手 OFF 時は点線の駒影を残す', '');
      ok(b.layerTabs.join(',') === '囲い,戦法', '左ドックのタブ順は囲い→戦法', b.layerTabs.join(' → '));
      ok(b.layerBinder, '囲い／戦法はバインダー形状で、選択中のタブが前面に見える', '');
      ok(b.layerSwitchStable, '囲い／戦法を切り替えてもタブ列が上下に揺れない', '');
      ok(b.legendRow && b.legendAnchor && b.legendInTactic, '記号の見方はソート横にあり、戦法表示でも利用できる', '');
      ok(b.strategyOrder.join(',') === 'furibisha,ibisha', '左ドックの戦型トグルは振り飛車→居飛車', b.strategyOrder.join(' → '));
      ok(b.controlOrder, '戦型、囲い／戦法、囲いソートの順に縦配置', '');
      ok(b.sortTree, '囲いの並べ方「発展ツリー」: 発展形は from を持ち字下げした行で出る', '');
      ok(b.sortAxis, '囲いの並べ方「堅さ順」: 各段のブロックに同じ堅さの囲いだけが入る', '');
      ok(b.famColors, 'A案: 系統色の帯と3列タイル、戦略と並べ方を別段に表示', '');
      ok(b.basicStyle, '基本の囲いは朱の印で識別され、絞り込みトグルは無い', '');
      ok(b.noOldUi, '廃止した UI（画面切替・相手を加える・全部はずす・骨格線・利きの範囲・スプリッタ・面の折りたたみ・ドックの脅威スイッチ）が無い', '');
      ok(b.noClusterCss, '分類マップの CSS を読み込まない', '');
      ok(b.hashEmpty0, '初期状態のハッシュは空', '');
      ok(b.bandGhost0, '相手の表示 OFF の間は相手の帯が幽霊行で、後手の駒は出ない', '');
      ok(b.boardStageOffset <= 8, '盤面は帯の下の残り領域の上下中央に配置される', `${b.boardStageOffset}px`);
      ok(b.boardOrder && b.boardOrderOppOn, '相手→関係ラベル→自分の制約行を盤の上に並べる', '');
      ok(b.boardBandGaps.every(gap => gap <= 125), '盤面と相手・自分の表示帯の余白を抑える', `${b.boardBandGaps.join('px / ')}px`);
      ok(b.oppSmaller, '相手の制約チップは自分のものより小さい', '');
      ok(b.rectDrift === -1, '盤の矩形は全ステップで不変（F1 ±0.5px）', `ずれたステップ=${b.rectDrift}`);
      ok(b.cards === expect.castles, '囲いタイル', `${b.cards}枚`);
      ok(b.fams === expect.famsUsed, '囲いのクラスタ見出し（系統ごと）', `${b.fams}系統`);
      ok(b.tiles === expect.tacticTiles && b.vars === expect.tacticVars,
        '戦法タイル（1マス1タイル＋派生はチップ）', `tiles=${b.tiles} vars=${b.vars}`);
      ok(b.segs === 2, '戦略の絞り込みは居飛車/振り飛車の2択（面は1つ）', `${b.segs}個`);
      ok(b.flipCol === '6', '相手の面は筋が反転（四間飛車=盤の4筋の列）', `列=${b.flipCol}`);
      ok(b.collapse, '系統ブロックを折りたためる', '');
      ok(b.tabSwitch, '面のタブ切替（囲い→戦法）で選択も戦法になる', '');
      ok(b.added, '囲いを選ぶ→スロットとチップが増え、詳細が囲いになる', JSON.stringify(b.t1 && b.t1.slots));
      ok(b.horizontalChips, '制約カプセルは戦型→囲い→戦法の順で連結', '');
      ok(b.resetInMeBar, '丸いリセット×を自分の制約行の右端に表示', '');
      ok(b.pushed, 'スロットの変更でハッシュが書かれ履歴が積まれる（pushState）', `${b.t1 && b.t1.hash} hist=${b.t1 && b.t1.hist}`);
      ok(b.tacticSel, '戦法を選ぶ→選択と詳細が戦法になる', `sel=${b.t2 && b.t2.selected}`);
      ok(b.strategySel, '戦型チップを押すと右ドックに戦型の情報（導出元・既定・この戦型の囲い）が出る', '');
      ok(b.oppStrategySel, '相手側の戦型チップも右ドックに出る（相手の面・組み合わせの戦型つき）', '');
      ok(b.dockPick, 'ドックの筋タイルで戦法が変わり、囲いは自動では変わらない', `sel=${b.t3 && b.t3.selected}`);
      ok(b.variantStyle, '派生戦法は分岐チップで常に表示され、表示トグルは無い', `${b.vars}件`);
      ok(b.fileHdr, '戦法グリッドの上に筋の番号（９…１）', '');
      ok(b.segFilter && b.famFilter, '戦略セグは一覧の絞り込みだけ（スロット・導出した戦略は不変）', `rows=${b.segFilter} fams=${b.famFilter}`);
      ok(b.ngBadges > 0, 'いまの組み合わせと両立しない項目に✕の印（data-ng）が出る', `${b.ngBadges}件`);
      ok(b.ngKept, '両立しない囲いを選んでも戦法は自動で差し替わらない', JSON.stringify(b.t4 && b.t4.slots));
      ok(b.ngChip, '両立しない明示チップに ✕ と理由（title）が出る', JSON.stringify(b.t4 && b.t4.chips));
      ok(b.ngDetail, '右ドックに理由と直す候補が出る', '');
      ok(b.noToast, '連動トーストは出ない', '');
      ok(b.ngFixed, '直す候補を押すと両立する選択になる（他の層は不変）', JSON.stringify(b.t4b && b.t4b.slots));
      ok(b.oppOffInit && b.oppOn, '相手 △ から相手表示を ON にして相手側を選べる', `${b.t5 && b.t5.hash}`);
      ok(b.threatOn, '相手を表示すると脅威の帯が出る', `${b.t5 && b.t5.threats}本`);
      ok(b.labels, '相手と自分の関係ラベルを2行の間に表示', JSON.stringify(b.t5 && b.t5.relationships));
      ok(b.oppTab && b.oppSel, '相手タブで相手のスロットを選べる', `sel=${b.t5b && b.t5b.selected}`);
      ok(b.resetInOppBar, '相手を選択中は相手の制約行右端に丸いリセット×を表示', '');
      ok(b.oppDockOff && b.oppDockOn && b.oppOnAnimation && b.oppOffAnimation,
        '左ドックの ON/OFF で相手の帯がフェードし、再表示もできる', '');
      ok(b.popover, '表示設定は1つのポップオーバー（駒の表示2択・利き・脅威の帯・リセット）', '');
      ok(b.toolsEscape && b.toolsOutside, '表示設定は Escape とパネル外クリックで閉じる', '');
      ok(b.threatOff && b.threatPref, '脅威の帯は表示設定のスイッチ（localStorage の好み。URL には載らない）', `${b.t6 && b.t6.threats}本`);
      ok(b.removed !== false, '×でスロットを外せる', '');
      ok(b.oppOff, '相手を OFF → 後手の駒・帯が退き、相手タブは有効のまま、相手のスロットは残る', JSON.stringify(b.t8 && b.t8.slots));
      ok(b.cleared && b.undoClear, '制約バーの「リセット」で見ている側を初期化し、トーストの「元に戻す」で戻る', JSON.stringify(b.t9 && b.t9.slots));
      ok(b.keyNav, '矢印キーで戦法を送れる', '');
      ok(b.focusBoard && b.focusChip !== false, '矢印キーでフォーカスが保たれる（U3）',
        `盤=${b.focusBoard} チップ=${b.focusChip}`);
      ok(b.heatOn > 0, '守りの利きを点けるとヒートが出る', `${b.heatOn}マス`);
      ok(b.goBack && b.goForward, 'ブラウザの「戻る／進む」でスロットの変更が元に戻る・やり直せる', `back=${b.goBack} fwd=${b.goForward}`);
      ok(b.selNoPush, '選択だけの変更は履歴を積まない（replaceState）', '');
      ok(b.thumbMinPx >= 12, 'サムネイルの字は12px以上（F3）', `${b.thumbMinPx}px`);
      ok(b.hashFormat, 'ハッシュは k=…（v= も戦略層も無い）', '');
      ok(b.hashRoundTrip, 'ハッシュ往復で同じ状態が開ける', '');
      ok(b.hashChange, 'アドレスバーの書き換え（popstate）が状態に届く', '');
      ok(b.legacyInitial, '旧形式のハッシュは初期状態で開く（移行コードなし）', '');
      ok(b.reset && b.resetBack, '盤をリセット→ハッシュが空・「戻る」で戻れる', `reset=${b.reset} back=${b.resetBack}`);

      // ---- 各幅でのスクロール検査 ----
      for (const w of WIDTHS.filter(w => w >= NO_SCROLL_MIN)) {
        await page.setViewportSize({ width: w, height: 900 }); await wait(250);
        const r = await page.evaluate(() => { const d = document.documentElement; return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth }; });
        ok(r.sw <= r.iw + 1 && r.sh <= r.ih + 1, `board@w${w} ページスクロールなし`, `${r.sw}x${r.sh} > ${r.iw}x${r.ih}`);
      }

      // ---- w=1100: 右ドックはドロワー（§4-6）。タブ＋制約選択で開き、閉じても横スクロールしない ----
      await page.setViewportSize({ width: 1100, height: 900 }); await wait(400);
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
      // 制約を選ぶとドロワーが開く（§4-6）
      await page.click('#detailToggle'); await wait(350);
      await page.click(`${DOCK} .dk-item:not([hidden]):not([aria-current="true"])`); await wait(400);
      const dw2 = await page.evaluate(() => ({
        open: document.body.dataset.drawer === 'open',
        sw: document.documentElement.scrollWidth, iw: innerWidth,
      }));
      ok(dw2.open && dw2.sw <= dw2.iw + 1, 'w=1100 制約を選ぶとドロワーが開く（開いても横スクロールなし）', JSON.stringify(dw2));
      await page.evaluate(() => { delete document.body.dataset.drawer; });
      await page.setViewportSize({ width: 1440, height: 900 }); await wait(250);
      await page.setViewportSize({ width: 390, height: 844 }); await wait(300);
      // モバイル: 横スクロールなし＋盤は幅いっぱいに潰れない
      await checkFit(page, 390);
      const bw = await page.evaluate(() => Math.round(document.querySelector('#board').getBoundingClientRect().width));
      ok(bw >= 300, 'w=390 盤が幅いっぱい', `${bw}px`);
      // モバイル: 表示設定は歯車で開閉するポップオーバー（広い画面と同じ部品）
      const tools = await page.evaluate(() => {
        const btn = document.querySelector('#toolsToggle'), panel = document.querySelector('#tools');
        const hidden = !panel.classList.contains('open') && panel.offsetHeight === 0;
        btn.click();
        const open = panel.classList.contains('open') && panel.offsetHeight > 0;
        const inside = panel.getBoundingClientRect().right <= innerWidth + 1;
        btn.click();
        const closed = !panel.classList.contains('open');
        return { shown: getComputedStyle(btn).display !== 'none', hidden, open, inside, closed };
      });
      ok(tools.shown && tools.hidden && tools.open && tools.inside && tools.closed, 'w=390 表示設定の開閉', JSON.stringify(tools));
      await page.close();

      const resizePage = await browser.newPage({ viewport: { width: 1100, height: 850 } });
      resizePage.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
      await resizePage.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await resizePage.goto(baseDebug, { waitUntil: 'networkidle' });
      const resizeOk = await checkResizeAnimation(resizePage);
      if (resizeOk === null) warn('WebGL非対応のため立体駒リサイズテストをスキップ');
      else ok(resizeOk, '立体駒: リサイズ時に進行中アニメを完了させる');
      await resizePage.close();

      // ?flat: DOM 駒は静止表示（アニメなし）で、スロットの選択も効く
      const flatPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      watch(flatPage, errs);
      await flatPage.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await flatPage.goto(`${baseDebug}&flat`, { waitUntil: 'networkidle' });
      ok(await checkFlat(flatPage), '?flat: DOM 駒は静止表示（立体レイヤなし・アニメなし）');
      await flatPage.click(`${DOCK} .dk-card:not([hidden])`); await wait(400);
      ok(await flatPage.evaluate(() => document.querySelectorAll('#board .pc').length > 0 && !!__kakoi.store.state.slots.me.castle),
        '?flat: 囲いを選ぶと DOM 駒が描き直される', '');
      await flatPage.close();
      ok(errs.length === 0, 'JSエラー・404なし', errs.slice(0, 5).join(' | '));
    }

    // ---- スクリーンショット（対局図。相手を表示し、両立しない選択を含む状態も撮る） ----
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage();
      await page.addInitScript(s => { try { localStorage.setItem('shogi-theme', s); } catch (e) {} document.documentElement.dataset.theme = s; }, scheme);
      watch(page, errs);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await page.goto(`${base}#k=mt:shikenbisha,mc:mino,ot:bougin,oc:yagura&opp=1&sel=mc`, { waitUntil: 'networkidle' });
        await wait(500);
        await page.screenshot({ path: path.join(SHOTS, `board-${w}-${scheme}.png`) });
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
