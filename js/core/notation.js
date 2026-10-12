// 棋譜表記: "玉78" のような駒文字列の読み書きとマスの表示名
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const ZEN = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
  const KAN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /** マスを表す整数キー（筋*10+段） */
  const key = (f, r) => f * 10 + r;

  /** "78" → { f:7, r:8 } */
  const parseSquare = s => ({ f: +s[0], r: +s[1] });

  /** "玉78 金69" → [{ p, f, r, ...extra }] */
  function parsePieces(str, extra = {}) {
    if (!str) return [];
    return str.trim().split(/\s+/).map(t => ({ p: t[0], ...parseSquare(t.slice(1)), ...extra }));
  }

  /** 7,8 → "７八" */
  const label = (f, r) => ZEN[f] + KAN[r];

  Kakoi.notation = { ZEN, KAN, key, parseSquare, parsePieces, label };
})();
