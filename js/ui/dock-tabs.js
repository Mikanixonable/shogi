// 狭い画面のドック切替（下端のタブ＋面の横スワイプ。計画書 B1 の「選ぶ／読む」の面替え）:
// 左ドック（選ぶ）と右ドック（読む）は一度に1枚だけ出し、見せる面は body[data-mtab] が持つ。
// 各タブのスクロール位置を記憶し、戻ったときは同じ位置に復帰する。
// 制約を選んだとき「読む」へ切り替えるのは constraint-mode.js の _revealDetail から。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const NARROW = '(max-width:979px)';
  const TABS = ['pick', 'read'];
  const SWIPE_MIN = 56;   // これより短い横の動きは切替にしない

  class DockTabs {
    /**
     * @param {HTMLElement|null} bar 下端のタブバー（.mtabs。button[data-tab] を持つ）
     * @param {{ rail:HTMLElement, detail:HTMLElement, stage:HTMLElement }} panels 切り替える面と盤
     */
    constructor(bar, panels) {
      if (!bar || !panels || !panels.rail || !panels.detail || !panels.stage) return;
      Object.assign(this, { bar, rail: panels.rail, detail: panels.detail, stage: panels.stage });
      this.mq = matchMedia(NARROW);
      this.cur = 'pick';
      this._y = {};   // タブごとのページスクロール位置
      document.body.dataset.mtab = this.cur;
      this._sync();
      for (const b of bar.querySelectorAll('button[data-tab]')) {
        b.addEventListener('click', () => this.show(b.dataset.tab, { dir: b.dataset.tab === 'read' ? 'l' : 'r' }));
      }
      // 面の横スワイプ（.cbar-x など横に流れる要素の上では効かせない）
      let sx = 0, sy = 0, off = true;
      const host = this.rail.parentElement;   // .app（盤・帯・両ドック・タブバーを含む）
      host.addEventListener('touchstart', e => {
        off = e.touches.length !== 1 || !this.mq.matches || this._xscroll(e.target);
        if (!off) { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }
      }, { passive: true });
      host.addEventListener('touchmove', e => { if (e.touches.length !== 1) off = true; }, { passive: true });
      host.addEventListener('touchend', e => {
        if (off || !this.mq.matches) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.3) {
          this.show(dx < 0 ? 'read' : 'pick', { dir: dx < 0 ? 'l' : 'r' });
        }
      }, { passive: true });
      // 滑り込みの向き（body[data-mdir]）はアニメが終わったら外す
      document.addEventListener('animationend', e => {
        if (/^mtab-in-/.test(e.animationName)) delete document.body.dataset.mdir;
      });
    }

    /**
     * 面を切り替える。
     * @param {'pick'|'read'} name 見せる面
     * @param {{dir?:'l'|'r', align?:'top'}} opts dir=滑り込みの向き、align:'top'=面の先頭を盤の下に合わせる
     */
    show(name, { dir, align } = {}) {
      if (!TABS.includes(name)) return;
      const prev = this.cur;
      // 表示中のタブをもう一度押す＝面の先頭へ戻る（モバイルの定石。M3）
      if (name === prev && align !== 'top') {
        if (this.mq.matches) this._scrollTo(this._dockTop());
        return;
      }
      if (this.mq.matches) this._y[prev] = window.scrollY;
      this.cur = name;
      document.body.dataset.mtab = name;
      if (dir) document.body.dataset.mdir = dir;
      this._sync();
      if (!this.mq.matches) return;
      const y = align === 'top' || this._y[name] == null ? this._dockTop() : this._y[name];
      this._scrollTo(y);
    }

    _scrollTo(y) {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({ top: Math.max(0, Math.min(y, max)), behavior: this._smooth() });
    }

    _sync() {
      for (const b of this.bar.querySelectorAll('button[data-tab]')) {
        b.setAttribute('aria-pressed', String(b.dataset.tab === this.cur));
      }
    }

    // 面の先頭が追従中の盤（横向き2列ではヘッダー）のすぐ下に来るスクロール位置
    _dockTop() {
      const panel = this.cur === 'read' ? this.detail : this.rail;
      const stage = this.stage.getBoundingClientRect();
      const base = stage.width < innerWidth * 0.6
        ? document.querySelector('header').getBoundingClientRect().bottom
        : stage.bottom;
      return window.scrollY + panel.getBoundingClientRect().top - base - 8;
    }

    _smooth() {
      return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    }

    // スワイプの起点が横スクロールできる要素の中なら切替にしない（制約チップの帯など）
    _xscroll(el) {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth - n.clientWidth > 4) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
      }
      return false;
    }
  }

  Kakoi.DockTabs = DockTabs;
})();
