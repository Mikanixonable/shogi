// 戦法の並びと移動: 行ごとの並び（筋の大きい順＝表の左から右）と、矢印キーで次に選ぶ戦法の計算
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  /** 戦法の筋の中心（早繰り銀 [4,3] なら 3.5） */
  const center = t => t.lead.files.reduce((a, b) => a + b, 0) / t.lead.files.length;

  /** 行ごとに戦法を表の左から右（９筋→１筋）へ並べる */
  function tacticRows(families, tactics) {
    return families.map(family => ({
      family,
      tactics: tactics.filter(t => t.family === family.id).sort((a, b) => center(b) - center(a)),
    }));
  }

  /** 注記が「まれ」で始まる戦法 */
  const isRare = t => /^まれ/.test(t.note || '');

  /**
   * 矢印キーで次に選ぶ戦法。←→ は同じ行で前後（端は反対側へ）、↑↓ は隣の行で筋が最も近いもの
   * @param {{family:object, tactics:object[]}[]} rows
   * @returns {?object} 動かないときは null
   */
  function neighbor(rows, current, key) {
    const ri = rows.findIndex(r => r.tactics.includes(current));
    if (ri < 0) return null;
    const list = rows[ri].tactics;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (list.length < 2) return null;
      const d = key === 'ArrowRight' ? 1 : -1;
      return list[(list.indexOf(current) + d + list.length) % list.length];
    }
    const next = rows[ri + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0)];
    if (!next || !next.tactics.length) return null;
    const c = center(current);
    const dist = t => Math.min(...t.lead.files.map(f => Math.abs(f - c)));
    return next.tactics.reduce((best, t) => (dist(t) < dist(best) ? t : best));
  }

  /**
   * 戦法の行を「筋の列」へ配置する計算（純関数。周期表とドックのタイルで共有する。S6）
   * 列の規則: 自分は 9筋→左端（col = 10−f）、相手は盤の絶対座標（col = f）。
   * @param {object[]} tactics その行（系統）の戦法（派生 variantOf は呼び側が除く）
   * @param {{ flip?:boolean, group?:'square'|'file', collide?:'stack'|'drop' }} [opts]
   *   group: 'square'=同じ lead.square の戦法を1セルに束ねる（ドック）
   *          'file'  =同じ右端の筋の戦法を1セルに束ねる（周期表: 同じ列の別戦法は先のものだけ）
   *   collide: 'stack'=列が重なるセルは下の行へ送る（ドック）
   *            'drop' =列が重なるセルは捨てる（周期表: 隠れた戦法は一覧から選ぶ）
   * @returns {{ cells:Array<{col:number, span:number, row:number, tactics:object[]}>,
   *            dots:Array<{col:number, row:number}> }}
   *   cells は col・span・row（1始まりの行内での積み上げ順）と束ねた戦法。
   *   dots は列が空の筋（プレースホルダ）
   */
  function placeTactics(tactics, { flip = false, group = 'square', collide = 'stack' } = {}) {
    // 束ねる: 1セル = 束ねキーごとの戦法（データ順を保つ）
    const keyOf = t => group === 'square' ? t.lead.square : `f${Math.max(...t.lead.files)}`;
    const groups = new Map();
    for (const t of tactics) {
      const k = keyOf(t);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    // 列→行の使用済み（陣取りのずれを避けるため列ごとに次に空く行を追う）
    const used = Array(10).fill(0);
    const cells = [];
    for (const ts of groups.values()) {
      const lo = Math.min(...ts[0].lead.files), hi = Math.max(...ts[0].lead.files);
      const span = ts[0].lead.files.length;
      const col = flip ? lo : 10 - hi;
      let row = 0;
      for (let c = col; c < col + span; c++) row = Math.max(row, used[c]);
      row += 1;
      if (collide === 'drop' && row > 1) continue;   // 隠れるセルは描かない（周期表）
      for (let c = col; c < col + span; c++) used[c] = row;
      cells.push({ col, span, row, tactics: ts });
    }
    const covered = new Set(tactics.flatMap(t => t.lead.files));
    const dots = [];
    for (let f = 9; f >= 1; f--) {
      if (covered.has(f)) continue;
      const col = flip ? f : 10 - f;
      dots.push({ col, row: 1 });
    }
    return { cells, dots };
  }

  Kakoi.tacticNav = { tacticRows, isRare, neighbor, placeTactics };
})();
