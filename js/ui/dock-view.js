// 統合画面の左ドック（U4。constraint-rail-view.js の後継）: 上下2面の分割ペイン。
// 各面は独立して「相手／自分」×「戦法／囲い」を切り替え、先頭の小さな Segmented で
// その側の戦略（居飛車／振り飛車）を常時選べる（計画書 §4-2）。
// 計画書 S6 で分割: 面の器は dock-pane.js、中身の構築は dock-grids.js、
// バッジと「戦略に合わない項目」の判定は dock-badges.js、仕切りは dock-splitter.js。
// このファイルは状態（dock.split / dock.{opp,me}.{tab,open}）と面の更新を束ねる
//   - バッジ2軸（§3-1/U1）: 連動=preview で他層が変わる → ⇄。相手との相性=judge().vs → ◎/△
//   - ホバー/フォーカスで onPreview（制約バーの点滅・盤のマス表示は呼び出し側が描く）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { VS_MARK, findTactic } = K.lookup;
  const FIELD = K.constraints.FIELD;
  const castlePos = c => K.Position.fromCastle(c, K.SETUPS[c.setup]);

  class DockView {
    /**
     * @param {HTMLElement} el `#pickRail`（.view-pane.pane-fill。内部構造はこのクラスが作る）
     * @param {{ store:Kakoi.Store,
     *   onChoose:(who:'me'|'opp', kind:string, id:string)=>void,
     *   onRemoveSide:(who:string)=>void,
     *   onPreview?:(who:string, kind:string, id:string)=>void,
     *   onPreviewEnd?:()=>void }} handlers
     */
    constructor(el, h) {
      this.el = el;
      this.h = h;
      el.innerHTML =
        `<div class="dk" style="--dock-split:.5">` +
        // 凡例（U6）: ◎△⇄点線の読み方を開く小さな ? ボタンをドックの上端に置く
        `<div class="dk-top"><button type="button" class="dk-legend" aria-expanded="false" ` +
        `aria-label="記号の見方" title="記号の見方">?</button></div>` +
        K.dockPane.html('opp') +
        `<div class="dk-sep" role="separator" tabindex="0" aria-orientation="horizontal" ` +
        `aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" ` +
        `aria-label="上下の面の高さ（↑↓キーで調節・ダブルクリックで半分に戻す）"></div>` +
        K.dockPane.html('me') +
        `</div>`;
      this.root = el.firstElementChild;
      this.sep = this.root.querySelector('.dk-sep');
      this.tacticRows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      // ドックの居飛車の系統は 飛車→銀→角（・桂・歩）の順に並べる（周期表の行順とは別）
      const ibishaRank = { '飛': 0, '銀': 1, '角': 2 };
      this.tacticRows = [
        ...this.tacticRows.filter(r => r.family.side !== 'ibisha'),
        ...this.tacticRows.filter(r => r.family.side === 'ibisha')
          .sort((a, b) => (ibishaRank[a.family.piece] ?? 9) - (ibishaRank[b.family.piece] ?? 9)),
      ];

      // 囲いの局面は1回だけ組み立てる（F3: 切り出しは囲いごとに最大化するので共通倍率は持たない）
      this._pos = new Map();
      for (const c of K.CASTLES) this._pos.set(c.id, castlePos(c));

      const ctx = {
        store: this.h.store,
        setPane: (who, patch) => this._setPane(who, patch),
        onChoose: (who, kind, id) => this.h.onChoose(who, kind, id),
        onAddOpponent: () => this.h.onAddOpponent && this.h.onAddOpponent(),
      };
      this.panes = {
        opp: K.dockPane.init(this.root.querySelector('[data-who="opp"]'), 'opp', ctx),
        me: K.dockPane.init(this.root.querySelector('[data-who="me"]'), 'me', ctx),
      };
      this._bindEvents();
      K.dockSplitter.bind(this.sep, this.root, this.h.store);
      this._bindLegend();
    }

    // ---------- 凡例の ? ボタン（U6）: ◎△⇄点線の読み方をポップオーバーで出す ----------
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
          `<li><b>⇄</b>＋点線の枠：選ぶと他も連動して変わる</li>` +
          `<li><span class="lg-ex lg-imp">名称</span>点線の項目：既定値（自動で補った選択）</li>` +
          `</ul>`;
        this.root.appendChild(pop);
        btn.setAttribute('aria-expanded', 'true');
      });
      document.addEventListener('pointerdown', e => {
        if (pop && !e.target.closest('.dk-legend-pop') && !e.target.closest('.dk-legend')) close();
      });
    }

    _setPane(who, patch) {
      const d = this.h.store.state.dock;
      this.h.store.set({ dock: { ...d, [who]: { ...d[who], ...patch } } });
    }

    // ---------- イベント（委譲。面の作り直しをまたいで有効） ----------
    _bindEvents() {
      this.el.addEventListener('click', e => {
        const famH = e.target.closest('.dk-fam-h');
        if (famH) {   // 系統ブロックの折りたたみ（面ごとに保持・永続化しない）
          const sec = famH.closest('.dk-fam');
          const open = sec.dataset.closed === 'true';   // いま閉→これから開く
          sec.dataset.closed = open ? 'false' : 'true';
          famH.setAttribute('aria-expanded', String(open));
          return;
        }
        const clear = e.target.closest('[data-clear]');
        if (clear) { this.h.onRemoveSide(clear.dataset.clear); return; }
        const it = e.target.closest('.dk-item');
        if (it) this.h.onChoose(it.dataset.who, it.dataset.kind, it.dataset.id);
      });
      // ホバー予告（§3-3）: タイル・派生チップ・戦略ボタンに乗ると親へ知らせる。
      // 同じ候補の中を子要素またぎで動いても1回だけにする（S6: 連続発火を抑える）
      const candOf = t => t && t.closest ? t.closest('.dk-item, .dk-strategy button[data-id]') : null;
      let lastCand = null;
      const light = e => {
        const c = candOf(e.target);
        if (!c || !this.h.onPreview || c === lastCand) return;
        lastCand = c;
        const pane = c.closest('.dk-pane');
        const who = c.dataset.who || (pane && pane.dataset.who);
        if (who) this.h.onPreview(who, c.dataset.kind, c.dataset.id);
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

    // ---------- 面の中身（who×tab ごとに構築して保持。update では属性だけを書き換える） ----------
    _mount(pane, who, tab) {
      const key = `${who}:${tab}`;
      let v = pane.views[key];
      if (!v) {
        v = tab === 'tactic' ? K.dockGrids.tactics(this, who) : K.dockGrids.castles(this, who);
        pane.views[key] = v;
      }
      if (pane.body.firstElementChild !== v.el) pane.body.replaceChildren(v.el);
      pane.cur = v;
    }

    // ---------- 更新（属性の書き換えだけ。構造は who/tab が変わったときだけ作り直す） ----------
    /**
     * @param {object} state store.state（dock.split / dock.{opp,me}.{tab,open} を読む）
     * @param {{ me:object, opp:object|null }} S constraints.sides() の出力
     */
    update(state, S) {
      const dock = state.dock || {};
      const split = typeof dock.split === 'number' ? dock.split : .5;
      this.root.style.setProperty('--dock-split', split);
      this.sep.setAttribute('aria-valuenow', String(Math.round(split * 100)));
      this.sep.setAttribute('aria-valuetext', `上 ${Math.round(split * 100)}パーセント、下 ${Math.round(100 - split * 100)}パーセント`);
      const list = Array.isArray(state.constraints) ? state.constraints : [];
      for (const who of ['opp', 'me']) {
        const pane = this.panes[who];
        const cfg = dock[who] || {};
        const tab = cfg.tab === 'tactic' ? 'tactic' : 'castle';
        const empty = who === 'opp' && !S.opp;          // 相手がいない → 選択UIを出さない
        const open = !empty && cfg.open !== false;      // 畳む＝ヘッダだけ残す
        pane.el.dataset.tab = tab;
        pane.el.dataset.closed = open ? 'false' : 'true';
        pane.el.dataset.empty = empty ? 'true' : 'false';
        pane.fold.setAttribute('aria-expanded', open ? 'true' : 'false');
        pane.fold.disabled = empty;
        pane.clear.hidden = empty;
        if (pane.addopp) pane.addopp.hidden = !empty;
        // 脅威の帯スイッチ（相手の面）: 畳み・相手なしでは CSS で隠れる
        if (pane.threat) pane.threat.checked = state.showThreat !== false;
        if (open) {
          const ck = `${who}:${tab}`;
          if (pane.cfgKey !== ck) {
            pane.cfgKey = ck;
            pane.segTab.setValue(tab);
            this._mount(pane, who, tab);
          }
          this._updatePane(pane, S, list, who);
        }
      }
      // 仕切りは両面が開いている時だけ有効
      this.sep.hidden = !(this.panes.opp.el.dataset.closed === 'false' && this.panes.me.el.dataset.closed === 'false');
    }

    _updatePane(pane, S, list, who) {
      const st = S[who] || null;
      const eff = st || { strategy: null, tacticId: null, castleId: null };
      const B = K.dockBadges;

      // 候補の評価は constraints.evaluate に一本化（S3: preview→judge を共有 LRU で
      // 使い回す。土台は「候補を置いた後」の側＝その側が空でも候補から戦略が推論され、
      // 「駒が足りない」といった嘘の ng 理由が出ない）
      const evalOf = (kind, id) => K.constraints.evaluate(list, who, kind, id);

      // 戦略セグ（常時表示。選択肢にも2軸のバッジをつける）
      pane.segStrategy.setValue(st ? st.strategy : null);
      for (const b of pane.segStrategy.el.querySelectorAll('button')) {
        const id = b.dataset.value;
        const { pv, j } = evalOf('strategy', id);
        const cur = !!st && st.strategy === id;
        B.badge(b, pv.changed, j, cur && st.implied.strategy);
        const tip = B.tip(j, pv.changed);
        if (tip) b.title = tip; else b.removeAttribute('title');
      }

      // 分類は戦略（居飛車／振り飛車）だけ: 採用中の戦略に合わない項目は
      // 項目ごとに隠す（「もう一方」の領域は持たない。切替は面の戦略セグ）
      const curStrat = st && st.strategy;
      for (const it of pane.cur.items) {
        const { pv, j } = evalOf(it.kind, it.id);
        const cur = !!st && eff[FIELD[it.kind]] === it.id;
        it.el.setAttribute('aria-current', cur ? 'true' : 'false');
        it.el.hidden = !!curStrat && B.offItem(it, st);
        const implied = cur && st.implied[it.kind];
        B.badge(it.el, pv.changed, j, implied);
        // 連動は ⇄ の印だけ（要約は title と制約バーの点滅で示す。F4）
        if (it.csc) it.csc.textContent = pv.changed.length ? '⇄' : '';
        if (it.vs) it.vs.textContent = j.vs ? VS_MARK[j.vs.level] || '' : '';
        const tip = (implied ? '既定値。' : '') + B.tip(j, pv.changed);
        if (tip) it.el.title = tip; else it.el.removeAttribute('title');
      }

      // 選択中の派生を持つ親タイルを強調する（§4-3）。派生が畳まれていれば開く
      if (pane.cur.tiles) {
        const selVar = st && st.tacticId;
        const parentId = selVar && (K.TACTICS.find(t => t.id === selVar) || {}).variantOf;
        for (const t of pane.cur.tiles) {
          if (parentId && t.dataset.id === parentId) t.dataset.vsel = 'true';
          else delete t.dataset.vsel;
        }
        if (parentId && pane.cur.el.dataset.vars === 'off') {
          pane.cur.el.dataset.vars = 'on';
          const sw = pane.cur.el.querySelector('.dk-vshow input');
          if (sw) sw.checked = true;
        }
      }
      // 採用中の戦略に合わない項目だけの行・系統はまるごと隠す。
      // 系統名の件数は、いま表示している項目の数に合わせる
      if (pane.cur.rows) {
        for (const sec of pane.cur.rows) sec.hidden = !!curStrat && sec.dataset.side !== curStrat;
      }
      if (pane.cur.fams) {
        for (const sec of pane.cur.fams) {
          sec.hidden = !!curStrat && !sec._sides.has(curStrat);
          if (!sec.hidden) {
            const n = sec.querySelector('.n');
            if (n) n.textContent = sec.querySelectorAll('.dk-item:not([hidden])').length;
          }
        }
      }
      pane.roving.refresh();
    }

    // 制約チップを選んだときの連動（U5）: その側の面を開き、種類のタブへ切り替えて
    // 項目までスクロールする（フォーカスは奪わず、一瞬だけ輪郭を添える）
    reveal(who, kind) {
      const pane = this.panes[who];
      if (!pane) return;
      const st = K.constraints.sides(this.h.store.state.constraints)[who];
      const patch = { open: true };
      if (kind === 'tactic' || kind === 'castle') patch.tab = kind;
      this._setPane(who, patch);      // store.set → update → _mount まで同期的に走る
      requestAnimationFrame(() => {
        let t = null;
        if (kind === 'strategy') t = pane.el.querySelector('.dk-strategy');
        else {
          const id = st && st[FIELD[kind]];
          t = id && pane.body.querySelector(`.dk-item[data-id="${id}"]`);
          if (!t && id && kind === 'tactic') {   // 派生選択中は親タイルを示す
            const p = (findTactic(id) || {}).variantOf;
            if (p) t = pane.body.querySelector(`.dk-item[data-id="${p}"]`);
          }
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
