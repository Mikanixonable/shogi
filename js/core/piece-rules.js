// 駒の動きの単一権威（coverage-tesuji §5-1・§5-6）: 通常駒と成駒（1字の 馬・龍・全・杏・圭・と）を
// 1か所にまとめる。core/tesuji-engine.js の reach・core/tesuji-check.js の検算器・core/attack-map.js の
// 利き計算がここから引く。「その駒の動きで何手かかるか」の reachPly（BFS）もここが権威。
//   [df, dr] は盤座標の増減（dr<0 が先手の前進）。後手は上下左右を反転して使う
//   「竜」はデータ読み込み時に「龍」へ正規化する（parseSide / validate 側の約束）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  // 成りの対応。取った成駒は元の駒（BASE）として持ち駒に入る
  const PROMOTED = { 歩: 'と', 香: '杏', 桂: '圭', 銀: '全', 角: '馬', 飛: '龍' };
  const BASE = Object.fromEntries(Object.entries(PROMOTED).map(([a, b]) => [b, a]));
  // 成駒の字（竜は正規化して龍に畳む）と、持ち駒になり得る駒（玉・成駒は含まない）
  const PROM_CHARS = 'と杏圭全馬龍';
  const HAND_CHARS = '歩香桂銀金角飛';

  const GOLD = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const KING = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]], ORTH = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  const STEPS = {
    玉: KING,
    金: GOLD, と: GOLD, 杏: GOLD, 圭: GOLD, 全: GOLD,
    銀: [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]],
    桂: [[-1, -2], [1, -2]],
    歩: [[0, -1]],
    馬: ORTH,   // 馬 = 角の滑走 + 玉の縦横
    龍: DIAG,   // 龍 = 飛の滑走 + 玉の斜め
  };
  const SLIDES = {
    香: [[0, -1]],
    飛: ORTH,
    角: DIAG,
    馬: DIAG,
    龍: ORTH,
  };

  /** 駒 p の動き（{steps, rays}）。未登録の駒は金の動きごとフォールバック
   * （香・角のように滑走だけ持つ駒に金の歩みは足さない） */
  const movesOf = p => (STEPS[p] || SLIDES[p]
    ? { steps: STEPS[p] || [], rays: SLIDES[p] || [] }
    : { steps: STEPS['金'], rays: [] });

  // {steps, rays} の併記で馬・龍も表せる（登録済みの駒だけ。金フォールバックは movesOf 側の約束）
  const MOVES = {};
  for (const p of new Set([...Object.keys(STEPS), ...Object.keys(SLIDES)]))
    MOVES[p] = { steps: STEPS[p] || [], rays: SLIDES[p] || [] };

  // ---------- reachPly: 「その駒の動きで何手かかるか」（合成の届く判定用。計画書 L3） ----------
  // 盤上の障害物を無視した BFS。先手視点（段が減る向きが前）。上限8手、届かなければ Infinity。
  // 動きの定義はこのファイルが単一権威（未登録の駒は金フォールバック）。
  // piece-pairing.js の slideCost（アニメ用の滑らせやすさ）は対応づけの優劣にだけ使い、
  // 届くかどうかはこちらで判定する
  const MAX_PLY = 8;
  // メモは compat.js / constraints.js と同じく共有 LRU（Kakoi.newLRU で作る定型）。
  // キー空間は駒種×81マスと有限だが、上限＋最近使った順の保持に揃えておく。
  // lru.js より先に読み込まれるので、初回呼び出し時に作る（その時点では lru.js 済み）
  let mcMemo = null;                    // `${p}:${from}` → Map(toKey → 手数)
  function bfsCount(p, from) {
    const mv = movesOf(p);
    const out = new Map();
    let frontier = [[+from[0], +from[1]]];
    for (let d = 1; d <= MAX_PLY && frontier.length; d++) {
      const next = [];
      for (const [f, r] of frontier) {
        for (const [df, dr] of mv.steps || []) {
          const nf = f + df, nr = r + dr;
          if (nf < 1 || nf > 9 || nr < 1 || nr > 9) continue;
          const k = nf * 10 + nr;
          if (out.has(k)) continue;
          out.set(k, d);
          next.push([nf, nr]);
        }
        for (const [df, dr] of mv.rays || []) {
          let nf = f + df, nr = r + dr;
          while (nf >= 1 && nf <= 9 && nr >= 1 && nr <= 9) {
            const k = nf * 10 + nr;
            if (!out.has(k)) { out.set(k, d); next.push([nf, nr]); }
            nf += df; nr += dr;
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
  function reachPly(p, from, to) {
    if (from === to) return 0;
    if (!mcMemo) mcMemo = Kakoi.newLRU(512);
    const ck = `${p}:${from}`;
    let m = mcMemo.get(ck);
    if (!m) {
      m = bfsCount(p, from);
      mcMemo.set(ck, m);
    }
    return m.has(+to[0] * 10 + +to[1]) ? m.get(+to[0] * 10 + +to[1]) : Infinity;
  }

  Kakoi.pieceRules = { PROMOTED, BASE, PROM_CHARS, HAND_CHARS, STEPS, SLIDES, MOVES, movesOf, reachPly };
})();
