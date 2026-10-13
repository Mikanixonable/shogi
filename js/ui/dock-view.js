// 統合画面の左ドック: 「自分／相手」で切り替える1枚の面。
// 側の切り替えはドックの右端（盤との境）に立てた駒の見出し（バインダー）で行う。
// 盤と同じく上=相手（先が下の駒）・下=自分（先が上の駒）。相手の見出しで相手の表示を ON にでき、
// 角の × で OFF にする。面は囲い／戦法・リセット・絞り込み・一覧からなる。
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
  // 一覧の並べ方は表示の好み（盤面の状態ではない）なのでここで localStorage に持つ
  const PREF = 'shogi-castle:dock';
  const loadPref = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch { return {}; } };
  // 上部の操作の小物: 層タブのアイコン・戦略の丸印・並べ方のアイコン
  const TAB_ICON = {
    castle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l3 2V6l5 3 5-3v5l3-2v11z"/></svg>',
    tactic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L20 4M13 4h7v7"/></svg>',
  };
  const STRAT_MARK = { ibisha: '居', furibisha: '振' };
  const SORT_ICON = { family: '▦', tree: '⑂', hard: '★', top: '↑', side: '↔' };

  class DockView {
    /**
     * @param {HTMLElement} el `#pickRail`（内部構造はこのクラスが作る）
     * @param {{ onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onChoose:(who:'me'|'opp', kind:string, id:string)=>void,
     *   onClear:(who:string)=>void,
     *   onToggleOpponent:(on:boolean)=>void,
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
      const pref = loadPref();
      this.sort = K.dockGrids.CASTLE_SORTS.some(x => x.id === pref.sort) ? pref.sort : 'family';
      el.innerHTML =
        `<div class="dk">` +
        `<div class="dk-top">` +
        `<div class="dk-title"><b></b><small></small></div>` +
        // 凡例（U6）: ✕◎△点線の読み方を開く小さな ? ボタン
        `<button type="button" class="dk-legend" aria-expanded="false" ` +
        `aria-label="記号の見方" title="記号の見方">?</button></div>` +
        `<section class="dk-pane">` +
        `<header class="dk-pane-h">` +
        // 層: 塗りの大きな2択（アイコン付き）
        `<div class="seg dk-tab" role="group" aria-label="一覧（囲い／戦法）">` +
        `<button type="button" data-value="castle">${TAB_ICON.castle}囲い</button>` +
        `<button type="button" data-value="tactic">${TAB_ICON.tactic}戦法</button></div></header>` +
        `<div class="dk-filter-row">` +
        // 戦略: 「居／振」の丸印を添えた朱のピル
        `<div class="seg dk-strategy" role="group" aria-label="戦略で絞り込む">` +
        STRATEGY_IDS.map(id => `<button type="button" data-value="${id}"><b aria-hidden="true">${STRAT_MARK[id]}</b>` +
          `${esc(K.STRATEGIES[id].label)}</button>`).join('') +
        `</div>` +
        // 並べ方（囲いのみ）: 戦略ピルの横にアイコンを並べ、開かずに選べるようにする
        `<div class="dk-tools"><div class="seg dk-sort-seg" role="group" aria-label="囲いの並べ方">` +
        K.dockGrids.CASTLE_SORTS.map(x => `<button type="button" data-value="${x.id}" aria-label="${esc(x.label)}" title="${esc(x.label)}"` +
          `${x.axis ? ' class="ax"' : ''}>${SORT_ICON[x.id] || x.label}</button>`).join('') +
        `</div></div>` +
        `</div>` +
        `<div class="dk-body" tabindex="0" role="region" aria-label="一覧"></div>` +
        `</section></div>` +
        // 駒の見出し（バインダー）: 上=相手・下=自分。相手の駒の角の × で相手の表示を OFF にする
        `<div class="dk-binder" role="tablist" aria-orientation="vertical" aria-label="自分／相手">` +
        `<span class="dk-pc-ghost" aria-hidden="true"></span>` +
        `<button type="button" role="tab" class="dk-pc" data-who="opp"><span class="body" aria-hidden="true"></span>` +
        `<span class="v"><b>相手</b><small>後手 △</small></span></button>` +
        `<button type="button" class="dk-pc-x" aria-label="相手の表示を OFF にする" title="相手を盤から下げる（表示 OFF）">×</button>` +
        `<button type="button" role="tab" class="dk-pc" data-who="me"><span class="body" aria-hidden="true"></span>` +
        `<span class="v"><b>自分</b><small>先手 ▲</small></span></button>` +
        `</div>`;
      this.root = el.firstElementChild;
      this.body = this.root.querySelector('.dk-body');
      this.title = this.root.querySelector('.dk-title');
      this.binder = el.querySelector('.dk-binder');
      this.pcs = { me: this.binder.querySelector('[data-who="me"]'), opp: this.binder.querySelector('[data-who="opp"]') };
      this.oppOffBtn = this.binder.querySelector('.dk-pc-x');
      this.clearBtn = document.createElement('button');
      this.clearBtn.type = 'button';
      this.clearBtn.className = 'dk-clear';
      this.clearBtn.textContent = 'リセット';
      this._bindBinder();
      this.tabSeg = new K.Segmented(this.root.querySelector('.dk-tab'), v => h.onSelect(this.who, v));
      this.stratSeg = new K.Segmented(this.root.querySelector('.dk-strategy'), v => {
        this.filter[this.who] = v;
        if (this._last) this.update(this._last.state, this._last.S);
      });
      this.clearBtn.addEventListener('click', () => h.onClear(this.who));
      this.sortWrap = this.root.querySelector('.dk-tools');
      const savePref = () => {
        try { localStorage.setItem(PREF, JSON.stringify({ sort: this.sort })); } catch { /* 無視 */ }
        if (this._last) this.update(this._last.state, this._last.S);
      };
      this.sortSeg = new K.Segmented(this.root.querySelector('.dk-sort-seg'), v => {
        this.sort = v;
        this.sortSeg.setValue(v);
        savePref();
      });
      this.sortSeg.setValue(this.sort);
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

    // ---------- 駒の見出し: 押すとその側の面へ（相手が OFF なら表示して開く）。縦のタブなので ↑=相手・↓=自分 ----------
    _bindBinder() {
      this.binder.addEventListener('click', e => {
        if (e.target.closest('.dk-pc-x')) { this.h.onToggleOpponent(false); return; }
        const pc = e.target.closest('.dk-pc');
        if (pc) this.h.onSelect(pc.dataset.who, this.kind);
      });
      this.binder.addEventListener('keydown', e => {
        if (!e.target.closest('.dk-pc') || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        const who = e.key === 'ArrowUp' ? 'opp' : 'me';
        this.h.onSelect(who, this.kind);
        this.pcs[who].focus();
      });
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
          `<li><span class="lg-ex lg-sel">名称</span>選択中（朱の枠と ✓）</li>` +
          `<li><span class="lg-badge lg-good">◎</span>相手との相性がよい／<span class="lg-badge lg-bad">△</span>苦手</li>` +
          `<li><span class="lg-badge lg-ng">✕</span>＋点線の枠：いまの組み合わせとは両立しない</li>` +
          `<li><span class="lg-ex lg-fam">名称</span>左の帯・下線の色：系統（戦法は主役の駒）</li>` +
          `<li><span class="lg-ex lg-imp">名称</span>点線の項目：既定値（未選択のため補った値）</li>` +
          `<li><span class="lg-ex">↳ 名称</span>派生の戦法</li>` +
          `<li><span class="lg-ex lg-basic">名称</span>朱の印：基本の形</li>` +
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
      const key = kind === 'castle' ? `${who}:${kind}:${this.sort}` : `${who}:${kind}`;
      let v = this.views[key];
      if (!v) {
        v = kind === 'tactic' ? K.dockGrids.tactics(this, who) : K.dockGrids.castles(this, who, this.sort);
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
      this.el.dataset.who = who;
      this.title.firstChild.textContent = who === 'opp' ? '相手' : '自分';
      this.title.lastChild.textContent = who === 'opp' ? '後手 △' : '先手 ▲';
      this.binder.dataset.show = String(showOpp);
      for (const w of ['me', 'opp']) {
        this.pcs[w].setAttribute('aria-selected', String(w === who));
        this.pcs[w].tabIndex = w === who ? 0 : -1;   // roving: Tab で入るのは開いている側だけ
      }
      this.pcs.opp.querySelector('b').textContent = showOpp ? '相手' : '＋相手';
      this.pcs.opp.title = showOpp ? '相手の面を開く' : '相手を盤に表示して開く';
      this.oppOffBtn.hidden = !showOpp;
      this.tabSeg.setValue(kind);
      this.sortWrap.hidden = kind !== 'castle';   // 戦法は筋の表のまま（並べ方は囲いだけ）
      const side = state.slots[who];
      const clearHost = document.querySelector(`#stageMain .sideband[data-side="${who}"] .cbar`);
      if (clearHost && this.clearBtn.parentElement !== clearHost) clearHost.append(this.clearBtn);
      this.clearBtn.hidden = KINDS.every(k => side[k] == null);
      this.clearBtn.title = `${who === 'opp' ? '相手' : '自分'}の戦法・囲いをリセット`;
      this.clearBtn.setAttribute('aria-label', this.clearBtn.title);

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

      // 選択中の派生を持つ親タイルを強調する（§4-3）
      if (v.tiles) {
        const selVar = st.tacticId;
        const parentId = selVar && (K.TACTICS.find(t => t.id === selVar) || {}).variantOf;
        for (const t of v.tiles) {
          if (parentId && t.dataset.id === parentId) t.dataset.vsel = 'true';
          else delete t.dataset.vsel;
        }
      }
      // 絞り込んだ戦略に合わない項目だけの行・系統はまるごと隠す。
      // 系統名の件数は、いま表示している項目の数に合わせる
      if (v.rows) for (const sec of v.rows) sec.hidden = sec.dataset.side !== strat;
      if (v.fams) {
        for (const sec of v.fams) {
          sec.hidden = !sec._sides.has(strat);
          if (!sec.hidden) {
            const el = sec.querySelector('.n');
            if (el) el.textContent = sec.querySelectorAll('.dk-item:not([hidden])').length;
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
