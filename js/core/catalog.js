// データの参照と表示用の定数（DOM に依存しない）: id → 戦法/囲いオブジェクト、
// 系統の参照、層の日本語名、整合/相手との相性の記号。重複していた定義をここに集約する（計画書 S2）
// 層のスキーマ定数（KINDS/FIELD/WHOS）と表示名の解決（nameOf/castleSides）もここが唯一の定義 ——
// manifest の最上流なので compat / constraints / UI のすべてが同じ定義を共有できる
// 役割分担: catalog はグローバルデータ（Kakoi.TACTICS 等）への軽い参照とスキーマ定数。
// core の純関数はここを使い、UI 用の組み立て済みデータ窓口（Map 化・出典の解決・
// 系統順の並び）は js/core/repository.js の Repository が担う
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // id → オブジェクトの索引。data ファイルは `Kakoi.CASTLES.push(...)` 形式で
  // あとから追記することがあるので、配列の参照・長さが変わっていたら作り直す。
  // 索引に無い id は線形走査にフォールバックする（置き換えられた項目を拾う保険）
  const idIndex = get => {
    let arr = null, len = -1, map = new Map();
    return id => {
      const a = get() || [];
      if (a !== arr || a.length !== len) {
        map = new Map();
        for (const x of a) if (x && x.id != null) map.set(x.id, x);
        arr = a; len = a.length;
      }
      return map.has(id) ? map.get(id) : a.find(x => x && x.id === id) || null;
    };
  };
  const findTactic = idIndex(() => Kakoi.TACTICS);
  const findCastle = idIndex(() => Kakoi.CASTLES);
  // 戦型（SENKEI）の参照窓口。SENKEI_RESOLVE で別名 id（aiyagura → yagura）を解決する
  const findSenkei = id => {
    const S = Kakoi.SENKEI || {}, R = Kakoi.SENKEI_RESOLVE || {};
    return S[id] || S[R[id]] || null;
  };
  const tacticFamilyOf = t => t ? (Kakoi.TACTIC_FAMILIES || []).find(f => f && f.id === t.family) || null : null;
  const castleFamilyOf = c => c ? (Kakoi.CASTLE_FAMILIES || []).find(f => f && f.id === c.family) || null : null;

  // 層の日本語名（controller / detail-view / constraint-bar / rail-view / detail-sections で共通）
  // strategy はスロットを持たないが選択はできる（右 detail でその戦型の情報を見る層）
  // senkei は strategy（居飛車／振り飛車）の「戦型」と区別するため「戦型（細）」とする
  // （文献の戦型＝矢倉・角換わり…の細分類。coverage-senkei §3-4-4 の次善案）
  const LAYER_JA = { tactic: '戦法', castle: '囲い', strategy: '戦型', senkei: '戦型（細）' };
  // 制約モデルのスキーマ: 層の既定順・側・層 → 実効値（effectiveSides() の戻り値）のフィールド名。
  // 戦法は複数採用できるので単一のフィールドを持たない（実効値は tacticIds。
  // 主の戦法は defaults.primaryOf で導く）。FIELD は単一値を持つ層（castle）だけ
  const KINDS = ['tactic', 'castle'];
  const WHOS = ['me', 'opp'];
  const FIELD = { castle: 'castleId' };
  // 相手との相性の印（◎=良い △=悪い）。レールのバッジと右 detail で同じ意味に統一する（計画書 U1）
  const VS_MARK = { good: '◎', bad: '△', neutral: '' };

  const strategyLabel = s => (Kakoi.STRATEGIES && Kakoi.STRATEGIES[s] && Kakoi.STRATEGIES[s].label) || s || '';

  // 層と id から表示名を解決する（データの name。
  // id==null のとき empty を返す。opt.short で短縮名 —— トーストなどで長い正式名を避ける）
  const nameOf = (kind, id, { short = false, empty = '（未選択）' } = {}) => {
    if (id == null) return empty;
    const x = kind === 'tactic' ? findTactic(id) : kind === 'senkei' ? findSenkei(id) : findCastle(id);
    return x ? (short && x.short ? x.short : x.name) : id;
  };

  // その囲いを許す戦略の集合（strategies があればそれだけ、なければ side）
  const castleSides = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);

  const api = { findTactic, findCastle, findSenkei, tacticFamilyOf, castleFamilyOf, LAYER_JA, KINDS, WHOS, FIELD, VS_MARK, strategyLabel, nameOf, castleSides };
  Kakoi.catalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
