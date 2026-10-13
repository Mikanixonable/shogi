// 統合画面の左ドック: 「自分／相手」のタブで切り替える1枚の面（相手を表示していないときは
// 「相手」タブを無効にする）。面は「戦法／囲い」のタブ・はずす・戦略の絞り込み・一覧からなる。
// 戦略（居飛車／振り飛車）の絞り込みは一覧の表示を絞るだけで制約にはならない
// （戦略は選んだ戦法から導く）。見ている側・層は state.selected が持つ。
// 計画書 S6 で分割: 一覧の中身の構築は dock-grids.js、
// バッジと「戦略に合わない項目」の判定は dock-badges.js。
//   - バッジ2軸（§3-1/U1）: 両立=compat.judge の ng → ✕。相手との相性=judge().vs → ◎/△
//   - ホバー/フォーカスで onPreview（盤のマス表示は呼び出し側が描く）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { VS_MARK, findTactic, KINDS, FIELD } = K.lookup;
  const { esc } = K.html;
  const STRATEGY_IDS = ['ibisha', 'furibisha'];
  const castlePos = c => K.Position.fromCastle(c, K.SETUPS[c.setup]);

  class DockView {
    /**
     * @param {HTMLElement} el `#pickRail`（内部構造はこのクラスが作る）
     * @param {{ onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onChoose:(who:'me'|'opp', kind:string, id:string)=>void,
     *   onClear:(who:string)=>void,
     *   onPreview?:(who:string, kind:string, id:string)=>void,
     *   onPreviewEnd?:()=>void }} handlers
     *   onSelect: 側・層のタブを切り替えたとき（selected を動かす）
     */
    constructor(el, h) {
      this.el = el;
      this.h = h;
      this.who = 'me';
      this.kind = 'castle';
      this.filter = { me: 'ibisha', opp: 'ibisha' };   // 戦略の絞り込み（側ごと。表示だけの状態）
      this._strat = { me: null, opp: null };           // 絞り込みを最後に合わせた、導出した戦略
      this._last = null;
      el.innerHTML =
        `<div class="dk">` +
        `<div class="dk-top">` +
        `<div class="seg dk-who" role="group" aria-label="側の切り替え">` +
        `<button type="button" data-value="me">自分 ▲</button>` +
        `<button type="button" data-value="opp">相手 △</button></div>` +
        // 凡例（U6）: ✕◎△点線の読み方を開く小さな ? ボタン
        `<button type="button" class="dk-legend" aria-expanded="false" ` +
        `aria-label="記号の見方" title="記号の見方">?</button></div>` +
        `<section class="dk-pane">` +
        `<header class="dk-pane-h">` +
        `<div class="seg dk-tab" role="group" aria-label="一覧（戦法／囲い）">` +
        `<button type="button" data-value="tactic">戦法</button>` +
        `<button type="button" data-value="castle">囲い</button></div>` +
        `<button type="button" class="dk-clear" title="この側の戦法と囲いをはずす">はずす</button></header>` +
        `<div class="seg small wide dk-strategy" role="group" aria-label="戦略で絞り込む">` +
        STRATEGY_IDS.map(id => `<button type="button" data-value="${id}">${esc(K.STRATEGIES[id].label)}</button>`).join('') +
        `</div>` +
        `<div class="dk-body" tabindex="0" role="region" aria-label="一覧"></div>` +
        `</section></div>`;
      this.root = el.firstElementChild;
      this.body = this.root.querySelector('.dk-body');
      this.oppBtn = this.root.querySelector('.dk-who [data-value="opp"]');
      this.clearBtn = this.root.querySelector('.dk-clear');
      this.whoSeg = new K.Segmented(this.root.querySelector('.dk-who'), v => h.onSelect(v, this.kind));
      this.tabSeg = new K.Segmented(this.root.querySelector('.dk-tab'), v => h.onSelect(this.who, v));
      this.stratSeg = new K.Segmented(this.root.querySelector('.dk-strategy'), v => {
        this.filter[this.who] = v;
        if (this._last) this.update(this._last.state, this._last.S);
      });
      this.clearBtn.addEventListener('click', () => h.onClear(this.who));
      // タイル・チップは roving tabindex（U3）。矢印でフォーカスを移し Enter で選ぶ
      this.roving = K.roving.attach(this.body, '.dk-item');
      this.views = {};   // `${who}:${kind}` → 一覧の中身（構築は1回だけ。update では属性だけを書き換える）
      this.tacticRows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      // ドックの居飛車の系統は 飛車→銀→角（・桂・歩）の順に並べる
      const ibishaRank = { '飛': 0, '銀': 1, '角': 2 };
      this.tacticRows = [
        ...this.tacticRows.filter(r => r.family.side !== 'ibisha'),
        ...this.tacticRows.filter(r => r.family.side === 'ibisha')
          .sort((a, b) => (ibishaRank[a.family.piece] ?? 9) - (ibishaRank[b.family.piece] ?? 9)),
      ];
      // 囲いの局面は1回だけ組み立てる（F3: 切り出しは囲いごとに最大化するので共通倍率は持たない）
      this._pos = new Map();
      for (const c of K.CASTLES) this._pos.set(c.id, castlePos(c));
      this._bindEvents();
      this._bindLegend();
    }

    // ---------- 凡例の ? ボタン（U6）: ✕◎△点線の読み方をポップオーバーで出す ----------
    _bindLegend() {
      const btn = this.root.querySelector('.dk-legend');
      let pop = null;
      const close = () => {
        if (pop) { pop.remove(); pop = null; }
        btn.setAttribute('aria-expanded', 'false');
      };
      btn.addEventListener('click', () => {
        if (pop) { close(); return; }
        pop = document.createElement('div');
        pop.className = 'dk-legend-pop';
        pop.setAttribute('role', 'note');
        pop.innerHTML =
          `<b>記号の見方</b><ul>` +
          `<li><span class="lg-ex lg-sel">名称</span>選択中（朱の下線）</li>` +
          `<li><b>◎</b>相手との相性がよい／<b>△</b>苦手</li>` +
          `<li><b>✕</b>＋点線の枠：いまの組み合わせとは両立しない</li>` +
          `<li><span class="lg-ex lg-imp">名称</span>点線の項目：既定値（未選択のため補った値）</li>` +
          `</ul>`;
        this.root.appendChild(pop);
        btn.setAttribute('aria-expanded', 'true');
      });
      document.addEventListener('pointerdown', e => {
        if (pop && !e.target.closest('.dk-legend-pop') && !e.target.closest('.dk-legend')) close();
      });
    }

    // ---------- イベント（委譲。一覧の作り直しをまたいで有効） ----------
    _bindEvents() {
      this.el.addEventListener('click', e => {
        const famH = e.target.closest('.dk-fam-h');
        if (famH) {   // 系統ブロックの折りたたみ（一覧ごとに保持・永続化しない）
          const sec = famH.closest('.dk-fam');
          const open = sec.dataset.closed === 'true';   // いま閉→これから開く
          sec.dataset.closed = open ? 'false' : 'true';
          famH.setAttribute('aria-expanded', String(open));
          return;
        }
        const it = e.target.closest('.dk-item');
        if (it) this.h.onChoose(it.dataset.who, it.dataset.kind, it.dataset.id);
      });
      // ホバー予告（§3-3）: タイル・派生チップに乗ると親へ知らせる。
      // 同じ候補の中を子要素またぎで動いても1回だけにする（S6: 連続発火を抑える）
      const candOf = t => t && t.closest ? t.closest('.dk-item') : null;
      let lastCand = null;
      const light = e => {
        const c = candOf(e.target);
        if (!c || !this.h.onPreview || c === lastCand) return;
        lastCand = c;
        this.h.onPreview(c.dataset.who, c.dataset.kind, c.dataset.id);
      };
      const unlight = e => {
        const c = candOf(e.target);
        if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) {
          if (c === lastCand) lastCand = null;
          if (this.h.onPreviewEnd) this.h.onPreviewEnd();
        }
      };
      this.el.addEventListener('mouseover', light);
      this.el.addEventListener('focusin', light);
      this.el.addEventListener('mouseout', unlight);
      this.el.addEventListener('focusout', unlight);
    }

    // ---------- 一覧の中身（who×kind ごとに構築して保持） ----------
    _mount(who, kind) {
      const key = `${who}:${kind}`;
      let v = this.views[key];
      if (!v) {
        v = kind === 'tactic' ? K.dockGrids.tactics(this, who) : K.dockGrids.castles(this, who);
        this.views[key] = v;
      }
      if (this.body.firstElementChild !== v.el) this.body.replaceChildren(v.el);
      this.cur = v;
    }

    // ---------- 更新（属性の書き換えだけ。構造は who/kind が変わったときだけ作り直す） ----------
    /**
     * @param {object} state store.state（selected / slots / showOpp を読む）
     * @param {{ me:object, opp:object }} S constraints.sides() の出力
     */
    update(state, S) {
      this._last = { state, S };
      const sel = K.constraints.parseSel(state.selected) || { who: 'me', kind: 'castle' };
      const showOpp = !!state.showOpp;
      const who = sel.who === 'opp' && !showOpp ? 'me' : sel.who;
      const kind = KINDS.includes(sel.kind) ? sel.kind : 'castle';
      this.who = who; this.kind = kind;
      this.root.dataset.who = who;
      this.whoSeg.setValue(who);
      this.oppBtn.disabled = !showOpp;
      this.oppBtn.title = showOpp ? '' : '相手の表示が OFF です（相手の帯の「表示」で出す）';
      this.tabSeg.setValue(kind);
      const side = state.slots[who];
      this.clearBtn.hidden = KINDS.every(k => side[k] == null);

      // 絞り込みは、導出した戦略が変わったとき（戦法を選んだ・ハッシュで開いた）にそれへ合わせる
      const st = S[who];
      if (this._strat[who] !== st.strategy) { this._strat[who] = st.strategy; this.filter[who] = st.strategy; }
      this.stratSeg.setValue(this.filter[who]);
      this._mount(who, kind);
      this._updatePane(state, S, who, showOpp);
    }

    _updatePane(state, S, who, showOpp) {
      const st = S[who];
      const strat = this.filter[who];
      const B = K.dockBadges;
      const v = this.cur;

      // 候補の評価は constraints.evaluate に一本化（S3: 共有 LRU で使い回す。土台は
      // 「候補を置いた後」の側＝その側が空でも候補から戦略が導かれ、
      // 「駒が足りない」といった嘘の ng 理由が出ない）
      for (const it of v.items) {
        const { j } = K.constraints.evaluate(state.slots, showOpp, who, it.kind, it.id);
        const cur = st[FIELD[it.kind]] === it.id;
        it.el.setAttribute('aria-current', cur ? 'true' : 'false');
        it.el.hidden = B.offItem(it, strat);
        const implied = cur && st.implied[it.kind];
        B.badge(it.el, j, implied);
        if (it.ng) it.ng.textContent = j.level === 'ng' ? '✕' : '';
        if (it.vs) it.vs.textContent = j.vs ? VS_MARK[j.vs.level] || '' : '';
        const tip = (implied ? '既定値。' : '') + B.tip(j);
        if (tip) it.el.title = tip; else it.el.removeAttribute('title');
      }

      // 選択中の派生を持つ親タイルを強調する（§4-3）。派生が畳まれていれば開く
      if (v.tiles) {
        const selVar = st.tacticId;
        const parentId = selVar && (K.TACTICS.find(t => t.id === selVar) || {}).variantOf;
        for (const t of v.tiles) {
          if (parentId && t.dataset.id === parentId) t.dataset.vsel = 'true';
          else delete t.dataset.vsel;
        }
        if (parentId && v.el.dataset.vars === 'off') {
          v.el.dataset.vars = 'on';
          const sw = v.el.querySelector('.dk-vshow input');
          if (sw) sw.checked = true;
        }
      }
      // 絞り込んだ戦略に合わない項目だけの行・系統はまるごと隠す。
      // 系統名の件数は、いま表示している項目の数に合わせる
      if (v.rows) for (const sec of v.rows) sec.hidden = sec.dataset.side !== strat;
      if (v.fams) {
        for (const sec of v.fams) {
          sec.hidden = !sec._sides.has(strat);
          if (!sec.hidden) {
            const n = sec.querySelector('.n');
            if (n) n.textContent = sec.querySelectorAll('.dk-item:not([hidden])').length;
          }
        }
      }
      this.roving.refresh();
    }

    // 制約チップを選んだときの連動（U5）: 種類のタブへ切り替わった一覧で、その側の実効値 st の
    // 項目までスクロールする（フォーカスは奪わず、一瞬だけ輪郭を添える）
    reveal(kind, st) {
      requestAnimationFrame(() => {
        const id = st && st[FIELD[kind]];
        let t = id && this.body.querySelector(`.dk-item[data-id="${id}"]`);
        if (!t && id && kind === 'tactic') {   // 派生選択中は親タイルを示す
          const p = (findTactic(id) || {}).variantOf;
          if (p) t = this.body.querySelector(`.dk-item[data-id="${p}"]`);
        }
        if (!t || !t.scrollIntoView) return;
        t.scrollIntoView({
          block: 'nearest',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        if (t.dataset) { t.dataset.reveal = 'true'; setTimeout(() => { delete t.dataset.reveal; }, 1200); }
      });
    }
  }

  K.DockView = DockView;
})();
