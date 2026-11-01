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

  // 同じ系統で筋の帯が重なる戦法は同じ段に置けない（周期表のセルが重なる）。
  // 重ならないものから順に段へ振り分け、全部重なるときだけ新しい段を足す
  function lanesOf(tactics) {
    const lanes = [];
    for (const t of tactics) {
      const lo = Math.min(...t.lead.files), hi = Math.max(...t.lead.files);
      let lane = lanes.find(L => L.every(x =>
        hi < Math.min(...x.lead.files) || lo > Math.max(...x.lead.files)));
      if (!lane) lanes.push(lane = []);
      lane.push(t);
    }
    return lanes;
  }

  /** 系統の行を段にほぐした一覧。段は系統内で上から順、系統間は元の並びのまま */
  function laneRows(rows) {
    return rows.flatMap(({ family, tactics }) =>
      lanesOf(tactics).map(lane => ({ family, tactics: lane })));
  }

  /** 注記が「まれ」で始まる戦法 */
  const isRare = t => /^まれ/.test(t.note || '');

  /**
   * 矢印キーで次に選ぶ戦法。←→ は同じ系統で前後（端は反対側へ）、↑↓ は隣の段で筋が最も近いもの
   * @param {{family:object, tactics:object[]}[]} rows
   * @returns {?object} 動かないときは null
   */
  function neighbor(rows, current, key) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const ri = rows.findIndex(r => r.tactics.includes(current));
      if (ri < 0) return null;
      const list = rows[ri].tactics;
      if (list.length < 2) return null;
      const d = key === 'ArrowRight' ? 1 : -1;
      return list[(list.indexOf(current) + d + list.length) % list.length];
    }
    const lanes = laneRows(rows);
    const li = lanes.findIndex(r => r.tactics.includes(current));
    if (li < 0) return null;
    const next = lanes[li + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0)];
    if (!next || !next.tactics.length) return null;
    const c = center(current);
    const dist = t => Math.min(...t.lead.files.map(f => Math.abs(f - c)));
    return next.tactics.reduce((best, t) => (dist(t) < dist(best) ? t : best));
  }

  /**
   * 戦法の行を「筋の列」へ配置する計算（純関数。ドックのタイル用。S6）
   * 列の規則: 自分は 9筋→左端（col = 10−f）、相手は盤の絶対座標（col = f）。
   * 同じ lead.square の戦法は1セルに束ね、列が重なるセルは下の行へ送る。
   * @param {object[]} tactics その行（系統）の戦法（派生 variantOf は呼び側が除く）
   * @param {{ flip?:boolean }} [opts]
   * @returns {{ cells:Array<{col:number, span:number, row:number, tactics:object[]}>,
   *            dots:Array<{col:number, row:number}> }}
   *   cells は col・span・row（1始まりの行内での積み上げ順）と束ねた戦法。
   *   dots は列が空の筋（プレースホルダ）
   */
  function placeTactics(tactics, { flip = false } = {}) {
    // 束ねる: 1セル = 同じ lead.square の戦法（データ順を保つ）
    const groups = new Map();
    for (const t of tactics) {
      const k = t.lead.square;
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
