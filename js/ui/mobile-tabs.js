// 狭い画面の面の切替（下端のタブ＋面の横スワイプ。計画書 B1 の「選ぶ／読む」の面替え）:
// 左の rail（選ぶ）と右の detail（読む）は一度に1枚だけ出し、見せる面は body[data-mtab] が持つ。
//   - 横スワイプは指に追従して面を動かし、離したとき距離・速さで切替える。
//     横と決まるまでは縦の流れを邪魔せず、決まったら縦スクロールを止める（斜めスワイプ対策）。
//     端（選ぶで右・読むで左）へ引っ張るとゴム紐のように少しだけ動いて戻る。
//   - スワイプで切り替えたときはスクロール位置を動かさない（「スワイプ→勝手にスクロール」感を消す）。
//   - rail/detail 側へ下へ流れると盤を自動で畳み、下半分に縦幅を取る（上端へ戻れば展開。
//     盤の裾の帯で手動で畳んだ/出した場合は、上端へ戻るまでその指定を優先する）。
// 各タブのスクロール位置を記憶し、戻ったときは同じ位置に復帰する。
// 制約を選んだとき「読む」へ切り替えるのは screen/controller.js の _revealDetail から。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const NARROW = '(max-width:979px)';
  const TABS = ['pick', 'read'];
  const SWIPE_PX = 72;    // この距離を超えれば切替
  const FLICK_V = 0.4;    // px/ms: 短い flick でもこの速さなら切替
  const LOCK = 12;        // 方向を決める最小のずれ（これ未満は判断しない）

  class MobileTabs {
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
      this._bindSwipe();
      this._bindFold();
      // 滑り込みの向き（body[data-mdir]）はアニメが終わったら外す
      document.addEventListener('animationend', e => {
        if (/^mtab-in-/.test(e.animationName)) delete document.body.dataset.mdir;
      });
    }

    // いま見えている面（指で掴む対象）
    _panel() { return this.cur === 'read' ? this.detail : this.rail; }

    /**
     * 面を切り替える。
     * @param {'pick'|'read'} name 見せる面
     * @param {{dir?:'l'|'r', align?:'top', via?:'swipe'}} opts
     *   dir=滑り込みの向き、align:'top'=面の先頭を盤の下に合わせる、via:'swipe'=スクロールしない
     */
    show(name, { dir, align, via } = {}) {
      if (!TABS.includes(name)) return;
      const prev = this.cur;
      // 表示中のタブをもう一度押す＝面の先頭へ戻る（モバイルの定石。M3）
      if (name === prev && align !== 'top') {
        if (this.mq.matches) this._scrollTo(this._panelTop());
        return;
      }
      if (this.mq.matches) this._y[prev] = window.scrollY;
      this.cur = name;
      document.body.dataset.mtab = name;
      if (dir) document.body.dataset.mdir = dir;
      this._sync();
      // 指で面を送った切替では位置はそのまま（パネルが入れ替わるだけ）。
      // タブ・制約チップからの切替は面の先頭を盤の下へ運ぶ
      if (!this.mq.matches || via === 'swipe') return;
      const y = align === 'top' || this._y[name] == null ? this._panelTop() : this._y[name];
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
    _panelTop() {
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

    // ---------- 面の横スワイプ ----------
    // .app 全体で拾う（盤・制約フィールドの上でも効く）。横に流れる要素（_xscroll）の上では効かせない
    _bindSwipe() {
      const host = this.rail.parentElement;
      let g = null;   // {sx, sy, lock, trace, dx, next, edge}
      host.addEventListener('touchstart', e => {
        if (e.touches.length !== 1 || !this.mq.matches || this._xscroll(e.target)) { g = null; return; }
        const t = e.touches[0];
        g = { sx: t.clientX, sy: t.clientY, lock: null, dx: 0, trace: [[e.timeStamp, t.clientX]] };
      }, { passive: true });
      host.addEventListener('touchmove', e => {
        if (!g) return;
        if (e.touches.length !== 1) { this._snapBack(g); g = null; return; }
        const t = e.touches[0], dx = t.clientX - g.sx, dy = t.clientY - g.sy;
        if (!g.lock) {
          const ax = Math.abs(dx), ay = Math.abs(dy);
          if (ax >= LOCK && ax > ay * 1.4) g.lock = 'x';           // 横と決定
          else if (ay >= LOCK) { g = null; return; }               // 縦の流れ＝この指は面を掴んでいない
          else return;
        }
        e.preventDefault();   // 横スワイプ中は縦スクロールを止める
        g.trace.push([e.timeStamp, t.clientX]);
        if (g.trace.length > 6) g.trace.shift();
        g.dx = dx;
        g.next = dx < 0 ? 'read' : 'pick';
        g.edge = g.next === this.cur;                 // もう面がない側への引っ張り
        this._panel().style.transform = `translateX(${dx * (g.edge ? 0.26 : 1)}px)`;
      }, { passive: false });
      host.addEventListener('touchend', () => {
        if (!g) return;
        const drag = g.lock === 'x' ? g : null;
        g = null;
        if (!drag) { this._clearDrag(); return; }
        const p = this._panel();
        const dx = drag.dx;
        let v = 0;                                   // 離す直前の速さ（px/ms）
        const tr = drag.trace;
        if (tr.length > 1) {
          const [t0, x0] = tr[0], [t1, x1] = tr[tr.length - 1];
          v = (x1 - x0) / Math.max(1, t1 - t0);
        }
        const flick = Math.abs(v) >= FLICK_V && Math.sign(v) === Math.sign(dx) && Math.abs(dx) >= 20;
        if (!drag.edge && (Math.abs(dx) >= SWIPE_PX || flick)) {
          // 確定: 送った向きの面へ。そのまま置き換える（スクロールはしない）
          p.style.transform = '';
          this.show(drag.next, { dir: dx < 0 ? 'l' : 'r', via: 'swipe' });
        } else this._snapBack(drag);
      });
      host.addEventListener('touchcancel', () => { if (g) { this._snapBack(g); g = null; } });
    }

    // 離した場所からバネで中央へ戻す（確定しなかった横引っ張りの終了処理）
    _snapBack(drag) {
      const p = this._panel();
      const dx = drag && drag.lock === 'x' ? drag.dx * (drag.edge ? 0.26 : 1) : 0;
      if (!dx) { p.style.transform = ''; return; }
      const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const slide = p.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
        { duration: rm ? 1 : 240, easing: 'cubic-bezier(.25,.8,.3,1.15)', fill: 'both' });
      p.style.transform = '';
      slide.finished.then(() => slide.cancel(), () => slide.cancel());
    }

    _clearDrag() {
      this.rail.style.transform = '';
      this.detail.style.transform = '';
    }

    // ---------- 盤の収納（狭い画面） ----------
    // 盤の裾の帯（#boardToggle）で手動開閉＋面のほうへ下へ流れたときの自動畳み。
    // body[data-board-collapsed] が実際の表示状態（layout.css が盤の行を畳む）
    _bindFold() {
      const btn = document.getElementById('boardToggle');
      if (!btn) return;
      const set = on => { document.body.dataset.boardCollapsed = on ? 'true' : ''; };
      const is = () => document.body.dataset.boardCollapsed === 'true';
      const sync = () => {
        const collapsed = is();
        btn.setAttribute('aria-expanded', String(!collapsed));
        btn.setAttribute('aria-label', collapsed ? '盤を出す' : '盤を収納する');
      };
      let manual = null;   // 'closed'|'open': 帯で明示した状態。上端へ戻るまで自動に優先する
      btn.addEventListener('click', () => { set(!is()); manual = is() ? 'closed' : 'open'; });
      new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-board-collapsed'] });
      sync();
      let lastY = window.scrollY;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (!this.mq.matches) { lastY = y; return; }
        if (y <= 8) {                                        // 上端: 自動畳みは戻し、手動指定も切る
          if (is() && manual !== 'closed') set(false);
          manual = null;
        } else if (y > 90 && y - lastY > 3 && !is() && manual !== 'open') {
          set(true);                                         // 面のほうへ流れる: 盤を畳んで縦幅を空ける
        }
        lastY = y;
      }, { passive: true });
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

  Kakoi.MobileTabs = MobileTabs;
})();
