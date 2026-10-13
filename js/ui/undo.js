// 元に戻す履歴（計画書 U2）: store の外にあるコントローラ。制約リストの変化を
// 購読して {list, selected} を最大50件まで覚え、Ctrl/⌘+Z で戻し、
// Shift+Ctrl/⌘+Z でやり直す。履歴の適用で起きた変化は記録しない（_skip フラグ）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const MAX = 50;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  class UndoHistory {
    /** @param {Kakoi.Store} store */
    constructor(store) {
      this.store = store;
      this._u = [];
      this._r = [];
      this._skip = false;
      store.subscribe((state, changed, prev) => {
        if (!changed.has('constraints')) return;
        if (this._skip) { this._skip = false; return; }
        this._u.push({ list: prev.constraints, sel: prev.selected });
        if (this._u.length > MAX) this._u.shift();
        this._r.length = 0;
      });
      document.addEventListener('keydown', e => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
        const tag = e.target && e.target.tagName;
        if (/input|textarea|select/i.test(tag || '')) return;
        if (document.body.dataset.view !== 'board') return;
        e.preventDefault();
        if (e.shiftKey) this.redo(); else this.undo();
      });
    }

    get canUndo() { return this._u.length > 0; }
    get canRedo() { return this._r.length > 0; }

    undo() {
      const cur = { list: this.store.state.constraints, sel: this.store.state.selected };
      let s = null;
      while (this._u.length) {
        const t = this._u.pop();
        if (!eq(t.list, cur.list) || t.sel !== cur.sel) { s = t; break; }
      }
      if (!s) return false;
      this._r.push(cur);
      this._apply(s);
      return true;
    }

    redo() {
      const cur = { list: this.store.state.constraints, sel: this.store.state.selected };
      let s = null;
      while (this._r.length) {
        const t = this._r.pop();
        if (!eq(t.list, cur.list) || t.sel !== cur.sel) { s = t; break; }
      }
      if (!s) return false;
      this._u.push(cur);
      this._apply(s);
      return true;
    }

    _apply(s) {
      this._skip = true;
      this.store.set({ constraints: s.list, selected: s.sel });
    }
  }

  Kakoi.UndoHistory = UndoHistory;
})();
