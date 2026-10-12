// 駒の対応づけ（共有ロジック）: 局面の切り替えで「どの駒がどこへ動いたか」を、
// 駒の動きの自然さをコスト化した貪欲ペアリングで決める。
// 純粋関数だけなので DOM 版（piece-layer-dom）・立体版（piece-layer-3d）どちらの駒レイヤも同じ対応づけを使う
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 滑らせるペアのコスト上限（マス単位）。これを超える組み合わせは「消滅＋出現」にする
  const MAX_COST = 4.6;

  /**
   * 駒を from → to へ滑らせる不自然さ（マス単位）。null は滑らせない（消滅＋出現にする）
   * 筋 f=1..9（右→左）、段 r=1..9（上→下）。先手の前進は r が減る向き。
   * 一つの局面から複数手進んだ差分もあるので、合法手そのものではなく緩い罰則に留める
   * @param {string} p 駒の字（data-p）
   * @param {string} from マス 例 '39'
   * @param {string} to マス 例 '56'
   * @returns {number|null}
   */
  const moveCost = (p, from, to) => {
    const dF = +to[0] - +from[0], dR = +to[1] - +from[1];
    const dist = Math.hypot(dF, dR);
    const side = dF !== 0, back = dR > 0;
    let c = dist;
    switch (p) {
      case '歩':
      case '香': // 前へしか進めない: 同じ筋で前進する組み合わせだけ滑らせる
        if (side || back) return null;
        break;
      case '桂': // 前に跳ぶ駒: 後退・横滑りはさせない。桂らしい跳び方を優遇
        if (dR >= 0) return null;
        if (!(Math.abs(dF) === 1 && dR === -2)) c += .8;
        break;
      case '銀': // 真横・真後ろは一手では行けないので緩く罰則（斜め後退は可）
        if (back !== side) c += .9;
        break;
      case '飛': // 縦横の直線上は自然な滑走（長距離も可）、それ以外は回り道として罰則
        c = (side && dR !== 0) ? dist + 1.6 : dist * .55;
        break;
      case '角': // 斜めの直線上は自然な滑走、それ以外は回り道として罰則
        c = (side && Math.abs(dF) === Math.abs(dR)) ? dist * .55 : dist + 1.6;
        break;
      // 玉・金・その他: どの向きにも進めるので距離だけ
    }
    return c <= MAX_COST ? c : null;
  };

  /**
   * before → after の駒の対応づけ。
   * 要素は { p:string, sq:string, owner:'sente'|'gote', skip?:any }。先に自由な付随データを持たせてよい。
   * after の skip が truthy の駒は対応づけから外す（筋道をたどる主役・後手の駒など）。
   * @returns {{ pairs:Array<{o:number,n:number,cost:number}>, gone:number[], appear:number[] }}
   *   pairs:  before[o] の駒を after[n] のマスへ滑らせる
   *   gone:   消えた駒（before の添字）。同じマスに同じ駒が残っているものは含まない
   *   appear: 新しく現れる駒（after の添字。skip の駒も含むので利用側で振り分ける）
   */
  function pair(before, after) {
    const cand = [];
    after.forEach((n, ni) => before.forEach((o, oi) => {
      if (n.skip || o.owner !== 'sente' || n.owner !== 'sente' || o.p !== n.p) return;
      const cost = moveCost(o.p, o.sq, n.sq);
      if (cost != null) cand.push({ ni, oi, cost });
    }));
    cand.sort((a, b) => a.cost - b.cost);
    const usedN = new Set(), usedO = new Set(), pairs = [];
    for (const { ni, oi, cost } of cand) {
      if (usedN.has(ni) || usedO.has(oi)) continue;
      usedN.add(ni); usedO.add(oi);
      pairs.push({ o: oi, n: ni, cost });
    }
    // 同じマスに同じ駒が残っているものは消えた扱いにしない（後手の駒は対応づけの対象外なのでここで救う）
    const still = new Set(after.map(n => `${n.owner}:${n.p}:${n.sq}`));
    const gone = [], appear = [];
    before.forEach((o, oi) => {
      if (!usedO.has(oi) && !still.has(`${o.owner}:${o.p}:${o.sq}`)) gone.push(oi);
    });
    after.forEach((n, ni) => { if (!usedN.has(ni)) appear.push(ni); });
    return { pairs, gone, appear };
  }

  Kakoi.pieceMatch = { MAX_COST, moveCost, pair };
})();
