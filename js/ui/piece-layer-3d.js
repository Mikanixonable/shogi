// 駒レイヤ（立体版）: 盤全面に置いた1枚の canvas に Three.js で駒を描き、局面の切替で滑らせる。
// 駒の見た目は Kakoi.kayaArt が焼いた彫駒の絵（面取りの陰影・彫りの字・木目）を真上から見た板として貼り、
// 盤に落ちる2段の影も同じ光から焼いた板で重ねる（真上の正射影なので立体の側面は見えない）。
// canvas は盤の縁まで広げ、端の駒の影が縁に落ちても切れないようにする。
// 盤は表示専用なので canvas は pointer-events:none（レイキャスト不要）。
// file:// でも動くようベンダリングした UMD ビルド（window.THREE）を使う。
// WebGL が使えない・?flat が付くときは BoardView が piece-layer-dom 側を選ぶのでここには来ない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ART = Kakoi.kayaArt;
  const TILE_S = 2.6;                  // 駒の絵を焼く解像度（単位系 88×100 の倍率）
  const MOVE_MS = 560, FADE_MS = 380, MODE_MS = 280;
  const PIECE_CHARS = '玉金銀角飛歩香桂'; // 定形の駒の字。未知の字は必要になった時点でタイルを足す

  // WAAPI の cubic-bezier と同じイージング（x(t) を Newton 法で解いて y を返す）
  const cubicBezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const xs = t => ((ax * t + bx) * t + cx) * t;
    const ys = t => ((ay * t + by) * t + cy) * t;
    return x => {
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = xs(t) - x;
        if (Math.abs(e) < 1e-4) break;
        const d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return ys(Math.min(1, Math.max(0, t)));
    };
  };
  const EASE_MOVE = cubicBezier(.2, .8, .2, 1);   // 駒の滑り（DOM版と同じ）
  const EASE_ROUTE = cubicBezier(.3, .65, .3, 1); // 筋道（DOM版と同じ）
  const EASE_OUT = t => 1 - (1 - t) * (1 - t);
  const clamp01 = v => Math.min(1, Math.max(0, v));

  class PieceLayer3d {
    /** WebGL と THREE が使えるか。false なら BoardView は DOM 版に切り替える */
    static supported() {
      try {
        if (!window.THREE || !window.THREE.WebGLRenderer) return false;
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
      } catch (e) { return false; }
    }

    /** @param {HTMLElement} boardEl position:relative の盤 */
    constructor(boardEl) {
      this.kind = '3d';
      this.animates = true;          // 駒を滑らせる描画（DOM 版は静止）
      this.board = boardEl;
      this.mode = 'all';
      this.cur = [];                 // いま盤にいる駒 {group, mats, p, owner, role, sq, op, target}
      this._tweens = [];
      this._raf = 0;
      this._keys = [];               // アトラスのタイル一覧 "字:色"
      this._tiles = new Map();       // key → {u,v,w,h}
      this._tex = new Map();         // key → CanvasTexture
      this._w = 0; this._h = 0; this._sqW = 1; this._sqH = 1;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'pieces3d';
      this.canvas.setAttribute('aria-hidden', 'true');
      // 初期化に失敗したとき DOM 版へ逃がしやすいよう、canvas の挿入はレンダラが作れてから
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      // .squares（マス）と .overlay（骨格・矢印 SVG）の間に挟む。z-index は CSS 側
      const squares = boardEl.querySelector('.squares');
      boardEl.insertBefore(this.canvas, squares ? squares.nextSibling : null);
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 2000);
      this.camera.position.set(0, 0, 600);
      // 光は絵に焼いてあるので照明は使わない（MeshBasic）。板は1枚を使い回し、実寸は mesh.scale で
      this.geoPlane = new THREE.PlaneGeometry(1, 1);

      this._readColors();
      this._rebuildAtlas();
      // 木目の画像と駒書体がそろってから焼き直す（未準備なら一旦代替で描いてある）
      ART.ready.then(() => { this._rebuildAtlas(); this._draw(); });
      // 明暗テーマの切替で駒の色・字色を取り直す
      this._themeObs = new MutationObserver(() => {
        this._readColors(); this._rebuildAtlas(); this._recolor(); this._draw();
      });
      this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      // 盤のサイズ・DPR 変化に追従（非表示で 0 サイズなら描画を止める）
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(boardEl);
      this._resize();
    }

    // ---- 駒の入れ替え ----

    /**
     * 局面を描く。駒の対応づけ（移動リスト）は BoardView が pieceMatch.plan で1回だけ計算して渡す。
     * いま盤にいる駒（this.cur）は、前回の plan.after と同じ並びで持っている
     * @param {{ after:Array<{p:string,owner:string,role:string,sq:string,skip?:string}>,
     *   pairs:Array<{o:number,n:number}>, gone:number[], appear:number[],
     *   lead:number, path:string[]|null }} plan pieceMatch.plan の結果
     * @param {{ mode:string, animate:boolean }} opts
     */
    render(plan, { mode, animate }) {
      this.mode = mode || 'all';
      const before = this.cur, { after, lead: leadIdx } = plan, m = plan;
      const next = new Array(after.length).fill(null);
      const claimed = new Set(m.pairs.map(pr => pr.o));

      for (const { o, n } of m.pairs) {
        const pc = before[o], dst = after[n];
        pc.sq = dst.sq; pc.role = dst.role;
        next[n] = pc;
        this._retile(pc);
        this._clearTweens(pc);
        this._resetPose(pc);
        this._applyMode(pc, animate);
        const to = this._pos(pc.sq), from = pc.group.position;
        const dist = Math.hypot(from.x - to.x, from.y - to.y);
        if (animate && dist >= 1) {
          this._anim(MOVE_MS, EASE_MOVE, k => {
            pc.group.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, 0);
          }, Math.min(dist, 400) * .25, null, pc);
        } else {
          pc.group.position.set(to.x, to.y, 0);
        }
      }

      for (const ni of m.appear) {
        const n = after[ni];
        // 主役は筋道をたどる専用の動き。既に同じマスにいても使い回さず経路再生に回す
        // （再利用に流すと _route が走らず --rt-d も残ってしまう）
        if (n.skip === 'lead') {
          // 経路再生用に新しい駒を作るので、同じマスに居残っている同名の駒はここで消す
          const si = before.findIndex((o, i) => !claimed.has(i) && o.p === n.p && o.owner === n.owner && o.sq === n.sq);
          if (si >= 0) { claimed.add(si); this._remove(before[si]); }
          const pc = this._make(n);
          next[ni] = pc;
          this._place(pc);
          pc.op = this._targetOp(pc); this._applyOp(pc);
          if (animate) this._route(pc, plan.path);
          continue;
        }
        // 同じマスに同じ駒が居続けるもの（後手の駒など）は入場せずそのまま使い回す
        const si = before.findIndex((o, i) => !claimed.has(i) && o.p === n.p && o.owner === n.owner && o.sq === n.sq);
        if (si >= 0) {
          claimed.add(si);
          const pc = before[si];
          pc.role = n.role;
          next[ni] = pc;
          this._retile(pc);
          this._clearTweens(pc);
          this._resetPose(pc);
          this._applyMode(pc, false);
          this._place(pc);
          continue;
        }
        const pc = this._make(n);
        next[ni] = pc;
        this._place(pc);
        if (animate) {
          const t = this._targetOp(pc); pc.target = t;
          if (n.owner === 'gote') {        // 後手の駒: 回りながら沈み込む（DOM の goteIn 相当）
            pc.op = 0; this._applyOp(pc);
            const r0 = pc.group.rotation.z, y0 = pc.group.position.y;
            pc.group.rotation.z = r0 + .55;
            pc.group.position.y = y0 - this._sqH * .3;
            this._anim(FADE_MS + 80, EASE_OUT, k => {
              pc.op = t * k; this._applyOp(pc);
              pc.group.rotation.z = r0 + .55 * (1 - k);
              pc.group.position.y = y0 - this._sqH * .3 * (1 - k);
            }, 0, null, pc);
          } else {                         // 先手の駒: 縮小からフェードイン
            pc.op = 0; this._applyOp(pc);
            this._anim(FADE_MS, EASE_OUT, k => {
              pc.op = t * k; this._applyOp(pc);
              const s = .7 + .3 * k;
              pc.group.scale.set(this._sqW * s, this._sqH * s, this._sqW * s);
            }, 0, null, pc);
          }
        } else {
          pc.op = this._targetOp(pc); this._applyOp(pc);
        }
      }

      for (const oi of m.gone) {           // 対応先のなかった駒は薄めながら消す
        const pc = before[oi];
        this._clearTweens(pc);
        if (animate && pc.op > .01) {
          const o = pc.op;
          this._anim(FADE_MS, EASE_OUT, k => { pc.op = o * (1 - k); this._applyOp(pc); }, 0,
            () => this._remove(pc), pc);
        } else this._remove(pc);
      }

      this.cur = next.filter(Boolean);
      if (!(leadIdx >= 0 && animate)) this.board.style.removeProperty('--rt-d');
      this._draw();
    }

    /** 盤を作り直さずに、駒の表示モードだけを切り替える */
    setMode(mode) {
      this.mode = mode || 'all';
      const animate = !reducedMotion();
      for (const pc of this.cur) this._applyMode(pc, animate);
      this._draw();
    }

    dispose() {
      this._ro.disconnect();
      this._themeObs.disconnect();
      if (this._raf) cancelAnimationFrame(this._raf);
      for (const pc of [...this.cur]) this._remove(pc);
      this.cur = [];
      this.geoPlane.dispose();
      for (const tex of this._tex.values()) tex.dispose();
      for (const tex of Object.values(this._shadowT || {})) tex.dispose();
      this.renderer.dispose();
      this.canvas.remove();
    }

    // ---- 座標と見た目 ----

    /** マス "39" の中心（ワールド座標。盤中央が原点、y は上向き） */
    _pos(sq) {
      const f = +sq[0], r = +sq[1];
      return { x: (9 - f + .5) * this._sqW - this._w / 2, y: this._h / 2 - (r - .5) * this._sqH };
    }

    _place(pc) {
      const p = this._pos(pc.sq);
      pc.group.position.set(p.x, p.y, 0);
    }

    // 入場・退場の途中だった駒を再利用するとき、大きさと向きを正規に戻す
    _resetPose(pc) {
      pc.group.scale.set(this._sqW, this._sqH, this._sqW);
      pc.group.rotation.z = 0;   // 後手の向きは絵の側で反転済み（光の向きを盤に固定するため）
    }

    /** 表示モードが要求する不透明度（.pc の off と同じ） */
    _targetOp(pc) {
      if (pc.owner === 'gote' || pc.role === 'core' || pc.role === 'lead') return 1;
      return this.mode === 'dim' ? .28 : 1;
    }

    _applyMode(pc, animate) {
      const t = this._targetOp(pc);
      pc.target = t;
      if (!animate) { pc.op = t; this._applyOp(pc); return; }
      if (Math.abs(pc.op - t) > .01) {
        const o = pc.op;
        this._anim(MODE_MS, EASE_OUT, k => { pc.op = o + (t - o) * k; this._applyOp(pc); }, 0, null, pc);
      }
    }

    _applyOp(pc) {
      const v = clamp01(pc.op);
      pc.mats.face.opacity = v;
      pc.mats.shadows.forEach((m, i) => { m.opacity = v * ART.SHADOWS[i].alpha; });
      pc.group.visible = v > .004;
    }

    /** 役割・持ち主が変わった駒の駒面テクスチャを差し替える（朱字・後手色） */
    _retile(pc) {
      const tex = this._tileTex(this._tileKey(pc));
      if (pc.mats.face.map !== tex) pc.mats.face.map = tex;
    }

    _tileKey(x) {
      const cls = x.owner === 'gote' ? 'g' : (x.role === 'core' || x.role === 'lead') ? 'c' : 'i';
      return `${x.p}:${cls}`;
    }

    _make(x) {
      const g = new THREE.Group();
      const side = x.owner === 'gote' ? 'g' : 's';
      const mats = {
        face: new THREE.MeshBasicMaterial({ map: this._tileTex(this._tileKey(x)), transparent: true, depthWrite: false }),
        shadows: ART.SHADOWS.map((_, i) => new THREE.MeshBasicMaterial({ map: this._shadowTex(side, i), transparent: true, depthWrite: false })),
      };
      // 局所座標は x がマス幅・y がマス高の単位（group.scale = マスの px）。駒の高さはマス高 × k
      const k = ART.scaleOf(x.p), fh = k, fw = k * (ART.W / ART.H) * (this._sqH / this._sqW || 9.6 / 9);
      const pad = ART.SHADOW_PAD;
      ART.SHADOWS.forEach((sh, i) => {   // 光の反対へずらした影（参照のマス幅 54px での px をマス単位へ）
        const m = new THREE.Mesh(this.geoPlane, mats.shadows[i]);
        m.scale.set(fw * (ART.W + pad * 2) / ART.W, fh * (ART.H + pad * 2) / ART.H, 1);
        m.position.set(-ART.LIGHT.x * sh.d / 54, ART.LIGHT.y * sh.d / (54 * 9.6 / 9), .1 + i * .1);
        m.renderOrder = i;
        g.add(m);
      });
      const mFace = new THREE.Mesh(this.geoPlane, mats.face);
      mFace.scale.set(fw, fh, 1);
      mFace.position.z = .5;
      mFace.renderOrder = 2;
      g.add(mFace);
      g.scale.set(this._sqW, this._sqH, this._sqW);
      this.scene.add(g);
      return { group: g, mats, p: x.p, owner: x.owner, role: x.role, sq: x.sq, op: 0, target: 1 };
    }

    _remove(pc) {
      this.scene.remove(pc.group);
      pc.mats.face.dispose(); pc.mats.shadows.forEach(m => m.dispose());
    }

    // 主役の駒を、筋道の各マスの中心を経由する折れ曲がった軌跡で動かす。
    // 所要時間は区画数に比例させ、経路の矢印（--rt-d）は駒が着くころに現れるように合わせる
    _route(pc, path) {
      const pts = path.map(sq => this._pos(sq));
      if (pts.length < 2) { this.board.style.removeProperty('--rt-d'); return; }
      pc.group.position.set(pts[0].x, pts[0].y, 0);
      const dur = Kakoi.pieceMatch.routeMs(path);
      this._anim(dur, EASE_ROUTE, k => {
        const t = k * (pts.length - 1);
        const i = Math.min(Math.floor(t), pts.length - 2), f = t - i;
        pc.group.position.set(pts[i].x + (pts[i + 1].x - pts[i].x) * f, pts[i].y + (pts[i + 1].y - pts[i].y) * f, 0);
      }, 0, null, pc);
      this.board.style.setProperty('--rt-d', `${Math.round(dur + 60)}ms`);
    }

    // ---- アニメーション基盤（WAAPI ではなく rAF tween） ----

    _anim(dur, ease, fn, delay = 0, done = null, pc = null) {
      this._tweens.push({ t0: performance.now() + delay, dur, ease, fn, done, pc });
      this._pump();
    }

    // 同じ駒に走っている古い tween を捨てる（連続した局面切替で中途の値へ戻るのを防ぐ）
    _clearTweens(pc) {
      if (this._tweens.length) this._tweens = this._tweens.filter(t => t.pc !== pc);
    }

    _pump() { if (!this._raf) this._raf = requestAnimationFrame(t => this._tick(t)); }

    _tick(now) {
      this._raf = 0;
      const rest = [];
      for (const tw of this._tweens) {
        const k = (now - tw.t0) / tw.dur;
        if (k < 0) { rest.push(tw); continue; }
        tw.fn(tw.ease(clamp01(k)));
        if (k < 1) rest.push(tw);
        else if (tw.done) tw.done();
      }
      this._tweens = rest;
      this._draw();
      if (this._tweens.length) this._pump();
    }

    // ---- サイズ・描画 ----

    _resize() {
      const r = this.board.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) { this._w = 0; return; } // 表示していない画面では描画を止める
      this._w = w; this._h = h;
      this._sqW = w / 9; this._sqH = h / 9;
      // canvas は盤の縁まで広い（CSS の inset）。中心は盤と同じなので、カメラの範囲だけ広げる
      const cr = this.canvas.getBoundingClientRect();
      const cw = Math.round(cr.width) || w, ch = Math.round(cr.height) || h;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      this.renderer.setSize(cw, ch, false);
      const c = this.camera;
      c.left = -cw / 2; c.right = cw / 2; c.top = ch / 2; c.bottom = -ch / 2;
      c.updateProjectionMatrix();
      for (const pc of this.cur) {
        this._clearTweens(pc);
        pc.group.scale.set(this._sqW, this._sqH, this._sqW);
        this._resetPose(pc);
        this._place(pc);
        this._applyMode(pc, false);
      }
      this.board.style.removeProperty('--rt-d');
      this._draw();
    }

    _draw() { if (this._w) this.renderer.render(this.scene, this.camera); }

    // ---- 駒面テクスチャ（字×色のタイルを1枚の canvas に焼く） ----

    _readColors() {
      const cs = getComputedStyle(this.board);
      const v = (n, d) => cs.getPropertyValue(n).trim() || d;
      this._colors = {
        wood1: v('--piece-1', '#f6e2ad'),
        wood2: v('--piece-2', '#ebcb88'),
        ink: v('--ink', '#1b1a17'),
        core: v('--core', '#c8371f'),
        goteInk: v('--gote-ink', '#33507a'),
      };
    }

    _rebuildAtlas() {
      if (!this._keys.length) {
        for (const p of PIECE_CHARS) for (const cls of ['i', 'c', 'g']) this._keys.push(`${p}:${cls}`);
      }
      const tw = Math.ceil(ART.W * TILE_S), th = Math.ceil(ART.H * TILE_S), cols = 8;
      const rows = Math.ceil(this._keys.length / cols);
      const cv = this._atlas || (this._atlas = document.createElement('canvas'));
      cv.width = cols * tw; cv.height = rows * th;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      this._tiles.clear();
      this._keys.forEach((key, i) => {
        const tx = (i % cols) * tw, ty = Math.floor(i / cols) * th;
        this._tiles.set(key, { u: tx / cv.width, v: ty / cv.height, w: tw / cv.width, h: th / cv.height });
        const [p, cls] = key.split(':');
        const ink = cls === 'c' ? this._colors.core : cls === 'g' ? this._colors.goteInk : this._colors.ink;
        ART.paint(ctx, tx, ty, TILE_S, p, cls === 'g' ? 'g' : 's', { ink, wood1: this._colors.wood1, wood2: this._colors.wood2 });
      });
      for (const [key, tex] of this._tex) {
        const t = this._tiles.get(key);
        if (!t) continue;
        tex.offset.set(t.u, 1 - t.v - t.h);
        tex.repeat.set(t.w, t.h);
        tex.needsUpdate = true;
      }
    }

    _tileTex(key) {
      if (!this._tiles.has(key)) { this._keys.push(key); this._rebuildAtlas(); }
      let tex = this._tex.get(key);
      if (!tex) {
        tex = new THREE.CanvasTexture(this._atlas);
        tex.minFilter = THREE.LinearFilter; // NPOT でも安全な設定
        tex.generateMipmaps = false;
        if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        const t = this._tiles.get(key);
        tex.offset.set(t.u, 1 - t.v - t.h);
        tex.repeat.set(t.w, t.h);
        this._tex.set(key, tex);
      }
      return tex;
    }

    /** 盤に落ちる影の板（向き × 2段）。形のシルエットを光から決めた量だけぼかしたもの */
    _shadowTex(side, i) {
      this._shadowT = this._shadowT || {};
      const key = `${side}${i}`;
      if (this._shadowT[key]) return this._shadowT[key];
      const units = ART.SHADOWS[i].blur * ART.pxToUnits(.9);
      const t = new THREE.CanvasTexture(ART.shadow(side, 1.5, units));
      t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      this._shadowT[key] = t;
      return t;
    }

    /** テーマ切替時: 駒面のタイルを張り替える */
    _recolor() {
      for (const pc of this.cur) pc.mats.face.map = this._tileTex(this._tileKey(pc));
    }
  }

  Kakoi.PieceLayer3d = PieceLayer3d;
})();
