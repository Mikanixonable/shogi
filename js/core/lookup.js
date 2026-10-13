// データの参照と表示用の定数（DOM に依存しない）: id → 戦法/囲いオブジェクト、
// 系統の参照、層の日本語名、整合/相手との相性の記号。重複していた定義をここに集約する（計画書 S2）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const findTactic = id => (Kakoi.TACTICS || []).find(t => t && t.id === id) || null;
  const findCastle = id => (Kakoi.CASTLES || []).find(c => c && c.id === id) || null;
  const tacticFamilyOf = t => t ? (Kakoi.TACTIC_FAMILIES || []).find(f => f && f.id === t.family) || null : null;
  const castleFamilyOf = c => c ? (Kakoi.CASTLE_FAMILIES || []).find(f => f && f.id === c.family) || null : null;

  // 層の日本語名（constraint-mode / board-detail-view / constraint-bar / dock-view / detail-sections で共通）
  const LAYER_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  // 相手との相性の印（◎=良い △=悪い）。ドックのバッジと右ドックで同じ意味に統一する（計画書 U1）
  const VS_MARK = { good: '◎', bad: '△', neutral: '' };

  const strategyLabel = s => (Kakoi.STRATEGIES && Kakoi.STRATEGIES[s] && Kakoi.STRATEGIES[s].label) || s || '';

  // 左ドックの上下分割の定数（app.js の既定値と dock-view.js のスプリッタで共有）
  const DOCK = { MIN_PANE: 120, SPLIT_MIN: .2, SPLIT_MAX: .8, SPLIT_DEFAULT: .5 };

  const api = { findTactic, findCastle, tacticFamilyOf, castleFamilyOf, LAYER_JA, VS_MARK, strategyLabel, DOCK };
  Kakoi.lookup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
