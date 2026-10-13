// データの参照と表示用の定数（DOM に依存しない）: id → 戦法/囲いオブジェクト、
// 系統の参照、層の日本語名、整合/相手との相性の記号。重複していた定義をここに集約する（計画書 S2）
// 層のスキーマ定数（KINDS/FIELD/WHOS）と表示名の解決（nameOf/castleSides）もここが唯一の定義 ——
// manifest の最上流なので compat / constraints / UI のすべてが同じ定義を共有できる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const findTactic = id => (Kakoi.TACTICS || []).find(t => t && t.id === id) || null;
  const findCastle = id => (Kakoi.CASTLES || []).find(c => c && c.id === id) || null;
  const tacticFamilyOf = t => t ? (Kakoi.TACTIC_FAMILIES || []).find(f => f && f.id === t.family) || null : null;
  const castleFamilyOf = c => c ? (Kakoi.CASTLE_FAMILIES || []).find(f => f && f.id === c.family) || null : null;

  // 層の日本語名（constraint-mode / board-detail-view / constraint-bar / dock-view / detail-sections で共通）
  const LAYER_JA = { tactic: '戦法', castle: '囲い' };
  // 制約モデルのスキーマ: 層の既定順・側・層 → 実効値（sides() の戻り値）のフィールド名
  const KINDS = ['tactic', 'castle'];
  const WHOS = ['me', 'opp'];
  const FIELD = { tactic: 'tacticId', castle: 'castleId' };
  // 相手との相性の印（◎=良い △=悪い）。ドックのバッジと右ドックで同じ意味に統一する（計画書 U1）
  const VS_MARK = { good: '◎', bad: '△', neutral: '' };

  const strategyLabel = s => (Kakoi.STRATEGIES && Kakoi.STRATEGIES[s] && Kakoi.STRATEGIES[s].label) || s || '';

  // 層と id から表示名を解決する（データの name。
  // id==null のとき empty を返す。opt.short で短縮名 —— トーストなどで長い正式名を避ける）
  const nameOf = (kind, id, { short = false, empty = '（未選択）' } = {}) => {
    if (id == null) return empty;
    const x = kind === 'tactic' ? findTactic(id) : findCastle(id);
    return x ? (short && x.short ? x.short : x.name) : id;
  };

  // その囲いを許す戦略の集合（strategies があればそれだけ、なければ side）
  const castleSides = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);

  const api = { findTactic, findCastle, tacticFamilyOf, castleFamilyOf, LAYER_JA, KINDS, WHOS, FIELD, VS_MARK, strategyLabel, nameOf, castleSides };
  Kakoi.lookup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
