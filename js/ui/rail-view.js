// 統合画面の左レール（.rail）: 「自分／相手」で切り替える1枚の面。
// 側の切り替えはレールの右端（盤との境）に立てた駒の見出し（バインダー）で行う。
// 盤と同じく上=相手（先が下の駒）・下=自分（先が上の駒）。相手の見出しで相手の表示を ON にでき、
// 角の × で OFF にする。面は囲い／戦法・リセット・絞り込み・一覧からなる。
// 戦略（居飛車／振り飛車）の絞り込みは一覧の表示を絞るだけで制約にはならない
// （戦略は選んだ戦法から導く）。見ている側・層は state.selected が持つ。
// 計画書 S6 で分割: 一覧の中身の構築は rail-grids.js、
// バッジと「戦略に合わない項目」の判定は rail-badges.js。
//   - バッジ2軸（§3-1/U1）: 両立=compat.judge の ng → ✕。相手との相性=judge().vs → ◎/△
//   - ホバー/フォーカスで onPreview（盤のマス表示は呼び出し側が描く）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { VS_MARK, findTactic, KINDS, FIELD } = K.catalog;
  const { esc } = K.html;
  const castlePos = c => K.Position.fromCastle(c, K.SETUPS[c.setup]);
  // 一覧の並べ方は表示の好み（盤面の状態ではない）なのでここで localStorage に持つ
  const PREF = 'shogi-castle:dock';
  const loadPref = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch { return {}; } };
  // 面の上端の切り替え面（design-refs-dock-switch 案B「型の三印」）: 戦型・囲い・戦法を
  // 同じレイヤーの選択肢として一続きに並べる。絵は1枚の SVG、操作は透明ボタンの重なり
  // （制約フィールドと同じ二層）。戦型=辺を共有する正六角形の対（左=振飛車・右=居飛車）、
  // 囲い=パズルのピース、戦法=駒形の五角形。開いている層の型から面の罫へ点線の茎を垂らす
  const f1 = n => +n.toFixed(2);
  const pt = p => `${f1(p[0])} ${f1(p[1])}`;
  // 上に頂点を持つ正六角形（制約フィールドの戦型胞と同じ向き）
  const hexV = (cx, cy, r) => [90, 150, 210, 270, 330, 30]
    .map(a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]);
  // 角をわずかに丸めた多角形のパス（constraint-field.js の roundPath と同じ）
  const roundPath = (pts, r = 2) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const toward = q => {
        const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
        return [p[0] + dx / d * r, p[1] + dy / d * r];
      };
      out.push(`${i ? 'L' : 'M'}${pt(toward(a))}Q${pt(p)} ${pt(toward(b))}`);
    }
    return out.join('') + 'Z';
  };
  // パズルの継ぎ目（「首が絞れて頭が膨らむ」突起。制約フィールドと同じ曲線）
  const jEdge = (p0, p1, s = 0, d = 7, w = 1) => {
    if (!s) return `L${pt(p1)}`;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
    const P = (t, o = 0) => {
      const tt = .5 + (t - .5) * w;
      return [p0[0] + ux * tt * L + nx * o * s, p0[1] + uy * tt * L + ny * o * s];
    };
    return `L${pt(P(.30))}` +
      `C${pt(P(.315, -.09 * d))} ${pt(P(.355, -.08 * d))} ${pt(P(.395, .18 * d))}` +
      `C${pt(P(.415, .38 * d))} ${pt(P(.425, .52 * d))} ${pt(P(.40, .68 * d))}` +
      `C${pt(P(.375, .88 * d))} ${pt(P(.36, 1.02 * d))} ${pt(P(.42, 1.13 * d))}` +
      `C${pt(P(.45, 1.19 * d))} ${pt(P(.55, 1.19 * d))} ${pt(P(.58, 1.13 * d))}` +
      `C${pt(P(.64, 1.02 * d))} ${pt(P(.625, .88 * d))} ${pt(P(.60, .68 * d))}` +
      `C${pt(P(.575, .52 * d))} ${pt(P(.585, .38 * d))} ${pt(P(.605, .18 * d))}` +
      `C${pt(P(.645, -.08 * d))} ${pt(P(.685, -.09 * d))} ${pt(P(.70))}` +
      `L${pt(p1)}`;
  };
  const boxJ = (x, y, w, h, e, d = 7, jw = 1) => {
    const depth = typeof d === 'number' ? { n: d, e: d, s: d, w: d } : d;
    return `M${pt([x, y])}` +
      jEdge([x, y], [x + w, y], e.n, depth.n, jw) +
      jEdge([x + w, y], [x + w, y + h], e.e, depth.e, jw) +
      jEdge([x + w, y + h], [x, y + h], e.s, depth.s, jw) +
      jEdge([x, y + h], [x, y], e.w, depth.w, jw) + 'Z';
  };
  // 駒のシルエット五角形（.pt-tile の頂点比 50-86-100-0-14）
  const pieceV = (x, y, w, h) => [[x + w * .5, y], [x + w * .86, y + h * .14], [x + w, y + h], [x, y + h], [x + w * .14, y + h * .14]];
  const polyPath = pts => 'M' + pts.map(pt).join('L') + 'Z';

  class RailView {
    /**
     * @param {HTMLElement} el `#pickRail`（内部構造はこのクラスが作る）
     * @param {{ onSelect:(who:'me'|'opp', kind:string)=>void,
     *   onChoose:(who:'me'|'opp', kind:string, id:string)=>void,
     *   onRemove?:(who:string, kind:string, id:string)=>void,   // 戦法を1つ外す（駒ごとの枠）
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
      this.senkeiFilter = { me: null, opp: null };     // 戦型（細）の絞り込み（同じく表示だけの状態）
      this._senkeiSig = null;                          // 出している戦型チップの並び
      this._strat = { me: null, opp: null };           // 絞り込みを最後に合わせた、導出した戦略
      this._last = null;
      this._whoPrev = null;                            // 前回表示していた側（切り替わりの向きの演出用）
      const pref = loadPref();
      this.sort = K.railGrids.CASTLE_SORTS.some(x => x.id === pref.sort) ? pref.sort : 'family';
      // 面の上端は切り替え面（案B「型の三印」）1面: 戦型（振飛車／居飛車の六角形の対）・
      // 囲い（パズルピース）・戦法（駒形五角形）を同じレイヤーに並べる。
      // その下に戦型（細）チップ・並べ方・記号の凡例・?。開いている側の名前は右端の駒の見出し（バインダー）が示すので、面には見出しを持たない
      el.innerHTML =
        `<div class="dk">` +
         `<section class="dk-pane">` +
         `<header class="dk-pane-h">` +
         `<div class="dk-sw">` +
         `<svg class="dk-sw-art" viewBox="0 0 326 64" aria-hidden="true"></svg>` +
         `<div class="seg dk-strategy" role="group" aria-label="戦型の絞り込み（振飛車／居飛車）">` +
         `<button type="button" data-value="furibisha" aria-label="戦型を振飛車に絞る">振飛車</button>` +
         `<button type="button" data-value="ibisha" aria-label="戦型を居飛車に絞る">居飛車</button>` +
         `</div>` +
         `<div class="seg dk-tab" role="group" aria-label="一覧（囲い／戦法）">` +
         `<button type="button" data-value="castle" aria-label="囲いの一覧を開く">囲い</button>` +
         `<button type="button" data-value="tactic" aria-label="戦法の一覧を開く">戦法</button>` +
         `</div></div></header>` +
         // 戦型（細）のチップ行: 組み合わせから候補を出し、一覧の表示を絞るだけ（制約にはしない）
         `<div class="dk-senkei" role="group" aria-label="戦型（細）の絞り込み"></div>` +
         `<div class="dk-tools"><label class="dk-sort"><span>並べ方</span><select class="dk-sort-sel">` +
         K.railGrids.CASTLE_SORTS.map(x => `<option value="${x.id}">${esc(x.label)}</option>`).join('') +
         `</select></label><span class="dk-key"></span><button type="button" class="dk-legend" aria-expanded="false" ` +
         `aria-label="記号の見方" title="記号の見方">?</button></div>` +
         // 採用した戦法の盆（複数選択を見せる。戦法の面で選択があるときだけ現れる）
         `<div class="dk-tray" role="group" aria-label="採用中の戦法" hidden></div>` +
         `<div class="dk-body" tabindex="0" role="region" aria-label="一覧"></div>` +
         `</section></div>` +
        // 駒の見出し（バインダー）: 上=相手・下=自分。相手の駒の角の × で相手の表示を OFF にする
        `<div class="dk-binder" role="tablist" aria-orientation="vertical" aria-label="自分／相手">` +
        `<span class="dk-pc-ghost" aria-hidden="true"></span>` +
        `<button type="button" role="tab" class="dk-pc" data-who="opp"><span class="body" aria-hidden="true"></span>` +
        `<span class="v"><b>相手</b><small>△</small></span></button>` +
        `<button type="button" class="dk-pc-x" aria-label="相手の表示を OFF にする" title="相手を盤から下げる（表示 OFF）">×</button>` +
        `<button type="button" role="tab" class="dk-pc" data-who="me"><span class="body" aria-hidden="true"></span>` +
        `<span class="v"><b>自分</b><small>▲</small></span></button>` +
        `</div>`;
      this.root = el.firstElementChild;
      this.swArt = this.root.querySelector('.dk-sw-art');
      this.body = this.root.querySelector('.dk-body');
      this.tray = this.root.querySelector('.dk-tray');
      this.key = this.root.querySelector('.dk-key');
      this.binder = el.querySelector('.dk-binder');
      this.pcs = { me: this.binder.querySelector('[data-who="me"]'), opp: this.binder.querySelector('[data-who="opp"]') };
      this.oppOffBtn = this.binder.querySelector('.dk-pc-x');
      this._bindBinder();
      this.tabSeg = new K.Segmented(this.root.querySelector('.dk-tab'), v => h.onSelect(this.who, v));
      this.stratSeg = new K.Segmented(this.root.querySelector('.dk-strategy'), v => {
        this.filter[this.who] = v;
        if (this._last) this.update(this._last.state, this._last.S);
      });
      // 戦型（細）のチップ: 一覧の表示を絞るだけで制約にはならない（'すべて' は空値）
      this.senkeiRow = this.root.querySelector('.dk-senkei');
      this.senkeiRow.addEventListener('click', e => {
        const b = e.target.closest('button[data-value]');
        if (!b) return;
        this.senkeiFilter[this.who] = b.dataset.value || null;
        this._syncSenkeiRow();
        if (this._last) this._updatePane(this._last.state, this._last.S, this.who, this._last.state.showOpp);
      });
      this.sortWrap = this.root.querySelector('.dk-sort');
      this.sortSel = this.root.querySelector('.dk-sort-sel');
      this.sortSel.value = this.sort;
      this.sortSel.addEventListener('change', () => {
        this.sort = this.sortSel.value;
        try { localStorage.setItem(PREF, JSON.stringify({ sort: this.sort })); } catch { /* 無視 */ }
        if (this._last) this.update(this._last.state, this._last.S);
      });
      // タイル・チップは roving tabindex（U3）。矢印でフォーカスを移し Enter で選ぶ
      this.roving = K.roving.attach(this.body, '.dk-item');
      this.views = {};   // `${who}:${kind}` → 一覧の中身（構築は1回だけ。update では属性だけを書き換える）
      // レールの居飛車の系統は 飛車→銀→角→桂→歩→金→玉 の順に並べる
      const ibishaRank = { '飛': 0, '銀': 1, '角': 2, '桂': 3, '歩': 4, '金': 5, '玉': 6 };
      const rows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      this.tacticRows = [
        ...rows.filter(r => r.family.side !== 'ibisha'),
        ...rows.filter(r => r.family.side === 'ibisha')
          .sort((a, b) => (ibishaRank[a.family.piece] ?? 9) - (ibishaRank[b.family.piece] ?? 9)),
      ];
      // 囲いの局面は1回だけ組み立てる（F3: 切り出しは囲いごとに最大化するので共通倍率は持たない）
      this._pos = new Map();
      for (const c of K.CASTLES) this._pos.set(c.id, castlePos(c));
      this._bindEvents();
      this._bindLegend();
      // 狭い画面: バインダーの駒は切り替え面と同じ行へ（切り替え面は1面なので戦型だけを
      // 取り出さない）、「選ぶ操作（側・層・戦型）」と「見せ方の操作（戦型（細）の絞り込み・
      // 並べ方・凡例）」の2段に分ける（モバイル M1）
      this._mql = matchMedia('(max-width:979px)');
      this._mql.addEventListener('change', () => this._relocate());
      this._relocate();
    }

    _relocate() {
      const paneH = this.root.querySelector('.dk-pane-h');
      const tools = this.root.querySelector('.dk-tools');
      const narrow = this._mql.matches;
      if (narrow) {
        paneH.prepend(this.binder);        // [相手/自分][切り替え面]
        tools.prepend(this.root.querySelector('.dk-senkei'));
      } else {
        tools.before(this.root.querySelector('.dk-senkei'));
        this.el.appendChild(this.binder);  // レール右端の縦バインダーに戻る
      }
      this.binder.setAttribute('aria-orientation', narrow ? 'horizontal' : 'vertical');
    }

    // ---------- 切り替え面の絵（案B）: 選択に合わせて描き直す。
    // トグルは切り替え機能なので実効値は載せず、パラメータ名だけを示す ----------
    _paintSwitch() {
      const strat = this.filter[this.who] || 'ibisha';
      const tab = this.kind;
      let s = '';
      // 戦型: 下札を背面に置き、その上に辺を共有する正六角形の対を重ねる。
      // 札＋六角形の外形を囲い・戦法のボタン高（52px）に揃える
      s += `<rect class="tag" x="26" y="45" width="58" height="15"/>` +
           `<text class="nm" x="55" y="58">戦型</text>`;
      // 左=振飛車・右=居飛車。ON=墨塗り
      for (const [cx, cy, id, ch] of [[34.2, 26, 'furibisha', '振'], [75.8, 26, 'ibisha', '居']]) {
        const on = strat === id;
        s += `<path d="${roundPath(hexV(cx, cy, 18), 2)}" class="hx${on ? ' on' : ''}"/>` +
             `<text class="ch${on ? ' on' : ''}" x="${cx}" y="${cy - 1}">${ch}</text>` +
             `<text class="sub${on ? ' on' : ''}" x="${cx}" y="${cy + 10}">飛車</text>`;
      }
      // 囲い: 外接寸法94×52は維持し、辺長に合わせた突起深さでパズル形状の比率を保つ
      // 戦法: 駒形五角形。開いている層は朱縁
      s += `<path d="${boxJ(119, 20, 88, 40, { n: 1, e: 1, s: 0, w: -1 }, { n: 10, e: 5, s: 0, w: 5 })}" class="shp${tab === 'castle' ? ' on' : ''}" data-layer="castle"/>` +
           `<text class="nm" x="163" y="45">囲い</text>` +
           `<path d="${polyPath(pieceV(227, 8, 88, 52))}" class="shp${tab === 'tactic' ? ' on' : ''}" data-layer="tactic"/>` +
           `<text class="nm" x="271" y="40">戦法</text>`;
      // 開いている層の型から面の罫へ点線の茎
      s += `<path d="M${tab === 'castle' ? 163 : 271} 60V64" class="stem"/>`;
      this.swArt.innerHTML = s;
    }

    // ---------- 駒の見出し: 押すとその側の面へ（相手が OFF なら表示して開く）。縦のタブなので ↑=相手・↓=自分 ----------
    _bindBinder() {
      this.binder.addEventListener('click', e => {
        if (e.target.closest('.dk-pc-x')) {
          this.h.onToggleOpponent(false);
          this.pcs.me.focus();
          return;
        }
        const pc = e.target.closest('.dk-pc');
        if (pc) this.h.onSelect(pc.dataset.who, this.kind);
      });
      this.binder.addEventListener('keydown', e => {
        if (!e.target.closest('.dk-pc')) return;
        if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
          e.preventDefault();
          // 縦（広い画面）: 上=相手・下=自分。横（狭い画面）: 左=相手・右=自分
          const who = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? 'opp' : 'me';
          this.h.onSelect(who, this.kind);
          this.pcs[who].focus();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('[data-who="opp"]')) {
          // 駒を下げる＝相手の表示 OFF
          e.preventDefault();
          this.h.onToggleOpponent(false);
          this.pcs.me.focus();
        }
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
          `<li><span class="lg-ex lg-sel">名称</span>選択中（囲い=朱の枠と ✓）</li>` +
          `<li><span class="lg-ex lg-inv">名称</span>採用中の戦法（駒色に裏返し。盆にも並ぶ）</li>` +
          `<li><span class="lg-badge lg-good">◎</span>相手との相性がよい／<span class="lg-badge lg-bad">△</span>苦手</li>` +
          `<li><span class="lg-badge lg-ng">✕</span>＋点線の枠：いまの組み合わせとは両立しない</li>` +
          `<li><span class="lg-ex lg-fam">名称</span>左の帯・下線の色：系統（戦法は主役の駒）</li>` +
          `<li><span class="lg-ex lg-imp">名称</span>点線の項目：既定値（未選択のため補った値）</li>` +
          `<li><span class="lg-ex">派生 n ▾</span>派生の戦法（押すと↳チップが開く）</li>` +
          `<li><span class="lg-ex lg-basic">名称</span>朱の印：基本の形</li>` +
          `</ul>`;
        const rootRect = this.root.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        pop.style.top = `${btnRect.bottom - rootRect.top + 6}px`;
        pop.style.right = `${rootRect.right - btnRect.right}px`;
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
        // 派生の束の開閉（親札の下の帯）
        const vf = e.target.closest('.dk-vf');
        if (vf) {
          const vars = vf.closest('.dk-vars');
          const open = vars.dataset.open !== 'true';
          vars.dataset.open = String(open);
          vf.setAttribute('aria-expanded', String(open));
          return;
        }
        const it = e.target.closest('.dk-item');
        if (it) {
          // 戦法の札はトグル: 採用中の札をもう一度押すと外す（implied の既定値は外せない）
          const off = it.dataset.kind === 'tactic' && it.getAttribute('aria-pressed') === 'true'
            && !it.dataset.implied && this.h.onRemove;
          if (off) this.h.onRemove(it.dataset.who, 'tactic', it.dataset.id);
          else this.h.onChoose(it.dataset.who, it.dataset.kind, it.dataset.id);
        }
      });
      // 盆: チップを押すとその戦法を外す。「全て外す」は戦法だけを空にする（囲い・戦型は触らない）
      this.tray.addEventListener('click', e => {
        if (e.target.closest('.dk-tray-all')) {
          const ids = (K.constraints.effectiveSides(this._last.state.slots, this._last.state.showOpp)[this.who]
            .tacticIds || []).slice();
          for (const id of ids) this.h.onRemove(this.who, 'tactic', id);
          return;
        }
        const chip = e.target.closest('.dk-chip');
        if (chip) this.h.onRemove(this.who, 'tactic', chip.dataset.id);
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
        v = kind === 'tactic' ? K.railGrids.tactics(this, who) : K.railGrids.castles(this, who, this.sort);
        this.views[key] = v;
      }
      if (this.body.firstElementChild !== v.el) this.body.replaceChildren(v.el);
      this.cur = v;
    }

    // ---------- 更新（属性の書き換えだけ。構造は who/kind が変わったときだけ作り直す） ----------
    /**
     * @param {object} state store.state（selected / slots / showOpp を読む）
     * @param {{ me:object, opp:object }} S constraints.effectiveSides() の出力
     */
    update(state, S) {
      this._last = { state, S };
      const sel = K.constraints.parseSel(state.selected) || K.constraints.DEFAULT_SEL;
      const showOpp = !!state.showOpp;
      const who = sel.who === 'opp' && !showOpp ? 'me' : sel.who;
      // 選択層に対応するタブを開く。戦型（スロットを持たない情報の選択）のときは
      // 最後に見ていた層タブの一覧をそのままにする
      const kind = KINDS.includes(sel.kind) ? sel.kind
        : (KINDS.includes(state.dockTab) ? state.dockTab : 'castle');
      this.who = who; this.kind = kind;
      // 側が切り替わったときだけ、押した駒のいる向きから面が入る（相手=上・自分=下）
      if (this._whoPrev && this._whoPrev !== who &&
          !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.root.animate(
          [{ opacity: 0, transform: `translateY(${who === 'opp' ? -12 : 12}px)` },
           { opacity: 1, transform: 'none' }],
          { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)' });
      }
      this._whoPrev = who;
      this.root.dataset.who = who;
      this.el.dataset.who = who;
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

      // 絞り込みは、導出した戦略が変わったとき（戦法を選んだ・ハッシュで開いた）にそれへ合わせる
      const st = S[who];
      if (this._strat[who] !== st.strategy) { this._strat[who] = st.strategy; this.filter[who] = st.strategy; }
      this.stratSeg.setValue(this.filter[who]);
      this._paintSwitch();
      // 戦型（細）のチップ: 組み合わせ（大分類）から候補を出す。変わったときだけ並び直す
      const cand = K.railGrids.senkeiCandidates(S.me, S.opp, showOpp);
      const sig = cand.join(',');
      if (sig !== this._senkeiSig) {
        this._senkeiSig = sig;
        this.senkeiRow.innerHTML =
          `<button type="button" class="vchip" data-value="">すべて</button>` +
          cand.map(id => `<button type="button" class="vchip" data-value="${esc(id)}">` +
            `${esc((K.SENKEI[id] || {}).short || (K.SENKEI[id] || {}).name || id)}</button>`).join('');
      }
      if (this.senkeiFilter[who] && !cand.includes(this.senkeiFilter[who])) this.senkeiFilter[who] = null;
      this._syncSenkeiRow();
      this._mount(who, kind);
      this._updatePane(state, S, who, showOpp);
    }

    // 戦型（細）チップの押下状態を反映する（'すべて' は空値）
    _syncSenkeiRow() {
      const cur = this.senkeiFilter[this.who] || '';
      for (const b of this.senkeiRow.querySelectorAll('button[data-value]'))
        b.setAttribute('aria-pressed', b.dataset.value === cur ? 'true' : 'false');
    }

    _updatePane(state, S, who, showOpp) {
      const st = S[who];
      const strat = this.filter[who];
      const B = K.railBadges;
      const v = this.cur;

      // 候補の評価は constraints.evaluate に一本化（S3: 共有 LRU で使い回す。土台は
      // 「候補を置いた後」の側＝その側が空でも候補から戦略が導かれ、
      // 「駒が足りない」といった嘘の ng 理由が出ない）
      for (const it of v.items) {
        const { j } = K.constraints.evaluate(state.slots, showOpp, who, it.kind, it.id);
        // 戦法は駒ごとの枠が複数ある: 採用中のもの全てを裏返す（トグルなので aria-pressed。
        // 単一選択の囲い・戦型は aria-current のまま）
        const cur = it.kind === 'tactic' ? (st.tacticIds || []).includes(it.id)
          : st[FIELD[it.kind]] === it.id;
        it.el.setAttribute(it.kind === 'tactic' ? 'aria-pressed' : 'aria-current',
          cur ? 'true' : 'false');
        it.el.hidden = B.offItem(it, strat)
          || !K.railGrids.senkeiMatch(this.senkeiFilter[who] || null, it.kind, it.id);
        const implied = cur && st.implied[it.kind];
        B.badge(it.el, j, implied);
        if (it.ng) it.ng.textContent = j.level === 'ng' ? '✕' : '';
        if (it.vs) it.vs.textContent = j.vs ? VS_MARK[j.vs.level] || '' : '';
        const tip = (implied ? '既定値。' : '') + B.tip(j);
        if (tip) it.el.title = tip; else it.el.removeAttribute('title');
      }

      // 選択中の派生を持つ親タイルを強調する（§4-3。複数戦法では採用中の全部を見る）
      if (v.tiles) {
        const parents = new Set((st.tacticIds || [])
          .map(id => (K.TACTICS.find(t => t.id === id) || {}).variantOf).filter(Boolean));
        for (const t of v.tiles) {
          if (parents.has(t.dataset.id)) t.dataset.vsel = 'true';
          else delete t.dataset.vsel;
        }
      }
      // 絞り込んだ戦略に合わない項目だけの行・系統はまるごと隠す。
      // 系統名の件数は、いま表示している項目の数に合わせる
      if (v.rows) for (const sec of v.rows) {
        sec.hidden = sec.dataset.side !== strat;
        if (sec.hidden) continue;
        // 採用中の数を朱の丸で示す。採用中を含む行・派生の束は隠れないよう強制的に開く
        const sel = sec.querySelectorAll('.dk-item[aria-pressed="true"]:not([data-implied])').length;
        const dot = sec.querySelector('.dk-seldot');
        if (dot) dot.textContent = sel || '';
        if (sel) {
          sec.dataset.closed = 'false';
          sec.querySelector('.dk-fam-h').setAttribute('aria-expanded', 'true');
        }
      }
      for (const vars of v.el.querySelectorAll('.dk-vars')) {
        if (vars.querySelector('.dk-item[aria-pressed="true"]')) {
          vars.dataset.open = 'true';
          vars.querySelector('.dk-vf').setAttribute('aria-expanded', 'true');
        }
      }
      this._paintTray(who, st);
      if (v.fams) {
        for (const sec of v.fams) {
          sec.hidden = !sec._sides.has(strat);
          if (!sec.hidden) {
            const el = sec.querySelector('.n');
            if (el) el.textContent = sec.querySelectorAll('.dk-item:not([hidden])').length;
          }
        }
      }
      this._paintKey(v, showOpp);
      this.roving.refresh();
    }

    // 採用した戦法の盆（戦法の面のときだけ）。チップ=駒形＋名＋×。押すと外す
    _paintTray(who, st) {
      // 既定値で補った戦法（implied）は採用セットに数えない
      const ids = (this.kind === 'tactic' && !st.implied.tactic && st.tacticIds) || [];
      if (!ids.length) { this.tray.hidden = true; this.tray.innerHTML = ''; return; }
      const TC = { '飛': 'rook', '銀': 'silver', '角': 'kaku', '桂': 'kei', '歩': 'fu', '金': 'kin', '玉': 'gyoku' };
      const html = `<span class="dk-tray-h">採用 <b>${ids.length}</b></span>` +
        ids.map(id => {
          const t = findTactic(id);
          if (!t) return '';
          const piece = (K.catalog.tacticFamilyOf(t) || {}).piece || '飛';
          return `<button type="button" class="dk-chip" data-id="${esc(id)}" ` +
            `style="--tc:var(--t-${TC[piece] || 'rook'})" title="${esc(t.name)}を外す">` +
            `<span class="pt-tile" aria-hidden="true">${piece}</span>` +
            `<span class="nm">${esc(t.short || t.name)}</span>` +
            `<span class="x" aria-hidden="true">×</span></button>`;
        }).join('') +
        `<button type="button" class="dk-tray-all">全て外す</button>`;
      if (this.tray.innerHTML !== html) this.tray.innerHTML = html;
      this.tray.hidden = false;
    }

    // 一覧の上の1行の凡例（6）: いま一覧に出ている記号だけを言葉で添える。
    // ◎/△ は相手を表示しているとき、✕ は両立しない項目が見えているときだけ
    _paintKey(v, showOpp) {
      const shown = v.items.filter(it => !it.el.hidden && !(it.el.closest('[hidden]')));
      const has = sel => shown.some(it => it.el.matches(sel));
      const parts = [];
      if (showOpp && has('[data-vs="good"]')) parts.push('<span class="lg-badge lg-good">◎</span>相性がよい');
      if (showOpp && has('[data-vs="bad"]')) parts.push('<span class="lg-badge lg-bad">△</span>苦手');
      if (has('[data-ng="true"]')) parts.push('<span class="lg-badge lg-ng">✕</span>両立しない');
      const html = parts.map(p => `<span class="dk-key-i">${p}</span>`).join('');
      if (this.key.innerHTML !== html) this.key.innerHTML = html;
      this.key.hidden = !parts.length;
    }

    // 制約胞を選んだときの連動（U5）: 種類のタブへ切り替わった一覧で、その側の実効値 st の
    // 項目までスクロールする（フォーカスは奪わず、一瞬だけ輪郭を添える）。
    // sel.id があるときはその戦法（無ければ主の戦法）を示す
    reveal(sel, st) {
      // 狭い画面では一覧のスクロールはページ全体のスクロールになるので行わない
      // （B2: 代わりに ScreenController が解説を盤の下へ持ってくる）
      if (matchMedia('(max-width:979px)').matches) return;
      const kind = sel && sel.kind;
      requestAnimationFrame(() => {
        const id = (sel && sel.id && findTactic(sel.id) && sel.id)
          || (st && (kind === 'tactic' ? K.defaults.primaryOf(st) : st[FIELD[kind]]));
        let t = id && this.body.querySelector(`.dk-item[data-id="${id}"]`);
        if (!t && id && kind === 'tactic') {   // 派生選択中は親タイルを示す
          const p = (findTactic(id) || {}).variantOf;
          if (p) t = this.body.querySelector(`.dk-item[data-id="${p}"]`);
        }
        if (!t || !t.scrollIntoView) return;
        // 畳んだ行・派生の束の中の項目は、見せるために開く
        const sec = t.closest('.dk-trow');
        if (sec && sec.dataset.closed === 'true') {
          sec.dataset.closed = 'false';
          const h = sec.querySelector('.dk-fam-h');
          if (h) h.setAttribute('aria-expanded', 'true');
        }
        const vars = t.closest('.dk-vars');
        if (vars) {
          vars.dataset.open = 'true';
          const vf = vars.querySelector('.dk-vf');
          if (vf) vf.setAttribute('aria-expanded', 'true');
        }
        t.scrollIntoView({
          block: 'nearest',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        if (t.dataset) { t.dataset.reveal = 'true'; setTimeout(() => { delete t.dataset.reveal; }, 1200); }
      });
    }
  }

  K.RailView = RailView;
})();
