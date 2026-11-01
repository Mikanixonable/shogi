// 共有 LRU キャッシュ（計画書 S4）: get/set/delete/clear だけの小さな連想配列。
// Map の挿入順を利用し、get で末尾へ回し、上限を超えたら最古を捨てる。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class LRU {
    constructor(max = 256) { this.max = max; this.map = new Map(); }
    has(k) { return this.map.has(k); }
    get(k) {
      const v = this.map.get(k);
      if (v === undefined) return undefined;
      this.map.delete(k); this.map.set(k, v);
      return v;
    }
    set(k, v) {
      if (this.map.has(k)) this.map.delete(k);
      this.map.set(k, v);
      while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
      return v;
    }
    delete(k) { return this.map.delete(k); }
    clear() { this.map.clear(); }
    get size() { return this.map.size; }
  }

  // 共有 LRU を作る定型（compat・constraints・piece-rules のメモで使う）。
  // この関数が参照できる時点では lru.js の読み込み済みなので Map フォールバックは持たない
  const newLRU = n => new LRU(n);

  Kakoi.LRU = LRU;
  Kakoi.newLRU = newLRU;
  if (typeof module !== 'undefined' && module.exports) module.exports = LRU;
})();
