#!/usr/bin/env node
'use strict';
/* 画面の検証: 対局図と「手筋と格言」全画面モードを巡回し、
   JSエラー・ページのスクロール(幅980px以上では出ない)・スロットの選択/解除・
   両立しない選択の✕と直す候補・相手の表示ON/OFF・左レールのタブ・
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
// スクリーンショットは [幅, 高さ]: 360 縦と 844×390 横（モバイル横向き）も撮る（D4）
const SHOT_SHAPES = [[1440, 900], [1280, 900], [1100, 900], [1024, 900], [390, 844], [360, 740], [844, 390]];
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
// 盤の矩形（F1 の不変条件: 幅・高さ・横位置は ±0.5px 以内。制約フィールドは相手の
// 表示や深い囲いで高さが伸び縮みし、盤は残りの行の上下中央に来るので、縦位置は
// 「帯の下端」に対する相対（2y - 帯下端）で見る）
const boardRect = page => page.evaluate(() => {
  const b = document.querySelector('#board').getBoundingClientRect();
  const f = document.querySelector('#cfield').getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height, fb: f.bottom };
});
// ?debug で立つ window.__kakoi 経由の状態スナップショット
// 制約フィールド（#cfield）: 胞の当たり判定は透明な <button class="cf-hit"> で
// data-who/data-kind/data-id/data-empty/data-implied/data-sel を持つ（「＋相手」の
// 胞 .cf-opp は data-kind を持たない）。明示した層の × は .cf-x[data-key="who.kind.id"]、
// 側のリセットは .cf-clear[data-who]。既定値の胞は SVG 側の .cf-cell.imp
// （網掛け #cf-hatch＋破線の縁）。両立しない胞は .cf-mod.ng + .cf-cng（✕…）。
const snap = page => page.evaluate(() => {
  const st = __kakoi.store.state;
  const b = document.querySelector('#board').getBoundingClientRect();
  // 描画側の ✕: ng の胞モジュールには .cf-mod.ng の下に .cf-cng（✕＋理由）が描かれる。
  // 戦法は駒ごとの枠が複数あるので種別（castle/tactic）で絞って見る
  const ngMark = (who, kind) => {
    const mod = kind === 'castle' ? '.cf-mod.cf-castle' : kind === 'tactic' ? '.cf-mod.cf-tactic' : null;
    if (!mod) return '';
    const el = document.querySelector(`#cfield .cf-row.cf-${who} ${mod}.ng .cf-cng`);
    return el && /✕/.test(el.textContent) ? '✕' : '';
  };
  const KIND_JA = { strategy: '戦型', castle: '囲い', tactic: '戦法' };
  return {
    slots: st.slots, showOpp: st.showOpp, selected: st.selected,
    sides: Kakoi.constraints.effectiveSides(st.slots, st.showOpp),
    chips: [...document.querySelectorAll('#cfield .cf-hit[data-kind]')].map(c => {
      const nm = /「([^」]+)」/.exec(c.getAttribute('aria-label') || '');
      const key = `${c.dataset.who}.${c.dataset.kind}.${c.dataset.id}`;
      const ng = /両立しない/.test(c.title || '');
      return { who: c.dataset.who, kind: c.dataset.kind, id: c.dataset.id,
        implied: c.dataset.implied === 'true', empty: c.dataset.empty === 'true',
        sel: c.dataset.sel === 'true',
        ng, mark: ng ? ngMark(c.dataset.who, c.dataset.kind) : '',
        text: c.title || '',
        name: nm ? nm[1] : '', type: KIND_JA[c.dataset.kind] || '',
        remove: !!document.querySelector(`#cfield .cf-x[data-key="${key}"]`),
        hasDescription: false };   // 胞に説明文の要素は持たない（解説は右 detail）
    }),
    gote: document.querySelectorAll('#board .pc[data-owner="gote"]').length,
    canvas: !!document.querySelector('#board canvas'),
    threats: document.querySelectorAll('#board .ov-threat').length,
    // 相手 OFF は相手の段（.cf-row.cf-opp）が無く「＋相手」の幽霊胞に畳まれる
    oppShown: !!document.querySelector('#cfield .cf-row.cf-opp'),
    oppInvite: !!document.querySelector('#cfield .cf-opp-inv'),
    relationships: [...document.querySelectorAll('#cfield .cf-seam text')].map(el => el.textContent.trim()),
    rect: { x: b.x, y: b.y, w: b.width, h: b.height,
      fb: document.querySelector('#cfield').getBoundingClientRect().bottom },
    // 右 detailは DetailView が .bd-h/.bd-who に「自分（先手）の囲い」のように出す
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
  const b2ImpliedCheck = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#cfield .cf-hit[data-who="me"][data-implied="true"]')];
    return { count: chips.length, items: chips.map(chip => ({
      kind: chip.dataset.kind,
      removable: !!document.querySelector(`#cfield .cf-x[data-key="${chip.dataset.who}.${chip.dataset.kind}.${chip.dataset.id}"]`),
    })) ,
      hatch: [...document.querySelectorAll('#cfield .cf-row.cf-me .cf-cell.imp')]
        .every(cell => (cell.style.fill || '').includes('cf-hatch') && cell.style.strokeDasharray),
      hatchCount: document.querySelectorAll('#cfield .cf-row.cf-me .cf-cell.imp').length,
    };
  });
  r.b2Implied = b2ImpliedCheck.count > 0 && b2ImpliedCheck.hatchCount > 0 && b2ImpliedCheck.hatch
    && b2ImpliedCheck.items.every(item => !item.removable);
  r.b2ImpliedDetail = JSON.stringify(b2ImpliedCheck);
  // 制約フィールドは列の先頭（padding 分だけ下）、盤は残りの行（.boardarea）の上下中央
  r.boardStageOffset = await page.evaluate(() => {
    const st = document.querySelector('.stage');
    const cs = getComputedStyle(st), sr = st.getBoundingClientRect();
    const f = document.querySelector('#cfield').getBoundingClientRect();
    const area = document.querySelector('.boardarea').getBoundingClientRect();
    const bw = document.querySelector('#boardwrap').getBoundingClientRect();
    const top = f.top - sr.top - parseFloat(cs.paddingTop);
    const inner = (bw.top - area.top) - (area.bottom - bw.bottom);   // 盤は残りの行の中央
    return Math.round(Math.max(Math.abs(top), Math.abs(inner)));
  });
  // 制約フィールドは盤の上。相手を表示していれば上の段=相手・下の段=自分
  // （行 <g> の bbox は胞の重なりで交差するので、各側の戦型の胞で段の上下を見る）、
  // OFF の間は「＋相手」の胞が残る
  r.boardOrder = await page.evaluate(() => {
    const field = document.querySelector('#cfield').getBoundingClientRect();
    const board = document.querySelector('#board').getBoundingClientRect();
    const opp = document.querySelector('#cfield .cf-row.cf-opp .cf-str');
    const me = document.querySelector('#cfield .cf-row.cf-me .cf-str');
    if (!me) return false;
    if (!opp) return field.bottom <= board.top + 1
      && !!document.querySelector('#cfield .cf-opp-inv');
    return opp.getBoundingClientRect().bottom <= me.getBoundingClientRect().top + 1
      && field.bottom <= board.top + 1;
  });
  // 帯の中の段間（相手の戦型→自分の戦型。OFF 時は「＋相手」の胞→自分）と、
  // 帯の下端→盤の置き場（.boardarea は帯のすぐ下）の余白
  r.boardBandGaps = await page.evaluate(() => {
    const field = document.querySelector('#cfield').getBoundingClientRect();
    const area = document.querySelector('.boardarea').getBoundingClientRect();
    const opp = document.querySelector('#cfield .cf-row.cf-opp .cf-str')
      || document.querySelector('#cfield .cf-opp-inv .cf-cell');
    const me = document.querySelector('#cfield .cf-row.cf-me .cf-str');
    return [opp && me ? me.getBoundingClientRect().top - opp.getBoundingClientRect().bottom : 0,
      area.top - field.bottom].map(Math.round);
  });
  // 初期状態: 左レールは1枚の面（自分・囲い）。相手タブから相手を表示できる。ハッシュは空。
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
  // 層タブと戦型の絞り込みは1行（戦型が左・タブが右）。並べ方はその下。面に側の見出しは無い
  r.controlOrder = await page.evaluate(() => {
    const strategy = document.querySelector('#pickRail .dk-strategy').getBoundingClientRect();
    const tabs = document.querySelector('#pickRail .dk-tab').getBoundingClientRect();
    const sort = document.querySelector('#pickRail .dk-sort').getBoundingClientRect();
    return strategy.right <= tabs.left && strategy.top >= tabs.top && strategy.bottom <= tabs.bottom + 1
      && tabs.bottom <= sort.top && !document.querySelector('#pickRail .dk-title');
  });
  r.legendRow = await page.evaluate(() => {
    const sort = document.querySelector('#pickRail .dk-sort').getBoundingClientRect();
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
    const mid = (binder.top + binder.bottom) / 2;
    return getComputedStyle(ghost).display !== 'none'
      && Math.abs(opp.bottom - mid) < 1      // 相手の駒の先がドックの中央（河）
      && Math.abs(me.top - mid) < 1          // 自分の駒の先がドックの中央（河）
      && Math.abs(me.top - opp.bottom) < 1
      && Math.round(me.width) === 46;
  });
  r.oppTabEnabled = await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled);
  r.noOldUi = await page.evaluate(() => !document.querySelector('#viewSeg, [data-view], #addOpp, #clearAll, #clearMe, #clearOpp, #skeleton, #heatScopeSeg, .dk-sep, .dk-fold, .dk-addopp, .dk-threat, #cbarOpp, #cbarMe, #bandOpp, #bandMe, #relationshipLabels, .cchip'));
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
  r.bandGhost0 = !r.t0.oppShown && r.t0.oppInvite && r.t0.gote === 0;

  // 囲いを選ぶ → スロットが埋まり、チップが現れ、詳細が囲いになり、ハッシュが書かれ履歴が積まれる
  await page.click(`${DOCK} .dk-card:not([hidden])`); await wait(350);
  r.t1 = await snap(page);
  r.rects.push(r.t1.rect);
  r.added = !!r.t1.slots.me.castle && r.t1.selected.startsWith('me.castle') && r.t1.detailKind.includes('囲い')
    && r.t1.chips.some(c => c.who === 'me' && c.kind === 'castle' && !c.implied
      && c.type === '囲い' && c.name.length > 0 && c.remove && !c.hasDescription);
  r.resetInMeBar = await page.evaluate(() => {
    const field = document.querySelector('#cfield');
    const btn = field.querySelector('.cf-clear[data-who="me"]');
    const cells = [...field.querySelectorAll('.cf-row.cf-me .cf-cell.cf-castle')];
    if (!btn || !cells.length) return { ok: false, text: btn && btn.textContent };
    const br = btn.getBoundingClientRect(), fr = field.getBoundingClientRect();
    // 円い × は自分の段の右端（囲いモジュールの右端寄り・名前の行あたり）に付く
    const cellR = Math.max(...cells.map(c => c.getBoundingClientRect().right));
    const cellL = Math.min(...cells.map(c => c.getBoundingClientRect().left));
    const cellT = Math.min(...cells.map(c => c.getBoundingClientRect().top));
    const cellB = Math.max(...cells.map(c => c.getBoundingClientRect().bottom));
    const v = { text: btn.textContent, label: btn.getAttribute('aria-label'),
      radius: getComputedStyle(btn).borderRadius,
      dEdge: +(br.left - cellR).toFixed(1), dTop: +(br.top - cellT).toFixed(1),
      dRight: +(br.right - fr.right).toFixed(1),
      railClear: !!document.querySelector('#pickRail .dk-clear') };
    v.ok = v.text === '×' && v.label === '自分の戦法・囲いをリセット'
      && v.radius === '50%'
      && br.left > (cellL + cellR) / 2 - 10 && br.left <= fr.right + 12
      && v.dTop > -8 && v.dTop < 40 && br.bottom <= cellB + 30
      && !v.railClear;
    return v;
  });
  r.resetInMeBarDetail = JSON.stringify(r.resetInMeBar);
  r.resetInMeBar = r.resetInMeBar.ok;
  r.pushed = /k=mc:/.test(r.t1.hash) && r.t1.hist === r.t0.hist + 1;

  // 戦法を選ぶ: 戦法タブに切り替えてからタイルを押す → selected=me.tactic・詳細が戦法
  await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`); await wait(250);
  await mark();
  r.tabSwitch = await page.evaluate(() =>
    __kakoi.store.state.selected === 'me.tactic' && document.querySelectorAll('#pickRail .dk-tile').length > 0);
  r.legendInTactic = await page.evaluate(() => getComputedStyle(document.querySelector('#pickRail .dk-legend')).display !== 'none'
    && getComputedStyle(document.querySelector('#pickRail .dk-sort')).display === 'none');
  r.tiles = await page.$$eval(`${DOCK} .dk-tile`, els => els.length);
  r.vars = await page.$$eval(`${DOCK} .dk-var`, els => els.length);
  r.variantStyle = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#pickRail .dk-trow:not([hidden])')];
    const variants = rows.flatMap(row => [...row.querySelectorAll('.dk-var')]);
    const basics = rows.flatMap(row => [...row.querySelectorAll('.dk-tile[data-basic="true"]')]);
    return variants.length > 0 && variants.every(el => !!el.querySelector('.dk-branch'))
      && basics.length > 0 && basics.every(el => !!el.querySelector('.dk-seal'))
      && !!document.querySelector('.dk-vf')   // 派生は親札の下の帯に畳む
      && !document.querySelector('.dk-vshow');
  });
  r.fileMap = await page.evaluate(() => {   // 各札が筋の地図（9目盛り）を持ち、立つ筋が塗られている
    const tiles = [...document.querySelectorAll('#pickRail .dk-tile:not([hidden])')];
    return tiles.length > 0 && tiles.every(t =>
      t.querySelectorAll('.dk-map i').length === 9 && t.querySelectorAll('.dk-map i.on').length >= 1);
  });
  await page.click(`${DOCK} .dk-tile:not([hidden])`); await wait(350);
  r.t2 = await snap(page);
  r.rects.push(r.t2.rect);
  r.tacticSel = !!(r.t2.slots.me.tactic && r.t2.slots.me.tactic.length)
    && r.t2.selected.startsWith('me.tactic') && r.t2.detailKind.includes('戦法');
  r.horizontalChips = await page.evaluate(() => {
    const meRow = document.querySelector('#cfield .cf-row.cf-me');
    if (!meRow) return false;
    const str = meRow.querySelector('.cf-str');
    const castle = meRow.querySelectorAll('.cf-cell.cf-castle');
    const tac = meRow.querySelectorAll('.cf-cell.cf-tac');
    const ghosts = meRow.querySelectorAll('.cf-cell.cf-ghost');
    // 戦型の胞（根元）は左端の列で、囲い・戦法の胞は全部その右に並ぶ
    const modLeft = Math.min(...[...meRow.querySelectorAll('.cf-cell:not(.cf-str)')]
      .map(c => c.getBoundingClientRect().left));
    return !!str && meRow.querySelectorAll('.cf-str-t').length >= 3
      && /st-/.test(str.getAttribute('class') || '')
      && castle.length >= 3 && meRow.querySelector('.cf-stem')
      && tac.length >= 2 && meRow.querySelector('.cf-tname')
      && [...meRow.querySelectorAll('.cf-tname')].some(t => t.textContent.length > 0)
      && !!meRow.querySelector('.cf-cname') && meRow.querySelector('.cf-cname').textContent.length > 0
      && meRow.querySelector('.cf-j') && ghosts.length >= 2   // 空きの駒枠も残す
      && str.getBoundingClientRect().right <= modLeft + 2;
  });
  // 戦型の胞（左端）: スロットではないが、押すと右 detailにその戦型の情報が出る。
  // 選択だけなので履歴は積まず、sel=ms がハッシュに乗る
  // （胞のクリックは evaluate の .click() で: 狭い画面では右上の × の拡張当たり判定が
  //   胞ボタンの中央を覆い、実ポインタが届かないことがある）
  await page.evaluate(() => document.querySelector('#cfield .cf-hit[data-who="me"][data-kind="strategy"]').click());
  await wait(300);
  r.strategySel = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const d = document.querySelector('#detail');
    const chip = document.querySelector('#cfield .cf-hit[data-who="me"][data-kind="strategy"]');
    const nm = [...document.querySelectorAll('#cfield .cf-row.cf-me .cf-str-t')]
      .map(t => t.textContent).join('');
    return st.selected.startsWith('me.strategy')
      && chip.dataset.sel === 'true' && chip.tagName === 'BUTTON'
      && (d.querySelector('.bd-who') || {}).textContent.includes('▲自分の戦型')
      && (d.querySelector('.bd-t') || {}).textContent.includes(nm)
      && /スロットを持たず/.test(d.textContent)
      && d.querySelectorAll('.vchip[data-act="set"]').length > 0
      && /sel=ms/.test(location.hash);
  });
  // 別のタイルを押す → 自分の戦法が変わる（囲いは自動では変わらない）
  const tA = (r.t2.slots.me.tactic || []).join(','), cA = r.t2.slots.me.castle;
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#pickRail .dk-tile:not([hidden])')]
      .find(el => el.getAttribute('aria-pressed') !== 'true');
    if (t) t.click();
  });
  await wait(350);
  r.t3 = await snap(page);
  r.rects.push(r.t3.rect);
  r.railPick = !!(r.t3.slots.me.tactic && r.t3.slots.me.tactic.length)
    && r.t3.slots.me.tactic.join(',') !== tA && r.t3.slots.me.castle === cA;
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
      && Kakoi.constraints.effectiveSides(now.slots, now.showOpp).me.strategy === strat;
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
  await page.selectOption(`${DOCK} .dk-sort-sel`, 'tree'); await wait(250);
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
  await page.selectOption(`${DOCK} .dk-sort-sel`, 'hard'); await wait(250);
  r.sortAxis = await page.evaluate(() => [...document.querySelectorAll('#pickRail .dk-fam')]
    .every(s => [...s.querySelectorAll('.dk-card')].every(c =>
      `hard${Kakoi.CASTLES.find(x => x.id === c.dataset.id).ratings.hard}` === s.dataset.family)));
  await page.selectOption(`${DOCK} .dk-sort-sel`, 'family'); await wait(250);
  // A「系統の色と印」: 系統ブロックは系統色の帯（4px）を持ち、並べ方は開かずに全部見える選択肢
  r.famColors = await page.evaluate(() => {
    const fams = [...document.querySelectorAll('#pickRail .dk-fam:not([hidden])')];
    const sorts = [...document.querySelectorAll('#pickRail .dk-sort-sel option')];
    const sortIds = sorts.map(o => o.value);
    const tabs = document.querySelector('#pickRail .dk-tab').getBoundingClientRect();
    const sortBar = document.querySelector('#pickRail .dk-sort').getBoundingClientRect();
    const cards = document.querySelector('#pickRail .dk-cards');
    const thumb = document.querySelector('#pickRail .dk-card:not([hidden]) .thumb').getBoundingClientRect();
    // サムネぴったりの札は3列まで: 各行頭の枚数の最大が3
    const rowMax = Math.max(...fams.map(s => {
      const cs = [...s.querySelectorAll('.dk-card:not([hidden])')];
      if (!cs.length) return 0;
      const y = cs[0].offsetTop;
      return cs.filter(c => Math.abs(c.offsetTop - y) < 1).length;
    }));
    return fams.length > 0 && fams.every(s => s.style.getPropertyValue('--fam').startsWith('var(--f-')
        && getComputedStyle(s).borderLeftWidth === '4px')
      && sorts.length === Kakoi.railGrids.CASTLE_SORTS.length && sorts.every(o => o.textContent.trim().length > 0)
      && !sortIds.includes('wide') && !sortIds.includes('quick')
      && tabs.bottom <= sortBar.top
      && getComputedStyle(cards).display === 'flex' && getComputedStyle(cards).flexWrap === 'wrap'
      && rowMax === 3
      && Math.round(thumb.height) === 65
      && Math.abs(thumb.width - 94) < 1.5
      && !!document.querySelector('#pickRail .dk-sort select');
  });
  r.basicStyle = await page.evaluate(() => {
    const basics = [...document.querySelectorAll('#pickRail .dk-item[data-basic="true"]')];
    return basics.length > 0 && basics.every(el => !!el.querySelector('.dk-seal'))
      && !document.querySelector('.dk-basic');
  });

  // 両立しない選択: いまの戦法と合わない囲い（✕の破線枠）を選んでも他の層は差し替わらず、
  // チップに ✕ と理由、右 detailに理由と直す候補が出る。候補を押すと両立する選択に直る
  const badBadge = await page.evaluate(() => [...document.querySelectorAll('#pickRail .dk-card')]
    .filter(c => c.dataset.ng === 'true').length);
  r.ngBadges = badBadge;
  const tBefore = ((await snap(page)).slots.me.tactic || []).join(',');
  await page.evaluate(() => document.querySelector('#pickRail .dk-card[data-ng="true"]').click());
  await wait(400);
  r.t4 = await snap(page);
  r.rects.push(r.t4.rect);
  r.ngKept = (r.t4.slots.me.tactic || []).join(',') === tBefore && !!r.t4.slots.me.castle;   // 自動で差し替えない
  r.ngChip = r.t4.chips.some(c => c.who === 'me' && c.kind === 'castle' && c.ng && c.mark === '✕')
    && await page.evaluate(() => /両立しない/.test(document.querySelector('#cfield .cf-hit[data-who="me"][data-kind="castle"]').title));
  r.ngDetail = await page.evaluate(() => {
    const d = document.querySelector('#detail');
    return /両立しません/.test(d.textContent) && d.querySelectorAll('.vchip[data-act="set"]').length > 0;
  });
  r.noToast = await page.evaluate(() => !document.querySelector('.toast.on'));   // 連動トーストは無い
  const ngId = r.t4.slots.me.castle;
  await page.locator('#detail .vchip[data-act="set"]').first().click(); await wait(400);
  r.t4b = await snap(page);
  r.rects.push(r.t4b.rect);
  r.ngFixed = !!r.t4b.slots.me.castle && r.t4b.slots.me.castle !== ngId
    && (r.t4b.slots.me.tactic || []).join(',') === tBefore
    && !r.t4b.chips.some(c => c.ng);
  await mark();

  // 相手の駒の見出しを押して、相手の表示 ON と相手側への選択を同時に行う
  r.oppOffInit = await page.evaluate(() => !__kakoi.store.state.showOpp
    && document.querySelector('#pickRail .dk-binder').dataset.show === 'false');
  await page.click(`${DOCK} .dk-pc[data-who="opp"]`); await wait(450);
  // 相手の段が広がる（「＋相手」の胞は退き、相手の胞の列が出る。viewBox は全高に戻る。
  // 「＋相手」のボタンは button.cf-hit.cf-opp —— .cf-opp だけだと行の <g class="cf-row cf-opp"> にも合う）
  r.oppFoldOn = await page.evaluate(() => {
    const y0 = +document.querySelector('#cfield svg').getAttribute('viewBox').split(' ')[1];
    return !!document.querySelector('#cfield .cf-row.cf-opp')
      && !document.querySelector('#cfield button.cf-opp')
      && y0 <= 1;
  });
  r.t5 = await snap(page);
  r.rects.push(r.t5.rect);
  r.boardOrderOppOn = await page.evaluate(() => {
    const field = document.querySelector('#cfield').getBoundingClientRect();
    const board = document.querySelector('#board').getBoundingClientRect();
    const opp = document.querySelector('#cfield .cf-row.cf-opp .cf-str');
    const me = document.querySelector('#cfield .cf-row.cf-me .cf-str');
    const seams = [...document.querySelectorAll('#cfield .cf-seam')]
      .map(g => g.getBoundingClientRect());
    if (!opp || !me) return false;
    const o = opp.getBoundingClientRect(), m = me.getBoundingClientRect();
    const oc = (o.top + o.bottom) / 2, mc = (m.top + m.bottom) / 2;
    // 関係ラベルのピルは河（両側の戦型の胞の間）に浮く
    return o.bottom <= m.top + 1 && field.bottom <= board.top + 1 && seams.length > 0
      && seams.every(r2 => (r2.top + r2.bottom) / 2 > oc && (r2.top + r2.bottom) / 2 < mc);
  });
  const b2ModuleCheck = await page.evaluate(() => {
    const rows = ['#cfield .cf-row.cf-opp', '#cfield .cf-row.cf-me'];
    const hasKinds = rows.every(row => {
      const g = document.querySelector(row);
      return !!g && g.querySelector('.cf-str') && g.querySelector('.cf-cell.cf-castle')
        && g.querySelector('.cf-cell.cf-tac');
    });
    const meRow = document.querySelector('#cfield .cf-row.cf-me');
    const st = Kakoi.constraints.effectiveSides(__kakoi.store.state.slots, __kakoi.store.state.showOpp).me;
    const castleName = Kakoi.catalog.findCastle(st.castleId);
    const glyphs = meRow ? [...meRow.querySelectorAll('.cf-mod.cf-castle .cf-t')].map(x => x.textContent).join('') : '';
    const expected = castleName ? Kakoi.notation.parsePieces(castleName.core).map(x => x.p).join('') : '';
    const implied = [...document.querySelectorAll('#cfield .cf-cell')]
      .some(cell => (cell.style.fill || '').includes('cf-hatch'));
    const labels = [...document.querySelectorAll('#cfield .cf-hit')]
      .every(button => button.getAttribute('aria-label') && button.title);
    return { hasKinds, castleName: !!castleName, glyphs, expected, implied, labels };
  });
  r.b2Modules = b2ModuleCheck.hasKinds && b2ModuleCheck.castleName
    && [...b2ModuleCheck.expected].every(ch => b2ModuleCheck.glyphs.includes(ch)) && b2ModuleCheck.labels;
  r.b2ModulesDetail = JSON.stringify(b2ModuleCheck);
  r.b2Marks = await page.evaluate(() => {
    // 期待される印の数を compat と同じ規則で出し、描いた .cf-sm がそれを覆うか見る
    // （1モジュールに複数本の辺・短い目地が出るので drawn >= want）
    const st = __kakoi.store.state;
    const S = Kakoi.constraints.effectiveSides(st.slots, st.showOpp);
    let want = 0;
    for (const who of ['me', 'opp']) {
      const other = who === 'me' ? (st.showOpp ? S.opp : null) : S.me;
      for (const id of S[who].tacticIds) {
        const lv = (Kakoi.compat.judge(S[who], 'tactic', id, other).vs || {}).level;
        if (lv === 'good' || lv === 'bad') want++;
      }
      if (S[who].castleId != null) {
        const lv = (Kakoi.compat.judge(S[who], 'castle', S[who].castleId, other).vs || {}).level;
        if (lv === 'good' || lv === 'bad') want++;
      }
    }
    const marks = [...document.querySelectorAll('#cfield .cf-sm')];
    return { want, n: marks.length,
      cls: marks.every(el => el.classList.contains('cf-sm-good') || el.classList.contains('cf-sm-bad')) };
  });
  r.oppOn = r.t5.showOpp && (r.t5.canvas || r.t5.gote > 0) && r.t5.oppShown && !r.t5.oppInvite
    && await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled)
    && r.t5.selected.startsWith('opp.') && /opp=1/.test(r.t5.hash);
  r.threatOn = r.t5.threats >= 1;
  r.labels = r.t5.relationships.length > 0
    && await page.evaluate(() => document.querySelectorAll('#cfield .cf-seam text').length > 0);
  // 相手タブは相手の面（筋が反転）を選択した状態になっている
  r.oppTab = await page.evaluate(() => __kakoi.store.state.selected.startsWith('opp.')
    && document.querySelector('#pickRail .dk').dataset.who === 'opp');
  await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`); await wait(250);
  r.flipCol = await page.evaluate(() => {   // 相手の面は筋が反転: 四間飛車（先手6筋）は盤の4筋=地図の左から6番目
    const t = document.querySelector('#pickRail .dk-tile[data-id="shikenbisha"]');
    return t ? String([...t.querySelectorAll('.dk-map i')].findIndex(i => i.classList.contains('on')) + 1) : null;
  });
  await page.click(`${DOCK} .dk-tile:not([hidden])`); await wait(400);
  r.t5b = await snap(page);
  r.rects.push(r.t5b.rect);
  r.oppSel = !!(r.t5b.slots.opp.tactic && r.t5b.slots.opp.tactic.length)
    && r.t5b.selected.startsWith('opp.tactic');
  r.resetInOppBar = await page.evaluate(() => {
    const btn = document.querySelector('#cfield .cf-clear[data-who="opp"]');
    return btn && btn.textContent === '×' && btn.getAttribute('aria-label') === '相手の戦法・囲いをリセット';
  });
  r.oppRotated = await page.evaluate(() => {
    // 同じ六角グリッドに並ぶが、相手の胞は駒の漢字が相手向き（180°回転）で区別できる
    const o = document.querySelector('#cfield .cf-row.cf-opp .cf-t');
    const m = document.querySelector('#cfield .cf-row.cf-me .cf-t');
    return !!o && !!m && /rotate\(180/.test(o.getAttribute('transform') || '')
      && !/rotate/.test(m.getAttribute('transform') || '');
  });
  // 相手側の戦型の胞も押せる: 右 detailに相手の戦型の情報が出る（sel=os がハッシュに乗る）
  await page.evaluate(() => document.querySelector('#cfield .cf-hit[data-who="opp"][data-kind="strategy"]').click());
  await wait(300);
  r.oppStrategySel = await page.evaluate(() => {
    const st = __kakoi.store.state;
    const d = document.querySelector('#detail');
    const chip = document.querySelector('#cfield .cf-hit[data-who="opp"][data-kind="strategy"]');
    const nm = [...document.querySelectorAll('#cfield .cf-row.cf-opp .cf-str-t')]
      .map(t => t.textContent).join('');
    return st.selected.startsWith('opp.strategy')
      && chip.dataset.sel === 'true'
      && (d.querySelector('.bd-who') || {}).textContent.includes('△相手の戦型')
      && (d.querySelector('.bd-t') || {}).textContent.includes(nm)
      && /合わせた戦型/.test(d.textContent)   // 相手がいるときは組み合わせの戦型も出る
      && /sel=os/.test(location.hash);
  });
  // 河のピル（関係ラベル）を押すと右 detailにその戦型の情報が出る（§3-4。大分類＋葉の2枚まで）
  r.senkeiPills = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('#cfield .cf-hit[data-kind="senkei"]')];
    return { n: hits.length,
      aria: hits.every(h => /戦型のラベル「#/.test(h.getAttribute('aria-label') || '')) };
  });
  {
    const pill = await page.$('#cfield .cf-hit[data-kind="senkei"]');
    if (pill) {
      await pill.click(); await wait(300);
      r.senkeiPillSel = await page.evaluate(() => {
        const st = __kakoi.store.state;
        const d = document.querySelector('#detail');
        return st.selected.startsWith('me.senkei.')
          && !!(d.querySelector('.bd-who') || {}).textContent
          && !!(d.querySelector('.bd-t') || {}).textContent
          && /sel=mk\./.test(location.hash);
      });
    }
  }
  await page.click(`${DOCK} .dk-pc-x`); await wait(350);
  // 相手の段が畳まれる（胞の列は消え「＋相手」の幽霊胞に戻る）
  r.oppFoldOff = await page.evaluate(() =>
    !document.querySelector('#cfield .cf-row.cf-opp')
      && !!document.querySelector('#cfield .cf-opp-inv')
      && !!document.querySelector('#cfield button.cf-opp'));
  r.oppRailOff = await page.evaluate(() => {
    const st = __kakoi.store.state;
    return !st.showOpp && !st.selected.startsWith('opp.')
      && document.querySelector('#pickRail .dk-binder').dataset.show === 'false'
      && document.querySelector('.dk-pc-x').hidden;
  });
  await page.click(`${DOCK} .dk-pc[data-who="opp"]`); await wait(350);
  r.oppRailOn = await page.evaluate(() => __kakoi.store.state.showOpp
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

  // × でスロットを外す（相手の胞についた ×）。外すと既定の胞に変わる
  const xCount = await page.$$eval('#cfield .cf-x[data-who="opp"]', els => els.length);
  if (xCount) {
    const n0 = await page.evaluate(() => {
      const s = __kakoi.store.state.slots.opp;
      return (s.tactic || []).length + (s.castle ? 1 : 0);
    });
    await page.locator('#cfield .cf-x[data-who="opp"]').last().click(); await wait(300);
    r.removed = await page.evaluate(n => {
      const s = __kakoi.store.state.slots.opp;
      return (s.tactic || []).length + (s.castle ? 1 : 0) === n - 1;
    }, n0);
    await mark();
  }

  // 相手の表示を OFF → 後手の駒・脅威の帯が退き、相手タブは有効のまま、選択は自分側へ戻る
  const oppSlots = JSON.stringify((await snap(page)).slots.opp);
  await page.click(`${DOCK} .dk-pc-x`); await wait(400);
  r.t8 = await snap(page);
  r.rects.push(r.t8.rect);
  r.oppOff = !r.t8.showOpp && r.t8.threats === 0 && (r.t8.canvas || r.t8.gote === 0)
    && !r.t8.oppShown && r.t8.oppInvite && r.t8.selected.startsWith('me.')
    && await page.$eval(`${DOCK} .dk-pc[data-who="opp"]`, el => !el.disabled)
    && JSON.stringify(r.t8.slots.opp) === oppSlots;

  // 制約フィールドの「リセット」: 見ている側の戦法・囲いを両方外し、トーストの「元に戻す」で戻る
  const preClear = JSON.stringify((await snap(page)).slots);
  await page.click('#cfield .cf-clear[data-who="me"]'); await wait(400);
  r.t9 = await snap(page);
  r.cleared = !(r.t9.slots.me.tactic || []).length && !r.t9.slots.me.castle
    && JSON.stringify(r.t9.slots.opp) === oppSlots
    && !!(await page.$('.toast.on .toast-act'));
  await page.click('.toast .toast-act'); await wait(400);
  r.undoClear = await page.evaluate(p => JSON.stringify(__kakoi.store.state.slots) === p, preClear);

  // 矢印キー: 戦法を選択しているとき ←→ で戦法が送れる（フィールドの胞で selected を戦法にする）
  await page.evaluate(() => document.querySelector('#cfield .cf-hit[data-who="me"][data-kind="tactic"][data-empty="false"]').click());
  await wait(300);
  await mark();
  const tId0 = await page.evaluate(() => (__kakoi.store.state.slots.me.tactic || []).join(','));
  await page.focus('#board');
  await page.keyboard.press('ArrowRight'); await wait(250);
  const tId1 = await page.evaluate(() => (__kakoi.store.state.slots.me.tactic || []).join(','));
  r.keyNav = tId0 !== tId1;
  // U3: 矢印キーでフォーカスが失われない。盤（中央）では矢印は選択を動かし、フォーカスは盤に残る
  r.focusBoard = await page.evaluate(() => document.activeElement && document.activeElement.id === 'board');
  await mark();
  //   胞では矢印は roving がフォーカスだけを動かす（選択は変えず、body にも逃がさない）
  const chip = await page.$('#cfield .cf-hit[data-who="me"]:not([data-kind="strategy"])');
  if (chip) {
    await chip.focus();
    await page.keyboard.press('ArrowRight'); await wait(200);
    r.focusChip = await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('cf-hit'));
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
    for (const kind of ['castle', 'tactic', 'strategy']) {
      await page.evaluate(k => document.querySelector(`#cfield .cf-hit[data-who="me"][data-kind="${k}"]`).click(), kind);
      await wait(250);
    }
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
      return (st.slots.opp.tactic || []).includes('shikenbisha') && st.slots.me.castle === 'yagura' && st.showOpp
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
  // F1: 盤は中央の列の中央から揺れない（±0.5px）。制約フィールドは相手の表示や深い
  // 囲いで高さが伸び縮みし、盤は残りの行（.boardarea）に収まる大きさで上下中央に来るので、
  // 横は中心が不変、縦は帯の下端に対する中心（2y+h-fb）が不変（それ以外の揺れは検出する）
  const baseR = r.rects[0];
  r.rectDrift = r.rects.map(x =>
    x.w > 0 && x.h > 0
    && Math.abs((x.x + x.w / 2) - (baseR.x + baseR.w / 2)) <= .5
    && Math.abs((2 * x.y + x.h - x.fb) - (2 * baseR.y + baseR.h - baseR.fb)) <= .5).indexOf(false);   // -1 なら全一致
  r.rectDriftDetail = r.rectDrift >= 0
    ? JSON.stringify({ got: r.rects[r.rectDrift], base: baseR }) : '';
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
    // 横にはみ出す要素。制約フィールドの縁に半分乗る ×/リセット
    // （当たり判定を広げる ::after 込み）は設計どおりの張り出しとして分ける
    const overEls = [...document.querySelectorAll('body *')].map(el => {
      const b2 = el.getBoundingClientRect();
      if (!b2.width || (b2.right <= innerWidth + 1 && b2.left >= -1)) return null;
      const cn = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;
      return { inField: !!el.closest('#cfield'), tag: `${el.tagName.toLowerCase()}.${cn}` };
    }).filter(Boolean);
    return { sw: d.scrollWidth, sh: d.scrollHeight, iw: innerWidth, ih: innerHeight,
             overflowX: d.scrollWidth > innerWidth + 1, overflowY: d.scrollHeight > innerHeight + 1,
             panes, overEls };
  });
  // はみ出しが制約フィールドの縁のボタンだけなら警告に留める（それ以外は失敗）
  const nonFieldOver = r.overEls.filter(o => !o.inField);
  ok(!r.overflowX || (r.overEls.length > 0 && nonFieldOver.length === 0),
    `w=${width} 横スクロールなし`, `scrollWidth=${r.sw} > ${r.iw} ${JSON.stringify(nonFieldOver.slice(0, 5))}`);
  if (r.overflowX && nonFieldOver.length === 0)
    warn(`w=${width} 制約フィールドの縁のボタンが画面から張り出す: ${r.overEls.slice(0, 4).map(o => o.tag).join(', ')}`);
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

async function checkTesujiMode(browser, url, errs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, errs);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.click('#tesujiOpen');
  await wait(150);
  const entered = await page.evaluate(() => document.body.classList.contains('tj')
    && getComputedStyle(document.querySelector('.app')).display === 'none'
    && getComputedStyle(document.querySelector('.wiki')).display === 'grid'
    && new URLSearchParams(location.hash.slice(1)).has('tj'));
  const hierarchy = await page.evaluate(() => document.querySelectorAll('.wj-tree > li').length >= 7
    && document.querySelectorAll('.wj-tree ol ol li').length > 0
    && document.querySelectorAll('.wj-doc > .wj-ch > h2').length >= 7
    && !!document.querySelector('.wj-ch[data-id="sources"]'));
  await page.click('#tesujiToc a[data-go="otebisha"]');
  await wait(200);
  const toc = await page.evaluate(() => {
    const q = new URLSearchParams(location.hash.slice(1));
    const current = document.querySelector('#tesujiToc a[aria-current="true"]');
    const main = document.querySelector('.wj-main');
    const item = document.querySelector('.wj-sec[data-id="otebisha"]');
    return q.get('tj') === 'otebisha' && !!item
      && Math.abs(item.getBoundingClientRect().top - main.getBoundingClientRect().top) < 100
      && !!current && current.dataset.go === 'otebisha';
  });
  await page.evaluate(() => document.querySelector('.wj-sec[data-id="yureikaku"]')
    .scrollIntoView({ block: 'start' }));
  await wait(200);
  const scrollSpy = await page.evaluate(() => {
    const current = document.querySelector('#tesujiToc a[aria-current="true"]');
    return !!current && current.dataset.go === 'yureikaku'
      && new URLSearchParams(location.hash.slice(1)).get('tj') === 'otebisha';
  });
  await page.goBack();
  await wait(150);
  const chapterBack = await page.evaluate(() => document.body.classList.contains('tj')
    && new URLSearchParams(location.hash.slice(1)).get('tj') === '');
  await page.goBack();
  await wait(150);
  const boardBack = await page.evaluate(() => !document.body.classList.contains('tj'));

  // Board detail link must open the linked tesuji section and preserve the board hash.
  await page.goto(`${url}#k=mc:mino&sel=mc`, { waitUntil: 'networkidle' });
  await page.click('#detail [data-act="tesuji"][data-id="mino-kyusho39"]');
  await wait(200);
  const detailLink = await page.evaluate(() => document.body.classList.contains('tj')
    && new URLSearchParams(location.hash.slice(1)).get('tj') === 'mino-kyusho39'
    && new URLSearchParams(location.hash.slice(1)).get('k') === 'mc:mino'
    && !!document.querySelector('.wj-sec[data-id="mino-kyusho39"]'));
  await page.goBack();
  await wait(150);
  const detailBack = await page.evaluate(() => !document.body.classList.contains('tj'));

  await page.goto(`${url}#tj=not-a-tesuji`, { waitUntil: 'networkidle' });
  await wait(150);
  const invalidDeepLink = await page.evaluate(() => document.body.classList.contains('tj')
    && document.querySelector('.wj-main').scrollTop === 0
    && Math.abs(document.querySelector('.wj-doc-h').getBoundingClientRect().top
      - document.querySelector('.wj-main').getBoundingClientRect().top) < 80);

  // Direct deep links and the narrow TOC drawer/return path.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}#tj=yureikaku`, { waitUntil: 'networkidle' });
  await wait(200);
  const deepLink = await page.evaluate(() => document.body.classList.contains('tj')
    && new URLSearchParams(location.hash.slice(1)).get('tj') === 'yureikaku'
    && document.querySelector('.wj-main').scrollHeight > innerHeight
    && !!document.querySelector('.wj-sec[data-id="yureikaku"]'));
  await page.keyboard.press('Escape');
  await wait(150);
  const escapeExit = await page.evaluate(() => !document.body.classList.contains('tj')
    && !new URLSearchParams(location.hash.slice(1)).has('tj'));
  await page.goBack();
  await wait(150);
  const reopenClosed = await page.evaluate(() => document.body.classList.contains('tj')
    && document.querySelector('.wiki').dataset.toc !== 'open');
  await page.click('.wj-toc-btn');
  const drawerOpen = await page.evaluate(() => document.querySelector('.wiki').dataset.toc === 'open'
    && document.querySelector('.wj-toc-btn').getAttribute('aria-expanded') === 'true');
  await page.click('.wj-toc-btn');
  const drawerToggle = await page.evaluate(() => document.querySelector('.wiki').dataset.toc !== 'open'
    && document.querySelector('.wj-toc-btn').getAttribute('aria-expanded') === 'false');
  await page.click('.wj-toc-btn');
  await page.click('#tesujiToc a[data-go="atamakin"]');
  await wait(200);
  const mobileToc = await page.evaluate(() => {
    const q = new URLSearchParams(location.hash.slice(1));
    const current = document.querySelector('#tesujiToc a[aria-current="true"]');
    return q.get('tj') === 'atamakin' && document.querySelector('.wiki').dataset.toc !== 'open'
      && !!current && current.dataset.go === 'atamakin';
  });
  await page.click('.wj-toc-btn');
  await page.click('.wj-back button');
  await wait(150);
  const mobileBack = await page.evaluate(() => !document.body.classList.contains('tj')
    && document.querySelector('.wiki').dataset.toc !== 'open' && window.scrollY <= 1);
  await page.evaluate(() => window.scrollTo(0, 500));
  await wait(100);
  const boardWasScrolled = await page.evaluate(() => window.scrollY > 0);
  await page.click('#tesujiOpen');
  await wait(150);
  const mobileTopOpen = boardWasScrolled && await page.evaluate(() => document.body.classList.contains('tj')
    && window.scrollY <= 1);
  await page.close();
  return { entered, hierarchy, toc, scrollSpy, chapterBack, boardBack, detailLink, detailBack, invalidDeepLink, deepLink,
    escapeExit, reopenClosed, drawerOpen, drawerToggle, mobileToc, mobileBack, mobileTopOpen };
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
      const wiki = await checkTesujiMode(browser, baseDebug, errs);
      ok(wiki.entered, '手筋と格言は盤面と排他の全画面モードで開く');
      ok(wiki.hierarchy, '目次・本文は章／項の階層と出典で構成する');
      ok(wiki.toc, 'wiki 目次から手筋へ移動し、章・節位置と現在地を更新する');
      ok(wiki.scrollSpy, '本文をスクロールすると目次の現在地が追従する');
      ok(wiki.chapterBack && wiki.boardBack, 'ブラウザの戻るで wiki の節と盤面へ順に戻る');
      ok(wiki.detailLink && wiki.detailBack, '囲いの詳細から関連手筋へ移動し、盤へ戻れる');
      ok(wiki.invalidDeepLink, '不正な手筋 URL は落ちずに冒頭を表示する');
      ok(wiki.deepLink, 'tj= の深いリンクをモバイルでも開く');
      ok(wiki.escapeExit && wiki.reopenClosed, 'Escape で盤へ戻り、再入場時に目次ドロワーを閉じる');
      ok(wiki.drawerOpen && wiki.drawerToggle && wiki.mobileToc,
        'モバイル目次ドロワーを開閉し、項目選択で閉じて現在地を追う');
      ok(wiki.mobileBack, 'モバイル目次から盤面へ戻れる');
      ok(wiki.mobileTopOpen, 'モバイルで盤面の途中から開いても読み始めは先頭に戻る');
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
      ok(b.panes === 1 && b.oppTabEnabled, '左レールは1枚の面（自分/相手タブ）。相手タブは OFF 時も有効', `panes=${b.panes} 相手タブ有効=${b.oppTabEnabled}`);
      ok(b.binderStyle, 'バインダーの2枚の駒は中央（河）で向き合い、相手 OFF 時は点線の駒影を残す', '');
      ok(b.layerTabs.join(',') === '囲い,戦法', '左レールのタブ順は囲い→戦法', b.layerTabs.join(' → '));
      ok(b.layerBinder, '囲い／戦法はバインダー形状で、選択中のタブが前面に見える', '');
      ok(b.layerSwitchStable, '囲い／戦法を切り替えてもタブ列が上下に揺れない', '');
      ok(b.legendRow && b.legendAnchor && b.legendInTactic, '記号の見方はソート横にあり、戦法表示でも利用できる',
        `row=${b.legendRow} anchor=${b.legendAnchor} tactic=${b.legendInTactic}`);
      ok(b.strategyOrder.join(',') === 'furibisha,ibisha', '左レールの戦型トグルは振り飛車→居飛車', b.strategyOrder.join(' → '));
      ok(b.controlOrder, '囲い／戦法と戦型の絞り込みは1行、その下に並べ方（面に側の見出しは無い）', '');
      ok(b.sortTree, '囲いの並べ方「発展ツリー」: 発展形は from を持ち字下げした行で出る', '');
      ok(b.sortAxis, '囲いの並べ方「堅さ順」: 各段のブロックに同じ堅さの囲いだけが入る', '');
      ok(b.famColors, 'A案: 系統色の帯と3列タイル、並べ方は文字のドロップダウン', '');
      ok(b.basicStyle, '基本の囲いは朱の印で識別され、絞り込みトグルは無い', '');
      ok(b.noOldUi, '廃止した UI（画面切替・相手を加える・全部はずす・骨格線・利きの範囲・スプリッタ・面の折りたたみ・ドックの脅威スイッチ）が無い', '');
      ok(b.noClusterCss, '分類マップの CSS を読み込まない', '');
      ok(b.hashEmpty0, '初期状態のハッシュは空', '');
      ok(b.bandGhost0, '相手の表示 OFF の間は「＋相手」の胞だけ残り、後手の駒は出ない', '');
      ok(b.boardStageOffset <= 8, '制約フィールドは列の先頭、盤は残りの行の上下中央に配置される', `${b.boardStageOffset}px`);
      ok(b.boardOrder && b.boardOrderOppOn, '制約フィールド（相手の段・関係ラベルつき）は盤の上', '');
      ok(b.b2Modules, 'B2: 戦型・囲い（駒名セル）・戦法の六角モジュールが表示される', b.b2ModulesDetail);
      ok(b.b2Implied, 'B2: 既定値は網掛けで薄く、解除できない', b.b2ImpliedDetail);
      ok(b.b2Marks.n > 0 && b.b2Marks.n >= b.b2Marks.want && b.b2Marks.want > 0 && b.b2Marks.cls,
        'B2: 相手との相性を盤側の辺に色・線種で示す', JSON.stringify(b.b2Marks));
      ok(b.boardBandGaps.every(gap => gap <= 125), '盤面と制約フィールドの余白を抑える', `${b.boardBandGaps.join('px / ')}px`);
      ok(b.oppRotated, '相手の胞は駒の漢字が相手向き（同じ六角グリッドで区別できる）', '');
      ok(b.rectDrift === -1, '盤の大きさ・横位置は不変、縦はフィールドの畳みに追従（F1 ±0.5px）',
        `ずれたステップ=${b.rectDrift} ${b.rectDriftDetail}`);
      ok(b.cards === expect.castles, '囲いタイル', `${b.cards}枚`);
      ok(b.fams === expect.famsUsed, '囲いのクラスタ見出し（系統ごと）', `${b.fams}系統`);
      ok(b.tiles === expect.tacticTiles && b.vars === expect.tacticVars,
        '戦法タイル（1マス1タイル＋派生はチップ）', `tiles=${b.tiles} vars=${b.vars}`);
      ok(b.segs === 2, '戦略の絞り込みは居飛車/振り飛車の2択（面は1つ）', `${b.segs}個`);
      ok(b.flipCol === '6', '相手の面は筋が反転（四間飛車=盤の4筋の列）', `列=${b.flipCol}`);
      ok(b.collapse, '系統ブロックを折りたためる', '');
      ok(b.tabSwitch, '面のタブ切替（囲い→戦法）で選択も戦法になる', '');
      ok(b.added, '囲いを選ぶ→スロットとチップが増え、詳細が囲いになる', JSON.stringify(b.t1 && b.t1.slots));
      ok(b.horizontalChips, 'B2の根・囲いポリへックス・戦法ドミノは順に並び、胞の茎と目地を描く', '');
      ok(b.resetInMeBar, '丸いリセット×を自分の制約行の右端（囲いの胞の脇）に表示', b.resetInMeBarDetail);
      ok(b.pushed, 'スロットの変更でハッシュが書かれ履歴が積まれる（pushState）', `${b.t1 && b.t1.hash} hist=${b.t1 && b.t1.hist}`);
      ok(b.tacticSel, '戦法を選ぶ→選択と詳細が戦法になる', `sel=${b.t2 && b.t2.selected}`);
      ok(b.strategySel, '戦型チップを押すと右 detailに戦型の情報（導出元・既定・この戦型の囲い）が出る', '');
      ok(b.oppStrategySel, '相手側の戦型チップも右 detailに出る（相手の面・組み合わせの戦型つき）', '');
      ok(b.railPick, 'レールの筋タイルで戦法が変わり、囲いは自動では変わらない', `sel=${b.t3 && b.t3.selected}`);
      ok(b.variantStyle, '派生戦法は親札の下の「派生 n」の帯に畳む（↳チップ）', `${b.vars}件`);
      ok(b.fileMap, '戦法の札に筋の地図（9目盛りで立つ筋を塗る）', '');
      ok(b.segFilter && b.famFilter, '戦略セグは一覧の絞り込みだけ（スロット・導出した戦略は不変）', `rows=${b.segFilter} fams=${b.famFilter}`);
      ok(b.ngBadges > 0, 'いまの組み合わせと両立しない項目に✕の印（data-ng）が出る', `${b.ngBadges}件`);
      ok(b.ngKept, '両立しない囲いを選んでも戦法は自動で差し替わらない', JSON.stringify(b.t4 && b.t4.slots));
      ok(b.ngChip, '両立しない明示チップに ✕ と理由（title）が出る', JSON.stringify(b.t4 && b.t4.chips));
      ok(b.ngDetail, '右 detailに理由と直す候補が出る', '');
      ok(b.noToast, '連動トーストは出ない', '');
      ok(b.ngFixed, '直す候補を押すと両立する選択になる（他の層は不変）', JSON.stringify(b.t4b && b.t4b.slots));
      ok(b.oppOffInit && b.oppOn, '相手 △ から相手表示を ON にして相手側を選べる', `${b.t5 && b.t5.hash}`);
      ok(b.threatOn, '相手を表示すると脅威の帯が出る', `${b.t5 && b.t5.threats}本`);
      ok(b.labels, '相手と自分の関係ラベルをフィールドの河に表示', JSON.stringify(b.t5 && b.t5.relationships));
      ok(b.senkeiPills && b.senkeiPills.n > 0 && b.senkeiPills.n <= 2 && b.senkeiPills.aria,
        '関係ラベルのピルは大分類＋葉の2枚まで・押せる（aria にラベル名）', JSON.stringify(b.senkeiPills));
      ok(b.senkeiPillSel, 'ピルを押すと右 detailにその戦型の情報が出る（選択=me.senkei.*）',
        `sel=${b.senkeiPillSel}`);
      ok(b.oppTab && b.oppSel, '相手タブで相手のスロットを選べる', `sel=${b.t5b && b.t5b.selected}`);
      ok(b.resetInOppBar, '相手を選択中は相手の制約行右端に丸いリセット×を表示', '');
      ok(b.oppRailOff && b.oppRailOn && b.oppFoldOn && b.oppFoldOff,
        '左レールの ON/OFF で相手の段を畳み・再表示できる（＋相手の胞と入れ替わる）',
        `on=${b.oppFoldOn} off=${b.oppFoldOff}`);
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
        const rows3 = await page.evaluate(() =>
          [...document.querySelectorAll('#pickRail .dk-fam:not([hidden])')].map(s => {
            const cs = [...s.querySelectorAll('.dk-card:not([hidden])')].filter(c => c.offsetHeight > 0);
            if (cs.length < 3) return 0;
            const y = cs[0].offsetTop;
            return cs.filter(c => Math.abs(c.offsetTop - y) < 1).length;
          }).filter(n => n > 0));
        ok(rows3.length > 0 && rows3.every(n => n === 3), `board@w${w} 囲いタイルは3列（足りなければサムネごと縮む）`, JSON.stringify(rows3));
      }

      // ---- w=1100: 右 detailはドロワー（§4-6）。タブ＋制約選択で開き、閉じても横スクロールしない ----
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

      // ---- モバイル: 一覧で選んでも面は「選ぶ」のまま（盤は追従表示で変化が見える。M2）。
      //      解説を開くのは「読む」タブか、盤上の制約チップ ----
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click(`${DOCK} .dk-card:not([hidden])`); await wait(900);
      const sheet = await page.evaluate(() => {
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const b = document.querySelector('#board').getBoundingClientRect();
        return { stageBottom: Math.round(stage.bottom), ih: innerHeight,
                 boardVisible: b.bottom > 0 && b.top < innerHeight,
                 sticky: getComputedStyle(document.querySelector('.stage')).position === 'sticky',
                 mtab: document.body.dataset.mtab,
                 railShown: getComputedStyle(document.querySelector('.rail')).display !== 'none',
                 detailKind: (document.querySelector('#detail .bd-who') || {}).textContent || '',
                 sy: Math.round(scrollY) };
      });
      ok(sheet.sticky && sheet.boardVisible && sheet.mtab === 'pick' && sheet.railShown
        && /囲い/.test(sheet.detailKind),
        'w=390 一覧で選ぶと盤が残り、面は「選ぶ」のまま（解説は読むタブ）', JSON.stringify(sheet));
      // 盤上の制約チップを押すと「読む」へ切り替わって盤の下に解説が来る（B2）
      await page.evaluate(() => document.querySelector('#cfield .cf-hit[data-who="me"][data-kind="castle"]').click());
      await wait(700);
      const chipRead = await page.evaluate(() => {
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const d = document.querySelector('#detail').getBoundingClientRect();
        return { mtab: document.body.dataset.mtab,
                 dTop: Math.round(d.top), stageBottom: Math.round(stage.bottom), ih: innerHeight };
      });
      ok(chipRead.mtab === 'read' && chipRead.dTop >= chipRead.stageBottom - 8 && chipRead.dTop < chipRead.ih,
        'w=390 制約チップを押すと「読む」へ切り替わり盤の下に来る', JSON.stringify(chipRead));

      // ---- モバイル: 左右の面は下端タブと横スワイプで「選ぶ⇄読む」を切り替える ----
      const mt = await page.evaluate(() => {
        const vis = el => getComputedStyle(el).display !== 'none' && el.offsetHeight > 0;
        const bar = document.querySelector('.mtabs');
        const rail = document.querySelector('.rail'), det = document.querySelector('.detail');
        bar.querySelector('[data-tab="read"]').click();
        const onRead = !vis(rail) && vis(det);
        bar.querySelector('[data-tab="pick"]').click();
        const onPick = vis(rail) && !vis(det);
        return { barShown: vis(bar), onPick, onRead };
      });
      ok(mt.barShown && mt.onPick && mt.onRead, 'w=390 面は下端タブで選ぶ⇄読むを切替', JSON.stringify(mt));
      const sw = await page.evaluate(() => {
        // 盤（常に見えている）の上の横スワイプで切り替わる。
        // 指に追従する実装なので、方向ロック用に途中の touchmove も送る
        const fire = (el, x0, x1) => {
          const y = 640;
          const mk = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
          const ev = (type, ts, cts) => new TouchEvent(type, { touches: ts, changedTouches: cts, bubbles: true, cancelable: true });
          el.dispatchEvent(ev('touchstart', [mk(x0)], [mk(x0)]));
          for (let i = 1; i <= 3; i++) {
            const x = x0 + (x1 - x0) * i / 3;
            el.dispatchEvent(ev('touchmove', [mk(x)], [mk(x)]));
          }
          el.dispatchEvent(ev('touchend', [], [mk(x1)]));
        };
        const stage = document.querySelector('.stage');
        fire(stage, 300, 130);   // 左スワイプ → 右側の面（読む）
        const toRead = document.body.dataset.mtab;
        fire(stage, 130, 300);   // 右スワイプ → 左側の面（選ぶ）
        return { toRead, toPick: document.body.dataset.mtab };
      });
      ok(sw.toRead === 'read' && sw.toPick === 'pick', 'w=390 横スワイプで面が切り替わる', JSON.stringify(sw));

      // ---- モバイル: 面のほうへ下へ流れると盤は自動で畳まれ、上端へ戻れば展開する ----
      const autoFold = await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));
        window.scrollTo(0, 620);
        await new Promise(r => setTimeout(r, 600));
        const folded = document.body.dataset.boardCollapsed === 'true';
        const stageH = Math.round(document.querySelector('.stage').getBoundingClientRect().height);
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 700));
        return { folded, stageH, back: document.body.dataset.boardCollapsed !== 'true' };
      });
      ok(autoFold.folded && autoFold.back,
        'w=390 下へ流れると盤が自動で畳まれ下半分に縦幅ができる（上端で戻る）', JSON.stringify(autoFold));

      // ---- モバイル: 盤の裾のシートの端で盤を畳める（もう一度引くと戻る） ----
      const fold = await page.evaluate(async () => {
        const area = document.querySelector('.boardarea'), t = document.querySelector('#boardToggle');
        const h0 = area.getBoundingClientRect().height;
        t.click();
        await new Promise(r => setTimeout(r, 900));
        const h1 = area.getBoundingClientRect().height;
        const aria1 = t.getAttribute('aria-expanded');
        t.click();
        await new Promise(r => setTimeout(r, 900));
        return { h0, h1, h2: area.getBoundingClientRect().height, aria1, aria2: t.getAttribute('aria-expanded') };
      });
      ok(fold.h1 < fold.h0 / 3 && fold.h2 >= fold.h0 - 4 && fold.aria1 === 'false' && fold.aria2 === 'true',
        'w=390 盤の裾のシートの端で盤を畳める（もう一度で戻る）', JSON.stringify(fold));

      // ---- w=360 縦: バインダーの重なり（A1）・ヘッダー1行（D1）・タップ領域（C1）・フェード（A3） ----
      await page.setViewportSize({ width: 360, height: 740 }); await wait(350);
      await checkFit(page, 360);
      // 戦法タブに切り替えてタイル/派生チップのタップ領域も測る
      await page.click(`${DOCK} .dk-tab button[data-value="tactic"]`); await wait(300);
      const mob = await page.evaluate(() => {
        const R = el => el.getBoundingClientRect();
        const overlap = (a, b) => !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
        const opp = R(document.querySelector('#pickRail .dk-pc[data-who="opp"]'));
        const me = R(document.querySelector('#pickRail .dk-pc[data-who="me"]'));
        const paneH = document.querySelector('#pickRail .dk-pane-h');
        const body = R(document.querySelector('#pickRail .dk-body'));
        // M1: バインダーの駒はタブの行の中にある（一覧の見出し・本文に重ならない）
        const pcsInside = paneH.contains(document.querySelector('#pickRail .dk-pc[data-who="opp"]'))
          && paneH.contains(document.querySelector('#pickRail .dk-pc[data-who="me"]'));
        // タップ領域: 実寸に、位置が absolute の疑似要素の負の inset（当たり判定の拡張）を足す
        const eff = el => {
          const r = el.getBoundingClientRect();
          let t = 0, b = 0, l = 0, rt = 0;
          for (const pe of ['::before', '::after']) {
            const cs = getComputedStyle(el, pe);
            if (cs.content === 'none' || cs.position !== 'absolute') continue;
            const n = k => { const v = parseFloat(cs[k]); return Number.isFinite(v) ? v : 0; };
            t = Math.min(t, n('top')); b = Math.min(b, n('bottom'));
            l = Math.min(l, n('left')); rt = Math.min(rt, n('right'));
          }
          return Math.min(r.width - l - rt, r.height - t - b);
        };
        const SELS = ['#toolsToggle', '#themeToggle', '#aboutOpen', '#pickRail .dk-tab button',
          '#pickRail .dk-strategy button', '#pickRail .dk-sort-sel', '#pickRail .dk-legend',
          '#pickRail .dk-pc', '#pickRail .dk-pc-x', '#pickRail .dk-tile', '#pickRail .dk-var',
          '#pickRail .dk-fam-h', '#cfield .cf-clear', '#cfield .cf-hit.cf-opp'];
        const small = [];
        for (const sel of SELS) for (const el of document.querySelectorAll(sel)) {
          if (el.offsetParent === null || el.offsetHeight === 0) continue;   // 非表示は除外
          const v = eff(el);
          if (v < 44) small.push(`${sel}:${Math.round(v)}`);
        }
        // 胞のボタン（.cf-hit）と胞の ×（.cf-x）は六角グリッドの実寸に従う（44px 未満は警告）
        const fieldSmall = [];
        for (const el of document.querySelectorAll('#cfield .cf-hit, #cfield .cf-x')) {
          if (el.offsetParent === null || el.offsetHeight === 0) continue;
          const v = eff(el);
          if (v < 44) fieldSmall.push(`${el.dataset.who}.${el.dataset.kind || 'x'}:${Math.round(v)}`);
        }
        const board = R(document.querySelector('#board'));
        return { hdr: Math.round(R(document.querySelector('header')).height),
                 binderFree: pcsInside && !overlap(opp, body) && !overlap(me, body),
                 // フィールドは1枚の SVG で収まり、空きの駒枠（幽霊胞）も出す
                 masked: !!document.querySelector('#cfield .cf-svg')
                   && document.querySelectorAll('#cfield .cf-cell.cf-ghost').length > 0
                   && document.querySelector('#cfield').getBoundingClientRect().right <= innerWidth + 1,
                 impliedDot: (() => {
                   // 既定の胞は網掛け＋破線の縁（A3: 「既定」の文字は角の注記に畳む）
                   const c = document.querySelector('#cfield .cf-row.cf-me .cf-cell[style*="cf-hatch"]');
                   if (!c) return null;
                   return (c.style.strokeDasharray || '').length > 0;
                 })(),
                 sortName: (() => { const x = document.querySelector('#pickRail .dk-sort-sel'); return x ? x.selectedOptions[0].textContent : ''; })(),
                 tnote: Kakoi.TACTIC_FAMILIES.some(f => f.note)
                   ? document.querySelectorAll('#pickRail .dk-tnote').length > 0 : true,
                 boardW: Math.round(board.width), iw: innerWidth, small, fieldSmall };
      });
      ok(mob.binderFree, 'w=360 バインダーの駒が一覧の見出しに重ならない（A1）', '');
      ok(mob.hdr <= 56, 'w=360 ヘッダーは1行に収まる（D1）', `高さ=${mob.hdr}px`);
      ok(mob.small.length === 0, 'w=360 タップ領域は実効44px以上（C1）', mob.small.join(', '));
      if (mob.fieldSmall.length) {
        warn(`w=360 制約フィールドの胞ボタンは実効44px未満（六角グリッドの実寸）: ${mob.fieldSmall.slice(0, 6).join(', ')}`);
      }
      ok(mob.masked, 'w=360 制約フィールドは画面幅に収まり、空きの駒枠も描く（A3）', '');
      ok(mob.impliedDot !== false, 'w=360 既定の胞は網掛け＋破線の縁で示される（A3）', '');
      ok(mob.sortName.length > 0, 'w=360 並べ方の名前を文字で表示（B4）', '');
      ok(mob.tnote, 'w=360 系統の注記が本文に出る（B4）', '');

      // ---- 横向き 844×390（A2）: 盤が左・一覧が右で、盤は画面の高さに収まる ----
      await page.setViewportSize({ width: 844, height: 390 }); await wait(400);
      const land = await page.evaluate(() => {
        const b = document.querySelector('#board').getBoundingClientRect();
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const rail = document.querySelector('.rail').getBoundingClientRect();
        return { boardBottom: Math.round(b.bottom), stageW: Math.round(stage.width),
                 stageLeft: Math.round(stage.left), railLeft: Math.round(rail.left),
                 iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth };
      });
      ok(land.sw <= land.iw + 1, 'w=844x390 横スクロールなし', `scrollWidth=${land.sw}`);
      ok(land.boardBottom <= land.ih + 1 && land.stageLeft < land.railLeft && land.stageW < land.iw,
        'w=844x390 盤は左列に高さで収まる（A2）', JSON.stringify(land));
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
      for (const [w, h] of SHOT_SHAPES) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`${base}#k=mt:shikenbisha,mc:mino,ot:bougin,oc:yagura&opp=1&sel=mc`, { waitUntil: 'networkidle' });
        await wait(500);
        await page.screenshot({ path: path.join(SHOTS, `board-${w}x${h}-${scheme}.png`) });
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
