// 駒の対応づけ（共有ロジック）: 局面の切り替えで「どの駒がどこへ動いたか」を、
// 駒の動きの自然さをコスト化した貪欲ペアリングで決める。
// 純粋関数だけなので DOM 版（piece-layer-dom）・立体版（piece-layer-3d）どちらの駒レイヤも同じ対応づけを使う
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 滑らせるペアのコスト上限（マス単位）。これを超える組み合わせは「消滅＋出現」にする
  const MAX_COST = 4.6;

  // 後手の駒は (f,r)→(10−f,10−r) で回転して置く（compose.mirror と同じ変換）。
  // コスト計算にも同じ回転をかけると、後手の「前」（段が増える向き）が
  // moveCost の前提する先手の「前」（段が減る向き）と一致する
  const mir = s => `${10 - +s[0]}${10 - +s[1]}`;

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

  // ---------- moveCount: 「その駒の動きで何手かかるか」（合成の届く判定用。計画書 L3） ----------
  // 盤上の障害物を無視した BFS。先手視点（段が減る向きが前）。上限8手、届かなければ Infinity。
  // moveCost（アニメ用の滑らせやすさ）は対応づけの優劣にだけ使い、届くかどうかは自分で判定する
  const STEP = {
    歩: [[0, -1]],
    香: [[0, -1]],   // 前へしか進めない（RAY との組み合わせで同じ筋の前方へ滑走。GOLD_STEP への
                     // フォールバックを防ぐ＝横・後退・斜めに「届く」と誤判定しない）
    桂: [[-1, -2], [1, -2]],
    銀: [[0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]],
    角: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    飛: [[0, -1], [0, 1], [-1, 0], [1, 0]],
  };
  const GOLD_STEP = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const RAY = { 香: 1, 角: 1, 飛: 1 };
  const stepOf = p => STEP[p] || GOLD_STEP;   // 玉・金（・未登録の駒）は金の動き
  const MAX_PLY = 8;
  const mcMemo = new Map();                    // `${p}:${from}` → Map(toKey → 手数)
  function bfsCount(p, from) {
    const steps = stepOf(p), ray = !!RAY[p];
    const out = new Map();
    let frontier = [[+from[0], +from[1]]];
    for (let d = 1; d <= MAX_PLY && frontier.length; d++) {
      const next = [];
      for (const [f, r] of frontier) {
        for (const [df, dr] of steps) {
          let nf = f + df, nr = r + dr;
          if (ray) {
            while (nf >= 1 && nf <= 9 && nr >= 1 && nr <= 9) {
              const k = nf * 10 + nr;
              if (!out.has(k)) { out.set(k, d); next.push([nf, nr]); }
              nf += df; nr += dr;
            }
          } else {
            if (nf < 1 || nf > 9 || nr < 1 || nr > 9) continue;
            const k = nf * 10 + nr;
            if (out.has(k)) continue;
            out.set(k, d);
            next.push([nf, nr]);
          }
        }
      }
      frontier = next;
    }
    return out;
  }
  /**
   * 駒 p が from → to へ自分の動きだけで行く最小手数（障害物無視。上限8手）。
   * 届かなければ Infinity。歩・香は前進のみ、桂は前方のみになる（二歩・横歩・桂の後退を防ぐ）
   * @param {string} p 駒の字 @param {string} from 例 '39' @param {string} to 例 '79'
   * @returns {number}
   */
  function moveCount(p, from, to) {
    if (from === to) return 0;
    const ck = `${p}:${from}`;
    let m = mcMemo.get(ck);
    if (!m) {
      m = bfsCount(p, from);
      if (mcMemo.size > 400) mcMemo.delete(mcMemo.keys().next().value); // 簡易上限
      mcMemo.set(ck, m);
    }
    return m.has(+to[0] * 10 + +to[1]) ? m.get(+to[0] * 10 + +to[1]) : Infinity;
  }

  /**
   * before → after の駒の対応づけ。
   * 要素は { p:string, sq:string, owner:'sente'|'gote', skip?:any }。先に自由な付随データを持たせてよい。
   * 対応づけは owner が一致する駒同士だけ（先手と後手をまたいで滑らせない）。
   * 後手どうしのペアは、マスを回転させてからコストを計る（後手の前進を「前」として扱うため）。
   * after の skip が truthy の駒は対応づけから外す（筋道をたどる主役の駒など）。
   * @returns {{ pairs:Array<{o:number,n:number,cost:number}>, gone:number[], appear:number[] }}
   *   pairs:  before[o] の駒を after[n] のマスへ滑らせる
   *   gone:   消えた駒（before の添字）。同じマスに同じ駒が残っているものは含まない
   *   appear: 新しく現れる駒（after の添字。skip の駒も含むので利用側で振り分ける）
   */
  function pair(before, after) {
    const cand = [];
    after.forEach((n, ni) => before.forEach((o, oi) => {
      if (n.skip || o.owner !== n.owner || o.p !== n.p) return;
      const cost = o.owner === 'gote' ? moveCost(o.p, mir(o.sq), mir(n.sq)) : moveCost(o.p, o.sq, n.sq);
      if (cost != null) cand.push({ ni, oi, cost });
    }));
    cand.sort((a, b) => a.cost - b.cost);
    const usedN = new Set(), usedO = new Set(), pairs = [];
    for (const { ni, oi, cost } of cand) {
      if (usedN.has(ni) || usedO.has(oi)) continue;
      usedN.add(ni); usedO.add(oi);
      pairs.push({ o: oi, n: ni, cost });
    }
    // 同じマスに同じ駒が残っているものは消えた扱いにしない（skip で対応づけから外れた駒はここで救う）
    const still = new Set(after.map(n => `${n.owner}:${n.p}:${n.sq}`));
    const gone = [], appear = [];
    before.forEach((o, oi) => {
      if (!usedO.has(oi) && !still.has(`${o.owner}:${o.p}:${o.sq}`)) gone.push(oi);
    });
    after.forEach((n, ni) => { if (!usedN.has(ni)) appear.push(ni); });
    return { pairs, gone, appear };
  }

  Kakoi.pieceMatch = { MAX_COST, moveCost, moveCount, pair };
})();
