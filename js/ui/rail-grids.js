// 左レールの一覧の中身（計画書 S6 の tactic-grid / castle-grid）:
// 戦法タイルと囲いカードの「構築」だけを持つ純粋な描画部品。状態の書き換え
// （バッジ・戦略に合わない項目の非表示・採用の裏返し）は rail-badges.js / rail-view.js
//   - 戦法（design-refs-tactic-select 案A「駒棚」）: 行=主役の駒（飛銀角桂歩金玉の7系統）。初期状態は全行展開。
//     行の中は筋順（9→1）に並ぶ札。各札は9目盛りの筋地図を内蔵し、主役の駒が立つ
//     筋を駒色で塗る（lead.files。相手の面は絶対座標に反転）。下に最終マスとペース。
//     variantOf の派生は親札の下に「派生 n」の帯で畳む。系統行は件数にかかわらず初期展開
//   - 基本の項目（データの basic）は「基本」の印を付けて系統の先頭に置く
//   - 囲いタイル: 並べ方（CASTLE_SORTS）ごとの折りたたみブロック。既定は CASTLE_FAMILIES ごと。サムネイルは core 駒の
//     外接矩形を最小 5筋×3段に広げた窓で、歩の壁・周辺の駒ごと見せる。タイルの幅は窓の描画幅
//     （--ar。サムネにぴったりの札）に限る。相手の面は180度回転・字は正立（§4-4）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc } = K.html;
  const { ZEN } = K.notation;
  // 相手の面は盤の絶対座標（10−f）に合わせる
  const absF = (f, flip) => (flip ? 10 - f : f);
  // 系統色（theme.css の --f-* / --t-*）: 囲いは系統、戦法は主役の駒で塗り分ける
  const famColor = id => `var(--f-${id}, var(--accent-2))`;
  const PIECE_COLOR = { '飛': 'var(--t-rook)', '銀': 'var(--t-silver)', '角': 'var(--t-kaku)',
    '桂': 'var(--t-kei)', '歩': 'var(--t-fu)', '金': 'var(--t-kin)', '玉': 'var(--t-gyoku)' };
  // ペースの記号: 急戦・持久戦・両対応
  const PACE = { rapid: '急', slow: '持', both: '両' };
  const RANKS = '一二三四五六七八九';

  // 基本の項目（データの basic）を先に出す安定ソート
  const basicFirst = list => [...list].sort((a, b) => (b.basic ? 1 : 0) - (a.basic ? 1 : 0));
  // 基本の項目の印（初心者が最初に覚える囲い・戦法）
  const SEAL = '<span class="dk-seal" aria-label="基本">基本</span>';

  /** view の中の .dk-item を走査用に薄くまとめる */
  const items = view => [...view.querySelectorAll('.dk-item')].map(el => ({
    el, kind: el.dataset.kind, id: el.dataset.id,
    ng: el.querySelector('.dk-ng'), vs: el.querySelector('.dk-vs'),
  }));

  // 主役の駒が立つ筋の地図: 9目盛り（左=9筋）で lead.files を塗る
  const fileMap = (t, flip) => {
    const on = new Set(t.lead.files.map(f => absF(f, flip)));
    return `<span class="dk-map" aria-hidden="true">` +
      [9, 8, 7, 6, 5, 4, 3, 2, 1].map(f => `<i${on.has(f) ? ' class="on"' : ''}></i>`).join('') +
      `</span>`;
  };
  // 最終マスの表示（相手は筋だけ絶対座標に反転。段は盤と同じ）
  const sqText = (t, flip) => `${ZEN[absF(+t.lead.square[0], flip)]}${RANKS[+t.lead.square[1] - 1]}`;

  function tile(who, t, flip) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-tile dk-tl';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = t.id;
    if (K.tacticNav.isRare(t)) b.dataset.rare = 'true';
    if (t.basic) b.dataset.basic = 'true';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = (t.basic ? SEAL : '') + fileMap(t, flip) +
      `<span class="sq">${esc(sqText(t, flip))}</span>` +
      `<span class="nm">${esc(t.short || t.name)}</span>` +
      `<span class="dk-marks"><span class="pace" data-p="${t.pace || 'both'}">${PACE[t.pace] || '両'}</span>` +
      `<i class="dk-vs"></i><span class="dk-ng"></span></span>`;
    return b;
  }

  // 派生戦法の小さなチップ（親札の下の束に畳む）
  function varChip(who, v) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-var';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = v.id;
    b.dataset.parent = v.variantOf;
    if (K.tacticNav.isRare(v)) b.dataset.rare = 'true';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="dk-branch" aria-hidden="true">↳</span>' +
      `<span class="nm">${esc(v.short || v.name)}</span>` +
      `<span class="dk-marks"><span class="pace" data-p="${v.pace || 'both'}">${PACE[v.pace] || '両'}</span>` +
      `<i class="dk-vs"></i><span class="dk-ng"></span></span>`;
    return b;
  }

  // view の器。分類は戦略（居飛車／振り飛車）だけ: 絞り込んだ戦略に合わない
  // 行・系統・項目は rail-view が hidden にする（「もう一方」の領域は持たない）
  function viewShell(cls) {
    const view = document.createElement('div');
    view.className = `dk-view ${cls}`;
    const on = document.createElement('div');
    on.className = 'dk-on';
    view.append(on);
    return { el: view, on };
  }

  /**
   * 戦法グリッドを組み立てる（駒棚。行=駒・札=筋の地図を持つ）
   * @param {{ tacticRows:Array }} ctx 共有コンテキスト（RailView）
   * @param {'me'|'opp'} who
   */
  function tactics(ctx, who) {
    const flip = who === 'opp';
    const v = viewShell('dk-tactics');
    const variantsOf = new Map();
    const tacticById = new Map(K.TACTICS.map(t => [t.id, t]));
    for (const t of K.TACTICS) {
      if (!t.variantOf) continue;
      // 派生の派生は根のタイルに畳む（チップは非派生のタイルにしか付けない）
      let root = t.variantOf;
      for (let i = 0; tacticById.get(root) && tacticById.get(root).variantOf && i < 8; i++)
        root = tacticById.get(root).variantOf;
      if (!variantsOf.has(root)) variantsOf.set(root, []);
      variantsOf.get(root).push(t);
    }
    for (const { family, tactics: ts } of ctx.tacticRows) {
      const sec = document.createElement('section');
      sec.className = 'dk-fam dk-trow';
      sec.dataset.side = family.side;
      const tc = PIECE_COLOR[family.piece] || 'var(--accent-2)';
      sec.style.setProperty('--tc', tc);
      sec.style.setProperty('--fam', tc);
      const roots = ts.filter(t => !t.variantOf);
      // 全ての駒の行を初期展開する。利用者が見出しを押して個別に畳むことはできる
      // 見出しの筋の列挙: その駒が実際に使う筋（重複なし・筋の大きい順）
      const files = [...new Set(ts.flatMap(t => t.lead.files))].sort((a, b) => b - a)
        .map(f => ZEN[absF(f, flip)]).join('・');
      sec.innerHTML = `<button type="button" class="dk-fam-h" aria-expanded="true" ` +
        `title="${esc(family.note ? `${family.name}\n${family.note}` : family.name)}">` +
        `<span class="caret" aria-hidden="true">▾</span>` +
        `<span class="pt-tile" aria-hidden="true">${esc(family.piece)}</span>` +
        `<b>${esc(family.label || family.name)}</b>` +
        `<span class="dk-fr">${files}筋</span>` +
        `<span class="dk-seldot" aria-hidden="true"></span>` +
        `<span class="n">${ts.length}</span></button>` +
        (family.note ? `<small class="dk-tnote">${esc(family.note)}</small>` : '');
      const stand = document.createElement('div');
      stand.className = 'dk-stand';
      for (const t of roots) {
        const col = document.createElement('div');
        col.className = 'dk-tcol';
        col.appendChild(tile(who, t, flip));
        const vs = variantsOf.get(t.id);
        if (vs && vs.length) {
          const vars = document.createElement('div');
          vars.className = 'dk-vars';
          vars.innerHTML = `<button type="button" class="dk-vf" aria-expanded="false">` +
            `派生 <b>${vs.length}</b> <span class="caret" aria-hidden="true">▾</span></button>`;
          const list = document.createElement('div');
          list.className = 'dk-vlist';
          for (const x of vs) list.appendChild(varChip(who, x));
          vars.appendChild(list);
          col.appendChild(vars);
        }
        stand.appendChild(col);
      }
      sec.appendChild(stand);
      v.on.appendChild(sec);
    }
    return {
      ...v,
      rows: [...v.el.querySelectorAll('.dk-trow')],
      items: items(v.el),
      tiles: [...v.el.querySelectorAll('.dk-tile')],
    };
  }

  /** 囲いカード1枚。row=true は発展ツリーの横長の行（depth で字下げ、note は名前の下の注記） */
  function card(ctx, who, c, flip, { row = false, depth = 0, note = '' } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dk-item dk-card${row ? ' dk-row' : ''}`;
    b.dataset.who = who; b.dataset.kind = 'castle'; b.dataset.id = c.id;
    if (c.basic) b.dataset.basic = 'true';
    b.style.setProperty('--fam', famColor(c.family));   // 堅さ順など系統が混ざる段でも下線で系統が分かる
    if (row) { b.style.setProperty('--d', depth); b.dataset.depth = depth; }
    else b.style.setProperty('--ar', K.miniAspect(K.miniWindow(ctx._pos.get(c.id), c.side, flip)).toFixed(4));   // カード幅=サムネの描画幅
    b.innerHTML =
      (row && depth ? '<span class="br" aria-hidden="true">└</span>' : '') +
      `<span class="thumb" aria-hidden="true"><span class="sc">` +
      K.miniBoardSVG(ctx._pos.get(c.id), c.side, { flip }) +
      `</span></span>` +
      `<span class="tx"><span class="nm">${esc(c.short || c.name)}</span>` +
      (note ? `<span class="from">${esc(note)}</span>` : '') + `</span>` +
      (c.basic ? SEAL : '') +
      `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-ng"></span></span>`;
    return b;
  }

  // 折りたたみブロックの器（系統・性質の段のどちらにも使う）
  function block(id, head, members, color = 'var(--accent-2)') {
    const sec = document.createElement('section');
    sec.className = 'dk-fam';
    sec.dataset.family = id;
    sec.style.setProperty('--fam', color);   // 左の帯・記号・件数の丸の色
    sec._sides = new Set(members.flatMap(K.catalog.castleSides));   // ブロックの戦略フィルタ判定用
    sec.innerHTML = `<button type="button" class="dk-fam-h" aria-expanded="true">
          <span class="caret" aria-hidden="true">▾</span>${head}<span class="n">${members.length}</span></button>`;
    return sec;
  }

  // 系統の中の発展ツリー: from が同じ系統の囲いを指せば子にする。系統をまたぐ from
  // （穴熊←舟囲いなど）は根に「○○から」と添える。根も子も基本を先に並べる
  function treeRows(ctx, who, flip, members) {
    const ids = new Set(members.map(c => c.id));
    const kids = new Map();
    const roots = [];
    for (const c of members) {
      if (c.from && ids.has(c.from)) {
        if (!kids.has(c.from)) kids.set(c.from, []);
        kids.get(c.from).push(c);
      } else roots.push(c);
    }
    const rows = [];
    const walk = (c, depth) => {
      const src = depth === 0 && c.from ? K.catalog.findCastle(c.from) : null;
      rows.push(card(ctx, who, c, flip,
        { row: true, depth, note: src ? `${src.short || src.name}から` : '' }));
      for (const k of basicFirst(kids.get(c.id) || [])) walk(k, depth + 1);
    };
    for (const r of basicFirst(roots)) walk(r, 0);
    return rows;
  }

  /** 囲いの並べ方（左レールのメニュー）: 系統別・発展ツリー・特徴の目安の軸ごと */
  const CASTLE_SORTS = [
    { id: 'family', label: '系統別' },
    { id: 'tree', label: '発展ツリー' },
    ...K.detailSections.RATINGS
      .filter(([id]) => id !== 'wide' && id !== 'quick')
      .map(([id, name]) => ({ id, label: `${name}順`, axis: name })),
  ];

  /**
   * 囲いグリッドを組み立てる（§4-4）
   *   family: 系統ごとの折りたたみブロック＋固定窓サムネイル
   *   tree:   系統ごとに from をたどった発展ツリー（発展形は字下げした小さな行）
   *   hard 等: 特徴の目安のその軸の段（5→1）ごとのブロック
   * @param {{ _pos:Map }} ctx 共有コンテキスト（RailView）
   * @param {'me'|'opp'} who
   * @param {string} [sort] CASTLE_SORTS の id
   */
  function castles(ctx, who, sort = 'family') {
    const flip = who === 'opp';
    const v = viewShell('dk-castles');
    v.el.dataset.sort = sort;
    const fams = [];
    const add = (sec, body) => { sec.appendChild(body); v.on.appendChild(sec); fams.push(sec); };
    const grid = (members) => {
      const cards = document.createElement('div');
      cards.className = 'dk-cards';
      for (const c of basicFirst(members)) cards.appendChild(card(ctx, who, c, flip));
      return cards;
    };
    const axis = CASTLE_SORTS.find(x => x.id === sort && x.axis);
    if (axis) {
      for (let lv = 5; lv >= 1; lv--) {
        const members = K.CASTLES.filter(c => c.ratings && c.ratings[sort] === lv);
        if (!members.length) continue;
        const stars = '★'.repeat(lv) + '☆'.repeat(5 - lv);
        add(block(`${sort}${lv}`, `<span class="st" aria-hidden="true">${stars}</span>` +
          `<b>${esc(axis.axis)} ${lv}</b>`, members), grid(members));
      }
      return { ...v, fams, items: items(v.el) };
    }
    for (const fam of K.CASTLE_FAMILIES) {
      const members = K.CASTLES.filter(c => c.family === fam.id);
      if (!members.length) continue;
      const sec = block(fam.id, `<span class="g" aria-hidden="true">${K.familyGlyph(fam.glyph)}</span>` +
        `<b>${esc(fam.name)}</b>`, members, famColor(fam.id));
      if (sort === 'tree') {
        const tree = document.createElement('div');
        tree.className = 'dk-cards dk-tree';
        tree.append(...treeRows(ctx, who, flip, members));
        add(sec, tree);
      } else add(sec, grid(members));
    }
    return { ...v, fams, items: items(v.el) };
  }

  // ---------- 戦型（細）の絞り込み ----------
  // いまの組み合わせの大分類（両側の戦略から）→ その組に属し絞れる項目を持つ戦型チップ。
  // 側別リスト（{ibisha,furibisha}）は平坦化して照合する
  const flatIds = v => Array.isArray(v) ? v : [...(v && v.ibisha || []), ...(v && v.furibisha || [])];
  const groupIdsOf = (me, opp, showOpp) => !showOpp
    ? ['aiibisha', 'taikou', 'aifuri']    // 相手を出していなければ全部（大分類）
    : [(me.strategy === 'ibisha')
        ? (opp.strategy === 'ibisha' ? 'aiibisha' : 'taikou')
        : (opp.strategy === 'ibisha' ? 'taikou' : 'aifuri')];
  function senkeiCandidates(me, opp, showOpp) {
    const SK = K.SENKEI || {};
    const gs = groupIdsOf(me, opp, showOpp);
    return Object.keys(SK).filter(id => {
      const e = SK[id];
      return e && gs.includes(e.group) && (flatIds(e.tactics).length || flatIds(e.castles).length);
    });
  }
  // senkeiId のチップで項目を残すか。戦法は senkei[] タグと SENKEI.tactics、
  // 囲いは SENKEI.castles と照合する（表示だけの状態。制約は変えない）
  function senkeiMatch(senkeiId, kind, id) {
    if (!senkeiId) return true;
    const SK = K.SENKEI || {}, RES = K.SENKEI_RESOLVE || {};
    const rid = SK[senkeiId] ? senkeiId : RES[senkeiId];
    const e = rid && SK[rid];
    if (!e) return true;
    if (kind === 'castle') return flatIds(e.castles).includes(id);
    const t = (K.TACTICS || []).find(t => t.id === id);
    return !!t && (flatIds(e.tactics).includes(id) || (t.senkei || []).includes(rid));
  }

  K.railGrids = { tactics, castles, senkeiCandidates, senkeiMatch, CASTLE_SORTS };
})();
