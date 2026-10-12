// データ窓口: 囲い・想定配置・出典への参照をここに集約し、ビューや局面はグローバルを読まない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class Repository {
    /** @param {{ CASTLES:object[], SETUPS:object, SOURCES:object }} data */
    constructor({ CASTLES, SETUPS, SOURCES }) {
      this._castles = CASTLES;
      this._setups = SETUPS;
      this._sources = SOURCES;
      this._byId = new Map(CASTLES.map(c => [c.id, c]));
    }

    castles() { return this._castles; }
    has(id) { return this._byId.has(id); }
    byId(id) { return this._byId.get(id); }
    ofSide(side) { return this._castles.filter(c => c.side === side); }
    first(side) { return this.ofSide(side)[0]; }
    setupOf(castle) { return this._setups[castle.setup]; }

    /** 囲いと想定配置の出典を、同じ ref はまとめて（for は「・」で連結）解決して返す */
    sourcesOf(castle) {
      const merged = new Map();
      for (const s of [...(castle.sources || []), ...(this.setupOf(castle).sources || [])]) {
        const src = this._sources[s.ref];
        if (!src) continue;
        const prev = merged.get(s.ref);
        if (!prev) merged.set(s.ref, { ref: s.ref, labels: [s.for], src });
        else if (!prev.labels.includes(s.for)) prev.labels.push(s.for);
      }
      return [...merged.values()].map(({ ref, labels, src }) => ({
        ref, for: labels.join('・'), title: src.title, publisher: src.publisher, url: src.url,
      }));
    }

    attackOf(castle, attackId) {
      return castle.attacks?.find(a => a.id === attackId) || null;
    }

    positionOf(castle, attackId = null) {
      return Kakoi.Position.fromCastle(castle, this.setupOf(castle), this.attackOf(castle, attackId));
    }
  }

  Kakoi.Repository = Repository;
})();
