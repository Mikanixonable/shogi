// 左ドックの一覧の中身（計画書 S6 の tactic-grid / castle-grid）:
// 戦法タイルと囲いカードの「構築」だけを持つ純粋な描画部品。状態の書き換え
// （バッジ・戦略に合わない項目の非表示）は dock-badges.js / dock-view.js
//   - 戦法タイル: 行=主役の駒の系統、列=筋。タイルは正確に lead.files の筋に
//     プロットし（自分は 9→1・相手は盤の絶対座標。列はどちらも絶対座標なので
//     筋番号ヘッダは両面とも 9…1）、上に筋の番号を出す。
//     1マス=主役の駒の最終マス（lead.square）。variantOf の派生は親と同じ筋の
//     列に分岐チップとして常に表示する。列の配置は
//     tacticNav.placeTactics（純関数）
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
  // 筋の表示名: 相手の面は盤の絶対座標（10−f）に合わせる
  const fileBadge = (t, flip) => t.lead.files.map(f => ZEN[flip ? 10 - f : f]).join('・') + '筋';
  // 系統色（theme.css の --f-* / --t-*）: 囲いは系統、戦法は主役の駒で塗り分ける
  const famColor = id => `var(--f-${id}, var(--accent-2))`;
  const PIECE_COLOR = { '飛': 'var(--t-rook)', '銀': 'var(--t-silver)', '角': 'var(--t-kaku)' };

  // 基本の項目（データの basic）を先に出す安定ソート
  const basicFirst = list => [...list].sort((a, b) => (b.basic ? 1 : 0) - (a.basic ? 1 : 0));
  // 基本の項目の印（初心者が最初に覚える囲い・戦法）
  const SEAL = '<span class="dk-seal" aria-label="基本">基本</span>';

  /** view の中の .dk-item を走査用に薄くまとめる */
  const items = view => [...view.querySelectorAll('.dk-item')].map(el => ({
    el, kind: el.dataset.kind, id: el.dataset.id,
    ng: el.querySelector('.dk-ng'), vs: el.querySelector('.dk-vs'),
  }));

  function tile(who, t, flip) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-tile';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = t.id;
    b.style.setProperty('--n', [...(t.short || t.name)].length);   // 名前の文字数（cqw フォント用）
    if (K.tacticNav.isRare(t)) b.dataset.rare = 'true';
    if (t.basic) b.dataset.basic = 'true';
    b.innerHTML = (t.basic ? SEAL : '') + `<span class="nm">${esc(t.short || t.name)}</span>` +
      `<span class="fb">${esc(fileBadge(t, flip))}</span>` +
      `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-ng"></span></span>`;
    return b;
  }

  // 派生戦法の小さなチップ（§4-3: 親と同じ筋の列に分岐表示）
  function varChip(who, v) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-var';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = v.id;
    b.dataset.parent = v.variantOf;
    if (K.tacticNav.isRare(v)) b.dataset.rare = 'true';
    b.innerHTML = '<span class="dk-branch" aria-hidden="true">↳</span>' +
      `<span class="nm">${esc(v.short || v.name)}</span>` +
      `<i class="dk-vs"></i><span class="dk-ng"></span>`;
    return b;
  }

  // view の器。分類は戦略（居飛車／振り飛車）だけ: 絞り込んだ戦略に合わない
  // 行・系統・項目は dock-view が hidden にする（「もう一方」の領域は持たない）
  function viewShell(cls) {
    const view = document.createElement('div');
    view.className = `dk-view ${cls}`;
    const on = document.createElement('div');
    on.className = 'dk-on';
    view.append(on);
    return { el: view, on };
  }

  /**
   * 戦法グリッドを組み立てる
   * @param {{ tacticRows:Array }} ctx 共有コンテキスト（DockView）
   * @param {'me'|'opp'} who
   */
  function tactics(ctx, who) {
    const flip = who === 'opp';
    const v = viewShell('dk-tactics');
    // 筋の番号ヘッダ: 列はどちらの面も盤の絶対座標（左=9筋）なので、両面とも 9…1
    const fh = document.createElement('div');
    fh.className = 'dk-fh';
    fh.setAttribute('aria-hidden', 'true');
    fh.innerHTML = [9, 8, 7, 6, 5, 4, 3, 2, 1].map(f => `<span>${ZEN[f]}</span>`).join('');
    v.on.appendChild(fh);
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
      sec.className = 'dk-trow';
      sec.dataset.side = family.side;
      sec.style.setProperty('--tc', PIECE_COLOR[family.piece] || 'var(--accent-2)');
      // 行見出しに乗せると系統の note（「○が主役の理由」）を出す（lab 周期表の行タイルの title と同じ）
      sec.innerHTML = `<h3 title="${esc(family.note ? `${family.name}\n${family.note}` : family.name)}">` +
        `<span class="pt-tile" aria-hidden="true">${esc(family.piece)}</span>${esc(family.name)}</h3>` +
        // 系統の注記: 広い画面は行見出しの title、狭い画面（タッチ）は本文に出す（B4）
        (family.note ? `<small class="dk-tnote">${esc(family.note)}</small>` : '');
      const grid = document.createElement('div');
      grid.className = 'dk-tgrid';
      // 同じ lead.square の非派生戦法は1セルに束ね、列が重なるセルは下へ送る
      const put = (el, col, span, row) => {
        el.style.gridColumn = `${col} / span ${span}`;
        el.style.gridRow = String(row);
        grid.appendChild(el);
      };
      const { cells, dots } = K.tacticNav.placeTactics(
        ts.filter(t => !t.variantOf), { flip });
      for (const d of dots) {
        const el = document.createElement('span');
        el.className = 'dk-dot';
        el.textContent = '–';
        el.setAttribute('aria-hidden', 'true');
        put(el, d.col, 1, d.row);
      }
      // 派生チップは親と同じ lead.square → 親タイルと同じセルに、親の直下へ積む
      // （§4-3。セルの中に入れるので、狭い画面の縦リストでも親に隣接する）
      for (const { col, span, row, tactics: cellTs } of cells) {
        const cell = document.createElement('div');
        cell.className = 'dk-cell';
        put(cell, col, span, row);
        for (const t of cellTs) {
          cell.appendChild(tile(who, t, flip));
          for (const x of variantsOf.get(t.id) || [])
            cell.appendChild(varChip(who, x));
        }
      }
      sec.appendChild(grid);
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
    sec._sides = new Set(members.flatMap(K.lookup.castleSides));   // ブロックの戦略フィルタ判定用
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
      const src = depth === 0 && c.from ? K.lookup.findCastle(c.from) : null;
      rows.push(card(ctx, who, c, flip,
        { row: true, depth, note: src ? `${src.short || src.name}から` : '' }));
      for (const k of basicFirst(kids.get(c.id) || [])) walk(k, depth + 1);
    };
    for (const r of basicFirst(roots)) walk(r, 0);
    return rows;
  }

  /** 囲いの並べ方（左ドックのメニュー）: 系統別・発展ツリー・特徴の目安の軸ごと */
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
   * @param {{ _pos:Map }} ctx 共有コンテキスト（DockView）
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

  K.dockGrids = { tactics, castles, CASTLE_SORTS };
})();
