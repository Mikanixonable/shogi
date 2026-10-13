// 左ドックの面の中身（計画書 S6 の tactic-grid / castle-grid）:
// 戦法タイルと囲いカードの「構築」だけを持つ純粋な描画部品。状態の書き換え
// （バッジ・戦略に合わない項目の非表示）は dock-badges.js / dock-view.js、面の器は dock-pane.js
//   - 戦法タイル: 行=主役の駒の系統、列=筋。タイルは正確に lead.files の筋に
//     プロットし（自分は 9→1・相手は盤の絶対座標。列はどちらも絶対座標なので
//     筋番号ヘッダは両面とも 9…1）、上に筋の番号を出す。
//     1マス=主役の駒の最終マス（lead.square）。variantOf の派生は親と同じ筋の
//     セルの中にチップで積む（多いときは畳む）。列の配置は tacticNav.placeTactics（純関数）
//   - 囲いタイル: CASTLE_FAMILIES ごとの折りたたみブロック。サムネイルは玉側の隅の
//     固定窓（6筋×4段）で歩の壁・周辺の駒ごと見せる（lab/shogi と同じ方式。中央寄りの
//     囲いは窓をずらす。相手の面は180度回転・字は正立）（§4-4）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc } = K.html;
  const { ZEN } = K.notation;
  // 筋の表示名: 相手の面は盤の絶対座標（10−f）に合わせる
  const fileBadge = (t, flip) => t.lead.files.map(f => ZEN[flip ? 10 - f : f]).join('・') + '筋';

  /** view の中の .dk-item を走査用に薄くまとめる */
  const items = view => [...view.querySelectorAll('.dk-item')].map(el => ({
    el, kind: el.dataset.kind, id: el.dataset.id,
    csc: el.querySelector('.dk-csc'), vs: el.querySelector('.dk-vs'),
  }));

  function tile(who, t, flip) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-tile';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = t.id;
    b.style.setProperty('--n', [...(t.short || t.name)].length);   // 名前の文字数（cqw フォント用）
    if (K.tacticNav.isRare(t)) b.dataset.rare = 'true';
    b.innerHTML = `<span class="nm">${esc(t.short || t.name)}</span>` +
      `<span class="fb">${esc(fileBadge(t, flip))}</span>` +
      `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-csc"></span></span>`;
    return b;
  }

  // 派生戦法の小さなチップ（§4-3: 親タイルと同じ筋のセルに束ねる）
  function varChip(who, v) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dk-item dk-var';
    b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = v.id;
    b.dataset.parent = v.variantOf;
    if (K.tacticNav.isRare(v)) b.dataset.rare = 'true';
    b.innerHTML = `<span class="nm">${esc(v.short || v.name)}</span>` +
      `<i class="dk-vs"></i><span class="dk-csc"></span>`;
    return b;
  }

  // 派生チップの束。3枚以上は畳む（縦に長くなりすぎる列の収納）。開閉は面の作り直しまで持つ
  const FOLD_AT = 3;
  function varsBox(chips) {
    const box = document.createElement('div');
    box.className = 'dk-vars';
    box.dataset.open = chips.length < FOLD_AT ? 'true' : 'false';
    if (chips.length >= FOLD_AT) {
      const tg = document.createElement('button');
      tg.type = 'button';
      tg.className = 'dk-vfold';
      tg.setAttribute('aria-expanded', 'false');
      tg.setAttribute('aria-label', `派生戦法 ${chips.length} 件を開閉`);
      tg.innerHTML = `<span class="caret" aria-hidden="true">▸</span>派生${chips.length}`;
      tg.addEventListener('click', e => {
        e.stopPropagation();   // 親の項目選択に渡さない
        const open = box.dataset.open !== 'true';
        box.dataset.open = String(open);
        tg.setAttribute('aria-expanded', String(open));
      });
      box.appendChild(tg);
    }
    const list = document.createElement('div');
    list.className = 'dk-vlist';
    for (const c of chips) list.appendChild(c);
    box.appendChild(list);
    return box;
  }

  // view の器。分類は戦略（居飛車／振り飛車）だけ: 採用中の戦略に合わない
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
    for (const t of K.TACTICS) {
      if (!t.variantOf) continue;
      if (!variantsOf.has(t.variantOf)) variantsOf.set(t.variantOf, []);
      variantsOf.get(t.variantOf).push(t);
    }
    for (const { family, tactics: ts } of ctx.tacticRows) {
      const sec = document.createElement('section');
      sec.className = 'dk-trow';
      sec.dataset.side = family.side;
      // 行見出しに乗せると系統の note（「○が主役の理由」）を出す（lab 周期表の行タイルの title と同じ）
      sec.innerHTML = `<h3 title="${esc(family.note ? `${family.name}\n${family.note}` : family.name)}">` +
        `<span class="pt-tile" aria-hidden="true">${esc(family.piece)}</span>${esc(family.name)}</h3>`;
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
      // 派生チップは親と同じ lead.square → 同じ筋の列。親タイルのセル内で縦に積み、
      // 多いときは varsBox が畳む（§4-3）
      for (const { col, span, row, tactics: cellTs } of cells) {
        const cell = document.createElement('div');
        cell.className = 'dk-cell';
        put(cell, col, span, row);
        const chips = [];
        for (const t of cellTs) {
          cell.appendChild(tile(who, t, flip));
          for (const x of variantsOf.get(t.id) || []) chips.push(varChip(who, x));
        }
        if (chips.length) cell.appendChild(varsBox(chips));
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

  /**
   * 囲いグリッドを組み立てる（系統ごとの折りたたみブロック＋固定窓サムネイル。§4-4）
   * @param {{ _pos:Map }} ctx 共有コンテキスト（DockView）
   * @param {'me'|'opp'} who
   */
  function castles(ctx, who) {
    const flip = who === 'opp';
    const v = viewShell('dk-castles');
    const sidesOf = K.lookup.castleSides; // その囲いを許す戦略の集合
    const fams = [];
    for (const fam of K.CASTLE_FAMILIES) {
      const members = K.CASTLES.filter(c => c.family === fam.id);
      if (!members.length) continue;
      const sec = document.createElement('section');
      sec.className = 'dk-fam';
      sec.dataset.family = fam.id;
      sec._sides = new Set(members.flatMap(sidesOf));   // ブロックの戦略フィルタ判定用
      sec.innerHTML = `<button type="button" class="dk-fam-h" aria-expanded="true" aria-label="${esc(fam.name)}の一覧を開閉">
          <span class="caret" aria-hidden="true">▾</span>
          <span class="g" aria-hidden="true">${K.familyGlyph(fam.glyph)}</span>
          <b>${esc(fam.name)}</b><span class="n">${members.length}</span></button>`;
      const cards = document.createElement('div');
      cards.className = 'dk-cards';
      for (const c of members) {
        const pos = ctx._pos.get(c.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dk-item dk-card';
        b.dataset.who = who; b.dataset.kind = 'castle'; b.dataset.id = c.id;
        b.innerHTML =
          `<span class="thumb" aria-hidden="true"><span class="sc">` +
          K.miniBoardSVG(pos, c.side, { flip }) +
          `</span></span>` +
          `<span class="nm">${esc(c.short || c.name)}</span>` +
          `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-csc"></span></span>`;
        cards.appendChild(b);
      }
      sec.appendChild(cards);
      v.on.appendChild(sec);
      fams.push(sec);
    }
    return { ...v, fams, items: items(v.el) };
  }

  K.dockGrids = { tactics, castles, items };
})();
