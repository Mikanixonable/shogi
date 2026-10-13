// 盤の導出を一か所にまとめる（計画書 S5）: 制約リストから
// 両側の実効状態・合成局面・merge（両軍の接触）・脅威・導出ラベルを一括で返す。
// View はこの結果（vm）を受け取るだけにし、compose/matchup を再計算しない。
// DOM に依存しない純粋関数（unit-test からも使える）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  /**
   * @param {Array<{who:string,kind:string,id:string}>} list 制約リスト
   * @param {{ tactic?:string|null, who?:'me'|'opp'|null }} [override]
   *   表示だけの差し替え（再生中の実効戦法）。制約リストは書き換えない
   * @returns {{ S:{me:Object, opp:Object|null},
   *   mePos:Object, oppPos:Object|null, merged:{position:Object, contacts:Array},
   *   threat:Object|null, labels:Array }}
   */
  function deriveBoard(list, override) {
    const S = K.constraints.sides(list);
    const o = override || {};
    if (o.tactic && o.who && S[o.who]) {
      S[o.who] = { ...S[o.who], tacticId: o.tactic };
    }
    const mePos = K.compose.position({
      strategy: S.me.strategy, tacticId: S.me.tacticId, castleId: S.me.castleId, side: 'sente',
    });
    const oppPos = S.opp ? K.compose.position({
      strategy: S.opp.strategy, tacticId: S.opp.tacticId, castleId: S.opp.castleId, side: 'gote',
    }) : null;
    const merged = oppPos
      ? K.compose.merge(mePos.position, oppPos.position, { late: K.constraints.lateOf(list) })
      : { position: mePos.position, contacts: [] };
    const threat = S.opp && K.matchup ? K.matchup.threat(S.me, S.opp) : null;
    const labels = K.constraints.labels(S.me, S.opp);
    return { S, mePos, oppPos, merged, threat, labels };
  }

  K.deriveBoard = deriveBoard;
  if (typeof module !== 'undefined' && module.exports) module.exports = deriveBoard;
})();
