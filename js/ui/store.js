// アプリの状態: 単一の状態オブジェクトと変更通知、ブラウザへの保存
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  class Store {
    /**
     * @param {object} initial 初期状態
     * @param {string[]} persistKeys localStorage に保存するキー
     * @param {string} namespace 保存時の接頭辞
     */
    constructor(initial, persistKeys, namespace) {
      this._ns = namespace;
      this._persist = persistKeys;
      this._subs = [];
      this.state = { ...initial, ...this._load() };
    }

    subscribe(fn) { this._subs.push(fn); }

    /** 差分を適用し、変わったキーの集合とともに購読者へ通知する */
    set(patch) {
      const changed = new Set(Object.keys(patch).filter(k => this.state[k] !== patch[k]));
      if (!changed.size) return;
      const prev = this.state;
      this.state = { ...prev, ...patch };
      this._save(changed);   // 変わったキーだけを書き出す（S6 の小さな修正）
      for (const fn of this._subs) fn(this.state, changed, prev);
    }

    _load() {
      const out = {};
      for (const k of this._persist) {
        try {
          const v = localStorage.getItem(`${this._ns}:${k}`);
          if (v !== null) out[k] = JSON.parse(v);
        } catch { /* 保存領域が使えない環境では既定値のまま */ }
      }
      return out;
    }

    /** @param {Set<string>|null} keys 変わったキー。null なら全部（初期の補完用） */
    _save(keys) {
      for (const k of this._persist) {
        if (keys && !keys.has(k)) continue;
        try { localStorage.setItem(`${this._ns}:${k}`, JSON.stringify(this.state[k])); } catch { /* 無視 */ }
      }
    }
  }

  Kakoi.Store = Store;
})();
