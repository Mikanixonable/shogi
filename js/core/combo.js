// 戦法と囲いの合成: 戦法の局面に囲いの形を重ねた新しい局面を作る（戦法画面の「盤に重ねる」）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { key } = Kakoi.notation;

  /**
   * 戦法の局面に囲いの形を重ねる。元の局面は変えず、新しい局面を返す。
   * 両者とも先手の駒が1組そろった局面なので、和集合ではなく置換で合成する。
   * 囲いの駒（core→support の順）を目標のマスへ適用する:
   *  - 目標に同じ駒がいれば囲いの駒にする（主役は主役のまま）
   *  - 別の駒がいれば持ち駒へ移し、盤上で一番近い同種の駒（主役・適用済みは除く）を目標へ移す
   *  - 盤上に使える同種の駒がなければ持ち駒から補う
   * 主役（lead）の駒は動かさない。目標のマスに主役がいるなら、その囲いの駒はあきらめる
   * @param {Kakoi.Position} tacticPos 戦法の局面（lead/support の role 付き）
   * @param {Kakoi.Position} castlePos 囲いの局面（core/support/setup の role 付き）
   * @returns {Kakoi.Position}
   */
  function combinePosition(tacticPos, castlePos) {
    const pieces = tacticPos.pieces.map(x => ({ ...x }));
    const hand = [...(tacticPos.hand || [])];
    const done = new Set(); // 囲いの駒として置き終えた駒（あとの目標の移し替え元にしない）
    const at = (f, r) => pieces.find(x => key(x.f, x.r) === key(f, r));

    // 囲いを構成する駒を先に、補助の駒をあとに適用する（想定配置 role:setup は対象外）
    const targets = [
      ...castlePos.pieces.filter(x => x.owner === 'sente' && x.role === 'core'),
      ...castlePos.pieces.filter(x => x.owner === 'sente' && x.role === 'support'),
    ];

    for (const t of targets) {
      const on = at(t.f, t.r);
      if (on && on.p === t.p) {
        // 目標のマスに同じ駒: 囲いの駒として数える（主役の表示は変えない）
        if (on.role !== 'lead') on.role = t.role;
        done.add(on);
        continue;
      }
      if (on) {
        if (on.role === 'lead') continue; // 主役は動かさないのでこの目標はあきらめる
        hand.push(on.p);                  // 目標にいた別の駒は持ち駒へ
        pieces.splice(pieces.indexOf(on), 1);
      }
      // 移し替え元: 盤上で一番近い同種の駒（主役・適用済みは除く）。なければ持ち駒から補う
      let donor = null, dist = Infinity;
      for (const x of pieces) {
        if (x.p !== t.p || x.role === 'lead' || done.has(x)) continue;
        const d = Math.hypot(x.f - t.f, x.r - t.r);
        if (d < dist) { donor = x; dist = d; }
      }
      if (donor) {
        donor.f = t.f; donor.r = t.r; donor.role = t.role;
        done.add(donor);
      } else {
        const i = hand.indexOf(t.p);
        if (i < 0) continue; // 同種の駒が尽きた（駒が1組そろっていれば起きない）
        hand.splice(i, 1);
        const x = { p: t.p, f: t.f, r: t.r, owner: 'sente', role: t.role };
        pieces.push(x);
        done.add(x);
      }
    }
    return new Kakoi.Position(pieces, hand);
  }

  Kakoi.combinePosition = combinePosition;
})();
