// 既定値の解決（唯一の権威。計画書 §1-2 / S6）: 戦略テンプレートの
// defaultTactic / defaultCastle（{vsIbisha,vsFuribisha} 振り分けを含む）と、
// sideState（{strategy, tacticId?, castleId?}）から実効 id を返す窓口。
// compat.js / matchup.js / compose.js / constraints.js が共有する。戦略そのものは
// 制約にせず、戦法（無ければ囲い）から constraints.sides() が導く。
// ここはデータと lookup にだけ依存し、compat/constraints を参照しない
// （compat ↔ constraints の相互参照を一方向にするために分離した。計画書 S6）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // Object.hasOwn: 'constructor' や '__proto__' 経由で継承プロパティを拾わない（L6）
  const stratOf = id =>
    (id && Kakoi.STRATEGIES && Object.hasOwn(Kakoi.STRATEGIES, id)) ? Kakoi.STRATEGIES[id] : null;
  function defaultTacticId(strategy) {
    return (stratOf(strategy) || {}).defaultTactic || null;
  }
  // defaultCastle は文字列または { vsIbisha, vsFuribisha }。相手の戦略が分かるときはそれで振り分ける
  function defaultCastleId(strategy, oppStrategy) {
    const dc = (stratOf(strategy) || {}).defaultCastle;
    if (typeof dc === 'string') return dc;
    if (dc) return (oppStrategy === 'furibisha' ? dc.vsFuribisha : dc.vsIbisha) || dc.vsIbisha || dc.vsFuribisha || null;
    return null;
  }
  function defaultIdOf(kind, strategy, oppStrategy) {
    if (kind === 'tactic') return defaultTacticId(strategy);
    if (kind === 'castle') return defaultCastleId(strategy, oppStrategy);
    return null;
  }
  // 従来の sideState（{strategy, tacticId?, castleId?}）から実効 id を返す薄い窓口
  // 複数戦法: tacticIds の配列があればその主（primaryTacticId）を優先する
  const primaryTacticId = ids => {
    const list = Array.isArray(ids) ? ids : (ids != null ? [ids] : []);
    for (const id of list) {
      const t = id && Kakoi.lookup && Kakoi.lookup.findTactic(id);
      if (t && t.lead && t.lead.piece === '飛') return id;
    }
    return list[0] || null;
  };
  // 実効状態（sides() の出力。戦法は tacticIds のみが実効表現）の主の戦法を取る窓口。
  // 旧形式（tacticId の単独値）の入力も吸収する。tacticIdOf と違い戦略既定値までは降りない
  const primaryOf = st =>
    st ? primaryTacticId(st.tacticIds) || st.tacticId || null : null;
  const tacticIdOf = st =>
    (st && (st.tacticId || primaryTacticId(st.tacticIds))) || defaultTacticId(st && st.strategy);
  const castleIdOf = (st, opp) => (st && st.castleId) || defaultCastleId(st && st.strategy, opp && opp.strategy);

  const api = { defaultTacticId, defaultCastleId, defaultIdOf, tacticIdOf, castleIdOf, primaryTacticId, primaryOf };
  Kakoi.defaults = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
