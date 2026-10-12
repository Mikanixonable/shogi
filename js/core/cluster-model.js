// 分類マップの計算結果: 距離行列・木・ARIを一度だけ求め、描画に使う形（点・木・近傍）に整える
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const SAME = 1e-9;            // 距離がこれ未満なら同じ形（左右反転の同形）とみなす

  class ClusterModel {
    /** @param {Kakoi.Repository} repo */
    constructor(repo) {
      const shape = Kakoi.shape;
      this.repo = repo;
      this.castles = repo.castles();
      const m = shape.matrix(this.castles);
      this._d = m.d;
      this._index = new Map(m.ids.map((id, i) => [id, i]));
      const root = shape.cluster(m);
      this.k = repo.families().length;
      this.groupOf = shape.cut(root, this.k);
      this.ari = shape.adjustedRand(new Map(this.castles.map(c => [c.id, c.family])), this.groupOf);
      this._buildPoints();
      this.tree = this._collapse(root);
      this.cutHeight = this._cutHeight(root);
      this.maxHeight = root.height;
    }

    dist(a, b) { return this._d[this._index.get(a)][this._index.get(b)]; }

    /** 同じ形（左右反転の同形を含む）の囲いを1点にまとめた表示用の点を作る */
    _buildPoints() {
      const points = [];
      this._pointOf = new Map();
      for (const c of this.castles) {
        let p = points.find(q => this.dist(q.ids[0], c.id) < SAME);
        if (!p) {
          p = { key: c.id, ids: [], castles: [], family: c.family };
          points.push(p);
        }
        p.ids.push(c.id);
        p.castles.push(c);
        this._pointOf.set(c.id, p);
      }
      for (const p of points) p.label = p.castles.map(c => c.short).join('・');
      this.points = points;
      this.merged = points.some(p => p.ids.length > 1);
    }

    /** 同形の点を1枚の葉にまとめた表示用の木。葉は { point }、内部は { left, right, height } */
    _collapse(node) {
      const keys = new Set(node.members.map(id => this._pointOf.get(id).key));
      if (keys.size === 1) return { point: this._pointOf.get(node.members[0]) };
      return { left: this._collapse(node.left), right: this._collapse(node.right), height: node.height };
    }

    /** k グループに切る高さ（k-1 番目と k 番目に高い結合の中間） */
    _cutHeight(root) {
      const hs = [];
      const walk = n => { if (n.left) { hs.push(n.height); walk(n.left); walk(n.right); } };
      walk(root);
      hs.sort((a, b) => b - a);
      return ((hs[this.k - 2] ?? 0) + (hs[this.k - 1] ?? 0)) / 2;
    }

    pointOf(id) { return this._pointOf.get(id); }
    pointByKey(key) { return this.points.find(p => p.key === key); }

    /** 木の葉を上から順に並べたもの */
    leaves() {
      const out = [];
      const walk = n => { if (n.point) out.push(n.point); else { walk(n.left); walk(n.right); } };
      walk(this.tree);
      return out;
    }

    /** 距離の近い囲い（自分を除く）上位 n 件 */
    nearest(id, n = 3) {
      return this.castles.filter(c => c.id !== id)
        .map(c => ({ castle: c, d: this.dist(id, c.id) }))
        .sort((a, b) => a.d - b.d || 0)
        .slice(0, n);
    }

    /** 計算で同じグループに入った囲い（自分を除く） */
    groupMates(id) {
      const g = this.groupOf.get(id);
      return this.castles.filter(c => c.id !== id && this.groupOf.get(c.id) === g);
    }

    /** 囲いの計算上の近さと作者の系統の一致: { mates, same, dominant } */
    match(castle) {
      const mates = this.groupMates(castle.id);
      const same = mates.some(c => c.family === castle.family);
      const count = new Map();
      for (const c of mates) count.set(c.family, (count.get(c.family) || 0) + 1);
      const dominant = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { mates, same, dominant };
    }

    /** 系統の囲いのうち、同じ計算グループに最も多く入ったグループの人数 */
    familyTogether(familyId) {
      const members = this.castles.filter(c => c.family === familyId);
      const count = new Map();
      for (const c of members) count.set(this.groupOf.get(c.id), (count.get(this.groupOf.get(c.id)) || 0) + 1);
      return { total: members.length, together: Math.max(0, ...count.values()), groups: count.size };
    }
  }

  Kakoi.ClusterModel = ClusterModel;
})();
