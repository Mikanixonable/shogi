// データ窓口: 囲い・想定配置・出典への参照をここに集約し、ビューや局面はグローバルを読まない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class Repository {
    /** @param {{ CASTLES:object[], SETUPS:object, SOURCES:object, CASTLE_FAMILIES:object[], TACTICS?:object[], TACTIC_FAMILIES?:object[] }} data */
    constructor({ CASTLES, SETUPS, SOURCES, CASTLE_FAMILIES, TACTICS = [], TACTIC_FAMILIES = [] }) {
      this._castles = CASTLES;
      this._setups = SETUPS;
      this._sources = SOURCES;
      this._families = CASTLE_FAMILIES;
      this._familyById = new Map(CASTLE_FAMILIES.map(f => [f.id, f]));
      this._byId = new Map(CASTLES.map(c => [c.id, c]));
      this._tactics = TACTICS;
      this._tacticFamilies = TACTIC_FAMILIES;
      this._tacticById = new Map(TACTICS.map(t => [t.id, t]));
    }

    castles() { return this._castles; }
    has(id) { return this._byId.has(id); }
    byId(id) { return this._byId.get(id); }
    ofSide(side) { return this._castles.filter(c => c.side === side); }
    /** 発展の前後: from（発展元）と、この囲いを from に持つ囲いの一覧 */
    lineageOf(castle) {
      return { from: castle.from ? this._byId.get(castle.from) || null : null, to: this._castles.filter(c => c.from === castle.id) };
    }
    /** 戦型の囲いを、系統の順（families() の並び）→ データ順に並べて返す */
    ofSideByFamily(side) {
      const list = this.ofSide(side);
      return this._families.flatMap(f => list.filter(c => c.family === f.id));
    }
    families() { return this._families; }
    familyOf(castle) { return this._familyById.get(castle.family); }
    subtypeOf(castle) { return this.familyOf(castle)?.subtypes.find(s => s.id === castle.subtype) || null; }
    ofFamily(familyId) { return this._castles.filter(c => c.family === familyId); }
    setupOf(castle) { return this._setups[castle.setup]; }

    /** 発展の前後: from（発展元）と、この囲いを from に持つ囲いの一覧 */
    lineageOf(castle) {
      return { from: castle.from ? this._byId.get(castle.from) || null : null, to: this._castles.filter(c => c.from === castle.id) };
    }

    /** 囲いと想定配置の出典 */
    sourcesOf(castle) {
      return this._resolveSources([...(castle.sources || []), ...(this.setupOf(castle).sources || [])]);
    }

    /** 出典の参照を、同じ ref はまとめて（for は「・」で連結）解決して返す */
    _resolveSources(list) {
      const merged = new Map();
      for (const s of list) {
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

    // ===== 戦法 =====
    tactics() { return this._tactics; }
    tacticById(id) { return this._tacticById.get(id); }
    hasTactic(id) { return this._tacticById.has(id); }
    tacticFamilies() { return this._tacticFamilies; }
    /** 戦法だけの局面（囲いの合成なし。戦法タブが盤に出すもの） */
    tacticPositionOf(tactic) {
      return Kakoi.Position.fromPieces(tactic.pieces, { leadSquare: tactic.lead && tactic.lead.square, hand: tactic.hand });
    }
    /** 戦法の相性表（pairings）を返す。castle は囲いオブジェクト、sources は解決済みの出典 */
    pairingsOf(tactic) {
      return (tactic.pairings || [])
        .filter(p => p && this._byId.has(p.castle))
        .map(p => ({ castle: this._byId.get(p.castle), level: p.level, why: p.why, sources: this._resolveSources(p.sources || []) }));
    }
    /** 戦法と囲い（＋その想定配置）の出典を併記する。castle がなければ戦法だけ */
    tacticComboSourcesOf(tactic, castle) {
      const setup = castle && this.setupOf(castle);
      return this._resolveSources([
        ...(tactic.sources || []),
        ...(castle ? castle.sources || [] : []),
        ...(setup ? setup.sources || [] : []),
      ]);
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
