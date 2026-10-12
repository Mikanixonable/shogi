// 駒レイヤ（立体版）: 盤全面に置いた1枚の canvas に Three.js で五角形の立体駒を描く。
// 盤は表示専用なので canvas は pointer-events:none（レイキャスト不要）。
// file:// でも動くようベンダリングした UMD ビルド（window.THREE）を使う。
// WebGL が使えない・?flat が付くときは BoardView が piece-layer-dom 側を選ぶのでここには来ない
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 駒の形（マス幅=1 の単位系。五角形は .pc の clip-path と同じ頂点比） ----
  const FACE_W = .72, FACE_H = .80;    // 駒面（上底）の五角形
  const BEVEL = .055;                  // 駒面から台座へ広がる量
  const DEPTH = .15, BEVEL_T = .035;   // 厚みと手前側の傾斜深さ
  const FRONT_Z = DEPTH + BEVEL_T + .006;
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

  /** 五角形シェイプ（先端が上。.pc の clip-path polygon(50% 0,86% 14%,100% 100%,0 100%,14% 14%) と同じ） */
  const pentagon = (w, h) => {
    const s = new THREE.Shape();
    s.moveTo(0, h / 2);
    s.lineTo(w * .36, h * .36);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(-w / 2, -h / 2);
    s.lineTo(-w * .36, h * .36);
    s.closePath();
    return s;
  };

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
      this.board = boardEl;
      this.mode = 'all';
      this.cur = [];                 // いま盤にいる駒 {group, mats, p, owner, role, sq, op, target}
      this._before = [];
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
      this.camera.position.set(0, 0, 600); // 駒の厚み分だけ前に出るので、手前で欠けない距離を取る
      this.scene.add(new THREE.AmbientLight(0xffffff, .82));
      const sun = new THREE.DirectionalLight(0xffffff, .5);
      sun.position.set(-3, 5, 6); // 左上の斜め上から
      this.scene.add(sun);

      // 共有ジオメトリ（単位系。実寸は group.scale でマスに合わせる）
      const shape = pentagon(FACE_W, FACE_H);
      this.geoBody = new THREE.ExtrudeGeometry(shape, {
        depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL, bevelSegments: 2, steps: 1,
      });
      this.geoFace = new THREE.ShapeGeometry(shape, 4);
      this.geoFace.scale(.96, .96, 1); // ベベルの縁が額縁のように残るよう少し小さく
      this._normUV(this.geoFace);
      this.geoShadow = new THREE.PlaneGeometry(1.04, 1.06);

      this._readColors();
      this._rebuildAtlas();
      // 駒書体の読み込みが済んでから焼き直す（未準備なら一旦代替フォントで描いてある）
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { this._rebuildAtlas(); this._draw(); });
      }
      // 明暗テーマの切替で駒の色・字色を取り直す
      this._themeObs = new MutationObserver(() => {
        this._readColors(); this._rebuildAtlas(); this._recolor(); this._draw();
      });
      this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      // 盤のサイズ・DPR 変化に追従（分類マップ画面で 0 サイズなら描画を止める）
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(boardEl);
      this._resize();
    }

    // ---- 駒の入れ替え ----

    /** 局面が渡される前に呼ぶ（DOM版と同じ手順）。今いる駒を移動元として記録する */
    capture() { this._before = this.cur.map(pc => ({ p: pc.p, owner: pc.owner, sq: pc.sq, ref: pc })); }

    /**
     * @param {Kakoi.Position} position
     * @param {{ mode:string, animate:boolean,
     *   trace?:{square:string, piece:string, path:string[]} }} opts
     */
    render(position, { mode, animate, trace }) {
      this.mode = mode || 'all';
      const before = this._before;
      this._before = [];
      const after = position.pieces.map(x => ({ p: x.p, owner: x.owner, role: x.role, sq: `${x.f}${x.r}` }));
      // 戦法の主役の駒は筋道をたどる専用の動きにするので、通常の対応づけからは外す
      const leadIdx = trace && trace.path && trace.path.length > 1
        ? after.findIndex(n => n.owner === 'sente' && n.sq === trace.square && n.p === trace.piece) : -1;
      if (leadIdx >= 0) after[leadIdx].skip = 'lead';
      const m = Kakoi.pieceMatch.pair(before, after);
      const next = new Array(after.length).fill(null);
      const claimed = new Set(m.pairs.map(pr => pr.o));

      for (const { o, n } of m.pairs) {
        const pc = before[o].ref, dst = after[n];
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
        // 同じマスに同じ駒が居続けるもの（後手の駒など）は入場せずそのまま使い回す
        const si = before.findIndex((o, i) => !claimed.has(i) && o.p === n.p && o.owner === n.owner && o.sq === n.sq);
        if (si >= 0) {
          claimed.add(si);
          const pc = before[si].ref;
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
        if (n.skip === 'lead') {           // 主役: 筋道をたどる
          pc.op = this._targetOp(pc); this._applyOp(pc);
          if (animate) this._route(pc, trace.path);
        } else if (animate) {
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
        const pc = before[oi].ref;
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
      for (const tex of this._tex.values()) tex.dispose();
      if (this._shadowT) this._shadowT.dispose();
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
      pc.group.rotation.z = pc.owner === 'gote' ? Math.PI : 0;
    }

    /** 表示モードが要求する不透明度（.pc の off/hidden と同じ） */
    _targetOp(pc) {
      if (pc.owner === 'gote' || pc.role === 'core' || pc.role === 'lead') return 1;
      return this.mode === 'core' ? 0 : this.mode === 'dim' ? .28 : 1;
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
      pc.mats.body.opacity = v;
      pc.mats.wall.opacity = v;
      pc.mats.face.opacity = v;
      pc.mats.shadow.opacity = v;
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
      const body = this._threeColor(this._colors.piece), wall = body.clone().multiplyScalar(.74);
      const mats = {
        body: new THREE.MeshLambertMaterial({ color: body, transparent: true }),
        wall: new THREE.MeshLambertMaterial({ color: wall, transparent: true }),
        face: new THREE.MeshLambertMaterial({ map: this._tileTex(this._tileKey(x)), transparent: true }),
        shadow: new THREE.MeshBasicMaterial({ map: this._shadowTex(), transparent: true, depthWrite: false }),
      };
      const mShadow = new THREE.Mesh(this.geoShadow, mats.shadow);
      mShadow.position.set(.015, -.035, .004); // 光は左上から → 影は右下へ
      const mBody = new THREE.Mesh(this.geoBody, [mats.body, mats.wall]);
      const mFace = new THREE.Mesh(this.geoFace, mats.face);
      mFace.position.z = FRONT_Z;
      g.add(mShadow, mBody, mFace);
      g.scale.set(this._sqW, this._sqH, this._sqW);
      if (x.owner === 'gote') g.rotation.z = Math.PI; // 後手は盤の逆向き（.pc.gote の rotate(180deg) と同じ）
      this.scene.add(g);
      return { group: g, mats, p: x.p, owner: x.owner, role: x.role, sq: x.sq, op: 0, target: 1 };
    }

    _remove(pc) {
      this.scene.remove(pc.group);
      pc.mats.body.dispose(); pc.mats.wall.dispose(); pc.mats.face.dispose(); pc.mats.shadow.dispose();
    }

    // 主役の駒を、筋道の各マスの中心を経由する折れ曲がった軌跡で動かす。
    // 所要時間は区画数に比例させ、経路の矢印（--rt-d）は駒が着くころに現れるように合わせる
    _route(pc, path) {
      const pts = path.map(sq => this._pos(sq));
      if (pts.length < 2) { this.board.style.removeProperty('--rt-d'); return; }
      pc.group.position.set(pts[0].x, pts[0].y, 0);
      const dur = Math.min(280 * (pts.length - 1), 1500);
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
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
      const c = this.camera;
      c.left = -w / 2; c.right = w / 2; c.top = h / 2; c.bottom = -h / 2;
      c.updateProjectionMatrix();
      for (const pc of this.cur) { pc.group.scale.set(this._sqW, this._sqH, this._sqW); this._place(pc); }
      this._draw();
    }

    _draw() { if (this._w) this.renderer.render(this.scene, this.camera); }

    // ---- 駒面テクスチャ（字×色のタイルを1枚の canvas に焼く） ----

    _readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n, d) => cs.getPropertyValue(n).trim() || d;
      this._fontFamily = v('--font-d', '"Shippori Mincho B1",serif');
      this._colors = {
        piece: v('--piece-1', '#fbf6ea'),
        ink: v('--ink', '#1b1a17'),
        core: v('--core', '#c8371f'),
        goteInk: v('--gote-ink', '#33507a'),
      };
    }

    /** CSS の色指定（rgba 含む）を THREE.Color へ。canvas の fillStyle で正規化してから渡す */
    _threeColor(css) {
      const c = PieceLayer3d._c2d || (PieceLayer3d._c2d = document.createElement('canvas').getContext('2d'));
      c.fillStyle = css;
      return new THREE.Color(c.fillStyle);
    }

    _rebuildAtlas() {
      if (!this._keys.length) {
        for (const p of PIECE_CHARS) for (const cls of ['i', 'c', 'g']) this._keys.push(`${p}:${cls}`);
      }
      const tile = 160, cols = 8;
      const rows = Math.ceil(this._keys.length / cols);
      const cv = this._atlas || (this._atlas = document.createElement('canvas'));
      cv.width = cols * tile; cv.height = rows * tile;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      this._tiles.clear();
      this._keys.forEach((key, i) => {
        const tx = (i % cols) * tile, ty = Math.floor(i / cols) * tile;
        this._tiles.set(key, { u: tx / cv.width, v: ty / cv.height, w: tile / cv.width, h: tile / cv.height });
        const [p, cls] = key.split(':');
        ctx.fillStyle = cls === 'c' ? this._colors.core : cls === 'g' ? this._colors.goteInk : this._colors.ink;
        ctx.font = `800 ${Math.round(tile * .62)}px ${this._fontFamily}`;
        ctx.fillText(p, tx + tile / 2, ty + tile * .58); // 駒は字をやや下に置く（.pc i span の padding-top と同じ）
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

    _shadowTex() {
      if (this._shadowT) return this._shadowT;
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(64, 62, 10, 64, 64, 60);
      rg.addColorStop(0, 'rgba(30,20,5,.40)');
      rg.addColorStop(.65, 'rgba(30,20,5,.15)');
      rg.addColorStop(1, 'rgba(30,20,5,0)');
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(64, 64, 60, 56, 0, 0, Math.PI * 2); g.fill();
      const t = new THREE.CanvasTexture(c);
      t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      this._shadowT = t;
      return t;
    }

    /** ShapeGeometry の UV を形の外接矩形で 0..1 に正規化（タイルの offset/repeat と組み合わせる前提） */
    _normUV(geo) {
      geo.computeBoundingBox();
      const b = geo.boundingBox, uv = geo.attributes.uv;
      const sx = b.max.x - b.min.x || 1, sy = b.max.y - b.min.y || 1;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (uv.getX(i) - b.min.x) / sx, (uv.getY(i) - b.min.y) / sy);
      }
      uv.needsUpdate = true;
    }

    /** テーマ切替時: 駒の体色と駒面のタイルを張り替える */
    _recolor() {
      const body = this._threeColor(this._colors.piece), wall = body.clone().multiplyScalar(.74);
      for (const pc of this.cur) {
        pc.mats.body.color.copy(body);
        pc.mats.wall.color.copy(wall);
        pc.mats.face.map = this._tileTex(this._tileKey(pc));
      }
    }
  }

  Kakoi.PieceLayer3d = PieceLayer3d;
})();
