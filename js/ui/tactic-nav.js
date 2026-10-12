// 戦法の並びと移動: 行ごとの並び（筋の大きい順＝表の左から右）と、矢印キーで次に選ぶ戦法の計算
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { ZEN } = Kakoi.notation;

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

  /** 「６筋」「４・３筋」 */
  const fileBadge = t => t.lead.files.map(f => ZEN[f]).join('・') + '筋';

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

  Kakoi.tacticNav = { tacticRows, fileBadge, isRare, neighbor };
})();
