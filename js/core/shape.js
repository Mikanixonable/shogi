// 囲いの形の類似度: 玉からの相対配置で距離を測り、クラスタリング・MDS・ARIを計算する（純粋関数のみ）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const DEFAULT_WEIGHTS = { typeMismatch: 0.6, unmatched: 2.0, king: 0.35 };

  /** 囲いの形の署名: 振り飛車は筋を左右反転し、玉からの相対位置で駒を表す */
  function signature(castle) {
    const mirror = castle.side === 'furibisha';
    const all = Kakoi.notation.parsePieces(castle.core)
      .map(s => ({ p: s.p, f: mirror ? 10 - s.f : s.f, r: s.r }));
    const king = all.find(s => s.p === '玉');
    const pieces = all.filter(s => s !== king)
      .map(s => ({ p: s.p, df: s.f - king.f, dr: s.r - king.r }));
    return { king: { f: king.f, r: king.r }, pieces };
  }

  /** 2駒を対応づけるコスト（相対位置の距離 + 駒種の違い） */
  function pairCost(x, y, w) {
    return Math.hypot(x.df - y.df, x.dr - y.dr) + (x.p !== y.p ? w.typeMismatch : 0);
  }

  /** 少ない側 small の各駒を large の別々の駒へ割り当てる最小コスト（全探索） */
  function bestInjection(small, large, w) {
    const used = new Array(large.length).fill(false);
    let best = Infinity;
    const walk = (i, acc) => {
      if (acc >= best) return;
      if (i === small.length) { best = acc; return; }
      for (let j = 0; j < large.length; j++) {
        if (used[j]) continue;
        used[j] = true;
        walk(i + 1, acc + pairCost(small[i], large[j], w));
        used[j] = false;
      }
    };
    walk(0, 0);
    return best;
  }

  /** 2つの署名の距離（対称） */
  function distance(a, b, w = DEFAULT_WEIGHTS) {
    const [small, large] = a.pieces.length <= b.pieces.length ? [a.pieces, b.pieces] : [b.pieces, a.pieces];
    const match = bestInjection(small, large, w);
    const extra = (large.length - small.length) * w.unmatched;
    const kingD = Math.hypot(a.king.f - b.king.f, a.king.r - b.king.r);
    return match + extra + w.king * kingD;
  }

  /** 全囲いの距離行列 */
  function matrix(castles, w = DEFAULT_WEIGHTS) {
    const sigs = castles.map(signature);
    const d = sigs.map(() => new Array(sigs.length).fill(0));
    for (let i = 0; i < sigs.length; i++)
      for (let j = i + 1; j < sigs.length; j++)
        d[i][j] = d[j][i] = distance(sigs[i], sigs[j], w);
    return { ids: castles.map(c => c.id), d };
  }

  /** 平均連結の凝集型クラスタリング。根ノードを返す */
  function cluster(m) {
    let nodes = m.ids.map((id, i) => ({ id, members: [id], height: 0, idx: [i] }));
    const avg = (x, y) => {
      let s = 0;
      for (const i of x.idx) for (const j of y.idx) s += m.d[i][j];
      return s / (x.idx.length * y.idx.length);
    };
    while (nodes.length > 1) {
      let bi = 0, bj = 1, bd = Infinity;
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const v = avg(nodes[i], nodes[j]);
          if (v < bd) { bd = v; bi = i; bj = j; }
        }
      const l = nodes[bi], r = nodes[bj];
      const merged = { left: l, right: r, members: [...l.members, ...r.members], height: bd, idx: [...l.idx, ...r.idx] };
      nodes = nodes.filter((_, k) => k !== bi && k !== bj);
      nodes.push(merged);
    }
    return nodes[0];
  }

  /** 木を k 個のクラスタに切る（高い結合から順に分割）。id → クラスタ番号 */
  function cut(root, k) {
    let parts = [root];
    while (parts.length < k) {
      let bi = -1;
      parts.forEach((n, i) => { if (n.left && (bi < 0 || n.height > parts[bi].height)) bi = i; });
      if (bi < 0) break;
      const n = parts[bi];
      parts.splice(bi, 1, n.left, n.right);
    }
    const out = new Map();
    parts.forEach((n, i) => n.members.forEach(id => out.set(id, i)));
    return out;
  }

  /** 二重中心化: B = -1/2 J D^2 J */
  function doubleCenter(d) {
    const n = d.length;
    const sq = d.map(row => row.map(v => v * v));
    const rowMean = sq.map(row => row.reduce((a, b) => a + b, 0) / n);
    const total = rowMean.reduce((a, b) => a + b, 0) / n;
    return sq.map((row, i) => row.map((v, j) => -0.5 * (v - rowMean[i] - rowMean[j] + total)));
  }

  /** べき乗法で最大固有値・固有ベクトル（開始ベクトルは決定的） */
  function powerIteration(B, iters = 500) {
    const n = B.length;
    let v = B.map((_, i) => 1 + Math.sin(i + 1));
    let lambda = 0;
    for (let t = 0; t < iters; t++) {
      const u = B.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
      const norm = Math.hypot(...u);
      if (norm < 1e-12) return { lambda: 0, v: new Array(n).fill(0) };
      v = u.map(x => x / norm);
    }
    const Bv = B.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
    lambda = Bv.reduce((s, x, i) => s + x * v[i], 0);
    return { lambda, v };
  }

  /** 古典的MDS（2次元）。座標は [-1,1] に正規化 */
  function mds(m) {
    let B = doubleCenter(m.d);
    const axes = [];
    for (let k = 0; k < 2; k++) {
      const { lambda, v } = powerIteration(B);
      const s = Math.sqrt(Math.max(lambda, 0));
      axes.push(v.map(x => x * s));
      B = B.map((row, i) => row.map((x, j) => x - lambda * v[i] * v[j]));
    }
    const maxAbs = Math.max(1e-12, ...axes.flat().map(Math.abs));
    const out = new Map();
    m.ids.forEach((id, i) => out.set(id, { x: axes[0][i] / maxAbs, y: axes[1][i] / maxAbs }));
    return out;
  }

  /** 調整ランド指数（2つのラベル付けの一致度。1で完全一致） */
  function adjustedRand(labelsA, labelsB) {
    const ids = [...labelsA.keys()];
    const n = ids.length;
    const c2 = x => x * (x - 1) / 2;
    const table = new Map(), ra = new Map(), rb = new Map();
    for (const id of ids) {
      const a = labelsA.get(id), b = labelsB.get(id), key = a + '\u0000' + b;
      table.set(key, (table.get(key) || 0) + 1);
      ra.set(a, (ra.get(a) || 0) + 1);
      rb.set(b, (rb.get(b) || 0) + 1);
    }
    const sum = map => [...map.values()].reduce((s, x) => s + c2(x), 0);
    const index = sum(table), sa = sum(ra), sb = sum(rb);
    const expected = sa * sb / c2(n);
    const max = (sa + sb) / 2;
    return max === expected ? 1 : (index - expected) / (max - expected);
  }

  Kakoi.shape = { DEFAULT_WEIGHTS, signature, distance, matrix, cluster, cut, mds, adjustedRand };
})();
