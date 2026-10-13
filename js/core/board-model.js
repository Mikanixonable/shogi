// 盤の導出を一か所にまとめる（計画書 S5）: 各側のスロットから
// 両側の実効状態・合成局面・merge（両軍の接触）・脅威・導出ラベル・両立しない選択を一括で返す。
// View はこの結果（vm）を受け取るだけにし、compose/matchup を再計算しない。
// DOM に依存しない純粋関数（unit-test からも使える）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;

  // 歩同士の接触で1段下げる側（遅れて下がる側）。選んだ順は持たないので相手側に固定する
  const LATE = 'opp';

  /**
   * @param {{me:{tactic,castle}, opp:{tactic,castle}}} slots 各側の固定スロット
   * @param {{ tactic?:string|null, who?:'me'|'opp'|null }} [override]
   *   表示だけの差し替え（再生中の実効戦法）。スロットは書き換えない
   * @param {boolean} [showOpp=true] 相手を表示するか。false のとき oppPos・threat・labels は空
   * @returns {{ S:{me:Object, opp:Object},
   *   mePos:Object, oppPos:Object|null, merged:{position:Object, contacts:Array},
   *   threat:Object|null, labels:Array, ng:{me:Object, opp:Object} }}
   *   S は両側の実効状態（相手の表示が OFF でも opp を持つ）。ng は両立しない明示選択の理由
   */
  function deriveBoard(slots, override, showOpp = true) {
    const S = K.constraints.sides(slots, showOpp);
    const o = override || {};
    if (o.tactic && o.who && S[o.who]) {
      S[o.who] = { ...S[o.who], tacticId: o.tactic };
    }
    const mePos = K.compose.position({
      strategy: S.me.strategy, tacticId: S.me.tacticId, castleId: S.me.castleId, side: 'sente',
    });
    const oppPos = showOpp ? K.compose.position({
      strategy: S.opp.strategy, tacticId: S.opp.tacticId, castleId: S.opp.castleId, side: 'gote',
    }) : null;
    const merged = oppPos
      ? K.compose.merge(mePos.position, oppPos.position, { late: LATE })
      : { position: mePos.position, contacts: [] };
    const threat = showOpp && K.matchup ? K.matchup.threat(S.me, S.opp) : null;
    const labels = K.constraints.labels(S.me, showOpp ? S.opp : null);
    const ng = K.constraints.conflicts(slots, S, showOpp);
    return { S, mePos, oppPos, merged, threat, labels, ng };
  }

  K.deriveBoard = deriveBoard;
  if (typeof module !== 'undefined' && module.exports) module.exports = deriveBoard;
})();
