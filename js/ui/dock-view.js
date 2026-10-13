// 統合画面の左ドック（U4。constraint-rail-view.js の後継）: 上下2面の分割ペイン。
// 各面は独立して「相手／自分」×「戦法／囲い」を切り替え、先頭の小さな Segmented で
// その側の戦略（居飛車／振り飛車）を常時選べる（計画書 §4-2）。
//   - 戦法タイル: 行=主役の駒の系統、列=筋（自分は 9→1、相手は盤の絶対座標で反転）。
//     1マス=主役の駒の最終マス（lead.square）。variantOf の派生は親タイルの下の
//     チップに束ねる。アイコンは経路から自動生成する K.tacticGlyph（§4-3）
//   - 囲いタイル: CASTLE_FAMILIES ごとの折りたたみブロック。サムネイルは玉・金・銀の
//     外接矩形で切り出し、全タイル共通の倍率で描く。相手の面は180度回転（字は正立）（§4-4）
//   - バッジ2軸（§3-1）: 整合=preview で他層が変わる → data-cascade（破線枠）＋「→要約」。
//     対敵=compat.judge().vs → ◎（朱の左帯）/ △（理由は title）/ 相手が無いときは非表示。
//     ng は「選べない」ではなく cascade。戦略に合わない系統は行・ブロックごとに
//     cascade 見た目で残す（隠さない）
//   - スプリッタ: role=separator、↑↓キーで5%刻み・ダブルクリックで 0.5・pointer ドラッグ。
//     ドラッグ中は CSS 変数だけを書き換え、終了時に store.set({dock:{split}}) で永続化
//   - ホバー/フォーカスで onPreview（制約バーの点滅・盤のマス表示は呼び出し側が描く）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, plain } = K.html;
  const { ZEN } = K.notation;
  const FIELD = K.constraints.FIELD;
  const LAYER_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  const VS_MARK = { good: '◎', bad: '△', neutral: '' };
  const STRATEGY_IDS = ['ibisha', 'furibisha'];
  const MIN_PANE = 120, SPLIT_MIN = .2, SPLIT_MAX = .8;

  const nameOf = (kind, id) => {
    if (id == null) return '（なし）';
    if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
    const x = kind === 'tactic' ? (K.TACTICS || []).find(t => t.id === id) : (K.CASTLES || []).find(c => c.id === id);
    return x ? x.name : id;
  };
  // その囲いを許す戦略の集合（strategies があればそれだけ、なければ side）
  const sidesOf = c => (Array.isArray(c.strategies) ? c.strategies : [c.side]);
  const castlePos = c => K.Position.fromCastle(c, K.SETUPS[c.setup]);
  // 筋の表示名: 相手の面は盤の絶対座標（10−f）に合わせる
  const fileBadge = (t, flip) => t.lead.files.map(f => ZEN[flip ? 10 - f : f]).join('・') + '筋';

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
        this._paneHtml('opp') +
        `<div class="dk-sep" role="separator" tabindex="0" aria-orientation="horizontal" ` +
        `aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" ` +
        `aria-label="上下の面の高さ（↑↓キーで調節・ダブルクリックで半分に戻す）"></div>` +
        this._paneHtml('me') +
        `</div>`;
      this.root = el.firstElementChild;
      this.sep = this.root.querySelector('.dk-sep');
      this.tacticRows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      // バッジ評価のメモ（§3-2）: 制約リストが同じ間は候補ごとの preview/judge 結果を使い回す
      this._badgeMemo = { key: '', map: new Map() };

      // 囲いの局面と切り出し範囲は1回だけ組み立てる。共通倍率は最大の外接矩形に合わせる（§4-4 Q3）
      this._pos = new Map();
      this._box = { me: new Map(), opp: new Map() };
      this.maxCols = 1;
      for (const c of K.CASTLES) {
        const pos = castlePos(c);
        this._pos.set(c.id, pos);
        for (const who of ['me', 'opp']) {
          const b = K.miniCropBox(pos, who === 'opp') || { f0: 1, f1: 6, r0: 6, r1: 9, cols: 6, rows: 4 };
          this._box[who].set(c.id, b);
          if (b.cols > this.maxCols) this.maxCols = b.cols;
        }
      }

      this.panes = {
        opp: this._initPane(this.root.querySelector('[data-who="opp"]'), 'opp'),
        me: this._initPane(this.root.querySelector('[data-who="me"]'), 'me'),
      };
      this._bindEvents();
      this._bindSplit();
    }

    // ---------- 構造 ----------
    // 面は who 固定（上=相手・下=自分）。fold でアコーディオン式に畳める。
    // 相手がいない間、上の面は「＋ 相手を加える」だけを出す（選択UIは出さない）
    _paneHtml(who) {
      return `<section class="dk-pane" data-who="${who}">
        <header class="dk-pane-h">
          <button type="button" class="dk-fold" aria-expanded="true"
            title="${who === 'me' ? '自分' : '相手'}の面を畳む／開く"><i class="caret" aria-hidden="true"></i></button>
          <span class="dk-who-l">${who === 'me' ? '自分 ▲' : '相手 △'}</span>
          <div class="seg dk-tab" role="group" aria-label="一覧（戦法／囲い）">
            <button type="button" data-value="tactic">戦法</button><button type="button" data-value="castle">囲い</button>
          </div>
          ${who === 'opp' ? '<button type="button" class="dk-addopp">＋ 相手を加える</button>' : ''}
          <button type="button" class="dk-clear" data-clear="${who}"
            title="${who === 'me' ? '自分' : '相手'}の制約をすべて外す">はずす</button>
        </header>
        <div class="seg small wide dk-strategy" role="group" aria-label="${who === 'me' ? '自分' : '相手'}の戦略">
          ${STRATEGY_IDS.map(id =>
            `<button type="button" data-value="${id}" data-kind="strategy" data-id="${id}">${esc(K.STRATEGIES[id].label)}</button>`).join('')}
        </div>
        <div class="dk-body" tabindex="0"></div>
      </section>`;
    }

    _initPane(el, who) {
      const pane = {
        who, el, body: el.querySelector('.dk-body'), views: {}, cur: null, cfgKey: null,
        fold: el.querySelector('.dk-fold'), strategySeg: el.querySelector('.dk-strategy'),
        addopp: el.querySelector('.dk-addopp'), clear: el.querySelector('.dk-clear'),
      };
      pane.segTab = new K.Segmented(el.querySelector('.dk-tab'), v => this._setPane(who, { tab: v }));
      pane.segStrategy = new K.Segmented(el.querySelector('.dk-strategy'),
        v => this.h.onChoose(who, 'strategy', v));
      pane.fold.addEventListener('click', () => {
        const cfg = (this.h.store.state.dock || {})[who] || {};
        this._setPane(who, { open: cfg.open === false }); // 既定は開。閉じている時だけ true
      });
      if (pane.addopp) pane.addopp.addEventListener('click', () => this.h.onAddOpponent && this.h.onAddOpponent());
      return pane;
    }

    _setPane(who, patch) {
      const d = this.h.store.state.dock;
      this.h.store.set({ dock: { ...d, [who]: { ...d[who], ...patch } } });
    }

    // ---------- スプリッタ（§4-2） ----------
    _bindSplit() {
      const sep = this.sep;
      const clamp = v => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));
      const ratio = y => {
        const r = this.root.getBoundingClientRect();
        if (!r.height) return .5;
        const lo = Math.max(SPLIT_MIN, MIN_PANE / r.height);
        const hi = Math.min(SPLIT_MAX, 1 - MIN_PANE / r.height);
        return Math.min(hi, Math.max(lo, (y - r.top) / r.height));
      };
      // ドラッグ中は CSS 変数だけを書き換える（§2: 終了時に store.set）
      const paint = v => {
        this.root.style.setProperty('--dock-split', +v.toFixed(4));
        sep.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        sep.setAttribute('aria-valuetext', `上 ${Math.round(v * 100)}パーセント、下 ${Math.round(100 - v * 100)}パーセント`);
      };
      const commit = v => this.h.store.set({ dock: { ...this.h.store.state.dock, split: +clamp(v).toFixed(2) } });
      let drag = null;
      sep.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        // preventDefault しない: click/dblclick（0.5に戻す）とフォーカス（↑↓キー）を殺さないため。
        // ドラッグ中の選択範囲は CSS の user-select:none で抑える
        sep.setPointerCapture(e.pointerId);
        drag = ratio(e.clientY);
        paint(drag);
      });
      sep.addEventListener('pointermove', e => {
        if (drag == null) return;
        drag = ratio(e.clientY);
        paint(drag);
      });
      const end = e => {
        if (drag == null) return;
        const v = drag;
        drag = null;
        commit(v);
      };
      sep.addEventListener('pointerup', end);
      sep.addEventListener('pointercancel', end);
      sep.addEventListener('dblclick', () => commit(.5));
      sep.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Home') return;
        e.preventDefault();
        const cur = +this.h.store.state.dock.split || .5;
        commit(e.key === 'Home' ? .5 : cur + (e.key === 'ArrowDown' ? .05 : -.05));
      });
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
      // ホバー予告（§3-3）: タイル・派生チップ・戦略ボタンに乗ると親へ知らせる
      const candOf = t => t && t.closest ? t.closest('.dk-item, .dk-strategy button[data-id]') : null;
      const light = e => {
        const c = candOf(e.target);
        if (!c || !this.h.onPreview) return;
        const pane = c.closest('.dk-pane');
        const who = c.dataset.who || (pane && pane.dataset.who);
        if (who) this.h.onPreview(who, c.dataset.kind, c.dataset.id);
      };
      const unlight = e => {
        const c = candOf(e.target);
        if (c && !(e.relatedTarget && c.contains(e.relatedTarget)) && this.h.onPreviewEnd) this.h.onPreviewEnd();
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
        v = tab === 'tactic' ? this._buildTactics(who) : this._buildCastles(who);
        pane.views[key] = v;
      }
      if (pane.body.firstElementChild !== v.el) pane.body.replaceChildren(v.el);
      pane.cur = v;
    }

    // 行=主役の駒の系統、列=筋。自分は 9→1、相手は盤の絶対座標に合わせて反転（§4-3）
    _buildTactics(who) {
      const flip = who === 'opp';
      const colOf = f => (flip ? f : 10 - f);    // 周期表（ptable）と同じ列の規則
      const view = document.createElement('div');
      view.className = 'dk-view dk-tactics';
      const variantsOf = new Map();
      for (const t of K.TACTICS) {
        if (!t.variantOf) continue;
        if (!variantsOf.has(t.variantOf)) variantsOf.set(t.variantOf, []);
        variantsOf.get(t.variantOf).push(t);
      }
      for (const { family, tactics } of this.tacticRows) {
        const sec = document.createElement('section');
        sec.className = 'dk-trow';
        sec.dataset.side = family.side;
        sec.innerHTML = `<h3><span class="pt-tile" aria-hidden="true">${esc(family.piece)}</span>${esc(family.name)}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'dk-tgrid';
        // 列ごとの使用済み行数（陣取りのずれを避けるため明示的に grid-row を振る）
        const used = Array(10).fill(0);
        const place = (el, col, span) => {
          let row = 0;
          for (let c = col; c < col + span; c++) row = Math.max(row, used[c]);
          row += 1;
          for (let c = col; c < col + span; c++) used[c] = row;
          el.style.gridColumn = `${col} / span ${span}`;
          el.style.gridRow = String(row);
          grid.appendChild(el);
        };
        const covered = new Set(tactics.flatMap(t => t.lead.files));
        for (let f = 9; f >= 1; f--) {
          if (covered.has(f)) continue;
          const d = document.createElement('span');
          d.className = 'dk-dot';
          d.textContent = '–';
          d.setAttribute('aria-hidden', 'true');
          place(d, colOf(f), 1);
        }
        // 1マス=主役の駒の最終マス。同じ lead.square の非派生戦法は同じマスに並べる
        const bySq = new Map();
        for (const t of tactics) {
          if (t.variantOf) continue;
          const k = t.lead.square;
          if (!bySq.has(k)) bySq.set(k, []);
          bySq.get(k).push(t);
        }
        for (const ts of bySq.values()) {
          const cell = document.createElement('div');
          cell.className = 'dk-cell';
          place(cell, flip ? Math.min(...ts[0].lead.files) : colOf(Math.max(...ts[0].lead.files)), ts[0].lead.files.length);
          for (const t of ts) {
            cell.appendChild(this._tacticTile(who, t, flip));
            const vars = variantsOf.get(t.id) || [];
            if (vars.length) {
              const row = document.createElement('div');
              row.className = 'dk-vars';
              for (const v of vars) row.appendChild(this._varChip(who, v));
              cell.appendChild(row);
            }
          }
        }
        sec.appendChild(grid);
        view.appendChild(sec);
      }
      return {
        el: view,
        rows: [...view.querySelectorAll('.dk-trow')],
        items: this._items(view),
        tiles: [...view.querySelectorAll('.dk-tile')],
      };
    }

    _tacticTile(who, t, flip) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk-item dk-tile';
      b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = t.id;
      b.style.setProperty('--n', [...(t.short || t.name)].length);   // 名前の文字数（cqw フォント用）
      if (K.tacticNav.isRare(t)) b.dataset.rare = 'true';
      b.innerHTML = `${K.tacticGlyph(t)}` +
        `<span class="nm">${esc(t.short || t.name)}</span>` +
        `<span class="fb">${esc(fileBadge(t, flip))}</span>` +
        `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-csc"></span></span>`;
      return b;
    }

    // 派生戦法の小さなチップ（§4-3: 親タイルの下に束ねる）
    _varChip(who, v) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk-item dk-var';
      b.dataset.who = who; b.dataset.kind = 'tactic'; b.dataset.id = v.id;
      b.dataset.parent = v.variantOf;
      if (K.tacticNav.isRare(v)) b.dataset.rare = 'true';
      b.innerHTML = `<span class="nm">${esc(v.short || v.name)}</span>` +
        `<i class="dk-vs"></i><span class="dk-csc"></span>`;
      return b;
    }

    // 系統ごとの折りたたみブロック＋切り出しサムネイル（§4-4）
    _buildCastles(who) {
      const flip = who === 'opp';
      const view = document.createElement('div');
      view.className = 'dk-view dk-castles';
      const fams = [];
      for (const fam of K.CASTLE_FAMILIES) {
        const members = K.CASTLES.filter(c => c.family === fam.id);
        if (!members.length) continue;
        const sec = document.createElement('section');
        sec.className = 'dk-fam';
        sec.dataset.family = fam.id;
        sec._sides = new Set(members.flatMap(sidesOf));   // ブロックの cascade 判定用
        sec.innerHTML = `<button type="button" class="dk-fam-h" aria-expanded="true" aria-label="${esc(fam.name)}の一覧を開閉">
            <span class="caret" aria-hidden="true">▾</span>
            <span class="g" aria-hidden="true">${K.familyGlyph(fam.glyph)}</span>
            <b>${esc(fam.name)}</b><span class="n">${members.length}</span></button>`;
        const cards = document.createElement('div');
        cards.className = 'dk-cards';
        for (const c of members) {
          const box = this._box[who].get(c.id);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dk-item dk-card';
          b.dataset.who = who; b.dataset.kind = 'castle'; b.dataset.id = c.id;
          b.innerHTML =
            `<span class="thumb" aria-hidden="true"><span class="sc" style="width:${(box.cols / this.maxCols * 100).toFixed(1)}%">` +
            K.miniBoardSVG(this._pos.get(c.id), c.side, { crop: 'king-golds-silvers', flip, box }) +
            `</span></span>` +
            `<span class="nm">${esc(c.short || c.name)}</span>` +
            `<span class="dk-marks"><i class="dk-vs"></i><span class="dk-csc"></span></span>`;
          cards.appendChild(b);
        }
        sec.appendChild(cards);
        view.appendChild(sec);
        fams.push(sec);
      }
      return { el: view, fams, items: this._items(view) };
    }

    _items(view) {
      return [...view.querySelectorAll('.dk-item')].map(el => ({
        el, kind: el.dataset.kind, id: el.dataset.id,
        csc: el.querySelector('.dk-csc'), vs: el.querySelector('.dk-vs'),
      }));
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
      const other = who === 'me' ? S.opp : S.me;

      // 候補ごとの preview + judge をメモして使い回す（§3-2: 制約リストが同じ間は
      // バッジの答えは変わらない。selected/dock の変更で再評価しない）
      const mkey = `${who}|${JSON.stringify(list)}|${JSON.stringify(
        other ? [other.strategy, other.tacticId, other.castleId] : null)}`;
      if (this._badgeMemo.key !== mkey) this._badgeMemo = { key: mkey, map: new Map() };
      const memo = this._badgeMemo.map;
      // judge の土台は「候補を置いた後」の側（sides(pv.list)）を使う。
      // その側に制約が無くても（opp=null）、候補から推論した戦略で評価されるので
      // 「駒が足りない」といった嘘の ng 理由が出ない（空の {strategy:null} では全囲いが COUNT ng になる）
      const evalOf = (kind, id) => {
        const k = `${kind}|${id}`;
        let v = memo.get(k);
        if (!v) {
          const pv = K.constraints.preview(list, { type: 'set', who, kind, id });
          const jS = K.constraints.sides(pv.list)[who] || eff;
          v = { pv, j: K.compat.judge(jS, kind, id, other) };
          memo.set(k, v);
        }
        return v;
      };

      // 戦略セグ（常時表示。選択肢にも2軸のバッジをつける）
      pane.segStrategy.setValue(st ? st.strategy : null);
      for (const b of pane.segStrategy.el.querySelectorAll('button')) {
        const id = b.dataset.value;
        const { pv, j } = evalOf('strategy', id);
        const cur = !!st && st.strategy === id;
        this._badge(b, pv.changed, j, cur && st.implied.strategy);
        const tip = this._tip(j, pv.changed);
        if (tip) b.title = tip; else b.removeAttribute('title');
      }

      for (const it of pane.cur.items) {
        const { pv, j } = evalOf(it.kind, it.id);
        const cur = !!st && eff[FIELD[it.kind]] === it.id;
        it.el.setAttribute('aria-current', cur ? 'true' : 'false');
        this._badge(it.el, pv.changed, j, cur && st.implied[it.kind]);
        // カスケードの要約は文字でも出す（色だけに頼らない。title にも理由を添える）
        if (it.csc) {
          it.csc.textContent = pv.changed.length
            ? `→${pv.changed.map(c => (c.to != null ? nameOf(c.kind, c.to) : '外す')).join('・')}` : '';
        }
        if (it.vs) it.vs.textContent = j.vs ? VS_MARK[j.vs.level] || '' : '';
        const tip = this._tip(j, pv.changed);
        if (tip) it.el.title = tip; else it.el.removeAttribute('title');
      }

      // 選択中の派生を持つ親タイルを強調する（§4-3）
      if (pane.cur.tiles) {
        const selVar = st && st.tacticId;
        const parentId = selVar && (K.TACTICS.find(t => t.id === selVar) || {}).variantOf;
        for (const t of pane.cur.tiles) {
          if (parentId && t.dataset.id === parentId) t.dataset.vsel = 'true';
          else delete t.dataset.vsel;
        }
      }
      // 戦略に合わない行・ブロックは cascade 見た目で残す（隠さない。要件4）
      if (pane.cur.rows) {
        for (const sec of pane.cur.rows) {
          sec.dataset.offside = st && sec.dataset.side !== st.strategy ? 'true' : 'false';
        }
      }
      if (pane.cur.fams) {
        for (const sec of pane.cur.fams) {
          sec.dataset.offside = st && !sec._sides.has(st.strategy) ? 'true' : 'false';
        }
      }
    }

    _badge(b, changed, j, implied) {
      b.dataset.cascade = changed && changed.length ? 'true' : 'false';
      b.dataset.vs = j && j.vs ? j.vs.level : '';
      if (implied) b.dataset.implied = 'true'; else delete b.dataset.implied;
    }

    _tip(j, changed) {
      const tip = [];
      if (j.reasons && j.reasons.length) tip.push(j.reasons.map(r => plain(r.text)).join('／'));
      if (j.vs && j.vs.reasons && j.vs.reasons.length) tip.push(j.vs.reasons.map(r => plain(r.text)).join('／'));
      if (changed && changed.length) {
        tip.push(`連鎖: ${changed.map(c =>
          `${LAYER_JA[c.kind]} ${nameOf(c.kind, c.from)}→${c.to != null ? nameOf(c.kind, c.to) : '削除'}`).join('、')}`);
      }
      return tip.join('。');
    }
  }

  K.DockView = DockView;
})();
