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

  // merge の 'ng' 接触（歩同士以外・退避先が塞がった歩同士）を制約の不一致として
  // conflicts の出力に接続する（監査 R-1）。接触マスの駒の role から層へ帰属する:
  //   lead → その側の該当戦法 id（lead.square と一致するものが1つだけのとき。複数なら共有）
  //   core/rest → 'castle'。setup/support/駒なし → layers なし（共有＝その側の全明示層）
  // 'pawn' 接触は盤上で解消済みなので対象外（detail の接触一覧だけに出る従来どおり）。
  function attachContactReasons(slots, S, merged, ng, showOpp) {
    const bad = (merged.contacts || []).filter(c => c.kind === 'ng');
    if (!bad.length) return;
    const { findTactic } = K.catalog;
    const { mirrorSq } = K.notation;
    const pos = merged.position;
    const layerOf = (who, piece) => {
      if (!piece) return [];
      if (piece.role === 'lead') {
        const own = who === 'opp' ? mirrorSq(`${piece.f}${piece.r}`) : `${piece.f}${piece.r}`;
        const ids = (S[who].tacticIds || []).filter(id => {
          const t = findTactic(id);
          return t && t.lead && t.lead.square === own && t.lead.piece === piece.p;
        });
        return ids.length === 1 ? ids : [];
      }
      return (piece.role === 'core' || piece.role === 'rest') ? ['castle'] : [];
    };
    for (const c of bad) {
      const xs = pos.pieces.filter(x => `${x.f}${x.r}` === c.sq);
      for (const who of ['me', 'opp']) {
        if (who === 'opp' && !showOpp) continue;
        const piece = xs.find(x => x.owner === (who === 'me' ? 'sente' : 'gote'));
        if (!piece) continue;
        const layers = layerOf(who, piece);
        const hits = tag => !layers.length || layers.includes(tag);
        const reason = { code: 'CONTACT', squares: [c.sq], layers, text: c.text };
        for (const tid of K.constraints.tacticList(slots[who].tactic)) {
          if (hits(tid)) (ng[who].tactic[tid] = ng[who].tactic[tid] || []).push(reason);
        }
        if (slots[who].castle != null && hits('castle')) {
          (ng[who].castle = ng[who].castle || []).push(reason);
        }
      }
    }
  }

  /**
   * @param {{me:{tactic,castle}, opp:{tactic,castle}}} slots 各側の固定スロット
   * @param {boolean} [showOpp=true] 相手を表示するか。false のとき oppPos・threat・labels は空
   * @returns {{ S:{me:Object, opp:Object},
   *   mePos:Object, oppPos:Object|null, merged:{position:Object, contacts:Array},
   *   threat:Object|null, labels:Array, ng:{me:Object, opp:Object} }}
   *   S は両側の実効状態（相手の表示が OFF でも opp を持つ）。ng は両立しない明示選択の理由
   */
  function deriveBoard(slots, showOpp = true) {
    const S = K.constraints.effectiveSides(slots, showOpp);
    const mePos = K.compose.build({
      strategy: S.me.strategy, tacticIds: S.me.tacticIds, castleId: S.me.castleId, side: 'sente',
    });
    const oppPos = showOpp ? K.compose.build({
      strategy: S.opp.strategy, tacticIds: S.opp.tacticIds, castleId: S.opp.castleId, side: 'gote',
    }) : null;
    const merged = oppPos
      ? K.compose.merge(mePos.position, oppPos.position, { late: LATE })
      : { position: mePos.position, contacts: [] };
    const threat = showOpp && K.matchup ? K.matchup.threat(S.me, S.opp) : null;
    const labels = K.constraints.senkeiLabels(S.me, showOpp ? S.opp : null);
    const ng = K.constraints.conflicts(slots, S, showOpp);
    attachContactReasons(slots, S, merged, ng, showOpp);
    return { S, mePos, oppPos, merged, threat, labels, ng };
  }

  K.deriveBoard = deriveBoard;
  if (typeof module !== 'undefined' && module.exports) module.exports = deriveBoard;
})();
