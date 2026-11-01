// 「手筋と格言」の全画面モード: data/tesuji.js の手筋を、章立てした読み物として全画面に展開する。
// 左は章→節→項の目次ツリー（現在地はスクロールに追従して朱で示す）、右は本文。
// 章の区切りは data/tesuji.js の章コメントと同じ（歩／香・桂・銀・金／角・飛／囲いの崩し方／受け）。
// 「囲いの崩し方」は対象の囲いごとに項へ分ける。格言は PROVERB_GROUPS の節、末尾に出典。
// 図・コマ送り・格言の関連付けは旧モーダル（ui/tesuji-modal.js）から引き継ぐ。
// 開いている章・節は URL ハッシュの tj= が持つ（hash-link.js）。Esc・「囲い図鑑へ戻る」で盤へ帰る。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, rich, makeCiter, sourcesBlock, citeRefs } = K.html;
  const { ZEN, KAN } = K.notation;
  const ROLE_JA = { attack: '攻め', defense: '受け', both: '攻め・受け' };
  const W = 10, H = 11, M = 7;   // マスの幅・高さ、座標の余白

  const parse = str => (str || '').trim().split(/\s+/).filter(Boolean)
    .map(t => ({ p: t[0], sq: t.slice(1) }));

  /** 持ち駒 "歩歩" → "歩二" */
  const handText = h => {
    if (!h) return 'なし';
    const cnt = new Map();
    for (const p of h) cnt.set(p, (cnt.get(p) || 0) + 1);
    return [...cnt.entries()].map(([p, n]) => p + (n > 1 ? KAN[n] : '')).join(' ');
  };

  /**
   * 手筋の図（1コマ）の SVG。左ほど筋が大きい（盤と同じ向き）。後手の駒は180度回して描く。
   * 直前のコマから変わったマスは薄く塗る
   */
  function diagramSVG(d, i) {
    const [f0, f1] = d.files, [r0, r1] = d.ranks;
    const cols = f1 - f0 + 1, rows = r1 - r0 + 1;
    const fr = d.frames[i], prev = i > 0 ? d.frames[i - 1] : null;
    const at = fr => {
      const m = new Map();
      for (const x of parse(fr.sente)) m.set(x.sq, { ...x, owner: 'sente' });
      for (const x of parse(fr.gote)) m.set(x.sq, { ...x, owner: 'gote' });
      return m;
    };
    const cur = at(fr), before = prev ? at(prev) : null;
    const x0 = 0, y0 = M;
    let s = `<svg class="tj-svg" viewBox="0 0 ${cols * W + M} ${rows * H + M}" role="img" aria-label="${esc(fr.caption)}">`;
    for (let c = 0; c < cols; c++) s += `<text class="tj-co" x="${x0 + c * W + W / 2}" y="${M - 2}">${ZEN[f1 - c]}</text>`;
    for (let r = 0; r < rows; r++) s += `<text class="tj-co" x="${cols * W + M / 2}" y="${y0 + r * H + H / 2 + 1}">${KAN[r0 + r]}</text>`;
    s += `<rect class="tj-bg" x="${x0}" y="${y0}" width="${cols * W}" height="${rows * H}"/>`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sq = `${f1 - c}${r0 + r}`;
      const a = cur.get(sq), b = before && before.get(sq);
      const changed = before && ((a && a.p + a.owner) !== (b && b.p + b.owner));
      if (changed) s += `<rect class="tj-chg" x="${x0 + c * W}" y="${y0 + r * H}" width="${W}" height="${H}"/>`;
    }
    for (let c = 1; c < cols; c++) s += `<line class="tj-ln" x1="${x0 + c * W}" y1="${y0}" x2="${x0 + c * W}" y2="${y0 + rows * H}"/>`;
    for (let r = 1; r < rows; r++) s += `<line class="tj-ln" x1="${x0}" y1="${y0 + r * H}" x2="${x0 + cols * W}" y2="${y0 + r * H}"/>`;
    for (const x of cur.values()) {
      const c = f1 - +x.sq[0], r = +x.sq[1] - r0;
      const cx = x0 + c * W + W / 2, cy = y0 + r * H + H / 2;
      s += `<text class="tj-pc ${x.owner}${'と杏圭全馬龍'.includes(x.p) ? ' prom' : ''}" x="${cx}" y="${cy + 1}"` +
        `${x.owner === 'gote' ? ` transform="rotate(180 ${cx} ${cy})"` : ''}>${x.p}</text>`;
    }
    return s + '</svg>';
  }

  // ---------- 章立て ----------
  // 所属は各手筋の piece / role / onCastle から導くので、新しい手筋はデータに足すだけで章に入る。
  // 順は data/tesuji.js の並び（章コメントと対応）
  const CHAPTERS = [
    { id: 'ch-fu',      title: '歩の手筋',           test: t => !t.onCastle && t.piece === '歩' },
    { id: 'ch-koma',    title: '香・桂・銀・金の手筋', test: t => !t.onCastle && '香桂銀金'.includes(t.piece || '') },
    { id: 'ch-ogoma',   title: '角・飛の手筋',       test: t => !t.onCastle && '角飛馬龍'.includes(t.piece || '') },
    { id: 'ch-kuzushi', title: '囲いの崩し方',       test: t => !!t.onCastle && t.role !== 'defense', byCastle: true },
    { id: 'ch-uke',     title: '受けの手筋',         test: t => !!t.onCastle && t.role === 'defense' },
  ];

  // 囲いの表示名から括弧の別名（「美濃囲い（本美濃）」→「美濃囲い」）を落とす
  const castleName = id => String(K.catalog.nameOf('castle', id)).replace(/（[^）]*）/g, '');

  /**
   * TESUJI を章→（あれば）項→節の木に組み立てる。
   * 崩し方の項は対象の囲い（onCastle.ids / mirrorIds の先頭）で連続するものを束ねる。
   * ids の空いている節は直前の項に続く（＝データの並びで項が決まる）。
   * @returns {Array<{id,title,items:object[],subs:Array<{key,title,items:object[]}>|null}>}
   */
  function buildTree(tesuji) {
    const rest = new Set(tesuji);
    const chapters = [];
    for (const ch of CHAPTERS) {
      const items = tesuji.filter(t => {
        if (!rest.has(t) || !ch.test(t)) return false;
        rest.delete(t);
        return true;
      });
      if (!items.length) continue;
      let subs = null;
      if (ch.byCastle) {
        subs = [];
        for (const t of items) {
          const oc = t.onCastle || {};
          const key = (oc.ids && oc.ids[0]) || (oc.mirrorIds && oc.mirrorIds[0]) || null;
          const last = subs[subs.length - 1];
          if (last && (!key || last.key === key)) last.items.push(t);
          else subs.push({ key, title: key ? castleName(key) : 'その他の囲い', items: [t] });
        }
        if (subs.length === 1) subs = null;   // 項が1つだけなら章に節を直結する
      }
      chapters.push({ id: ch.id, title: ch.title, items, subs });
    }
    // どの章の条件にも合わない手筋（将来の追加）は「その他」へ
    const etc = tesuji.filter(t => rest.has(t));
    if (etc.length) chapters.push({ id: 'ch-etc', title: 'その他', items: etc, subs: null });
    return chapters;
  }

  class TesujiMode {
    /**
     * @param {HTMLElement} root .wiki（.wj-toc・.wj-main・.wj-toc-btn・.wj-scrim を持つ器）
     * @param {Kakoi.Repository} repo 出典の解決に使う
     * @param {{onGo:(id:string)=>void, onExit:()=>void}} cb 目次の遷移（tj= を書く）と「盤へ戻る」
     */
    constructor(root, repo, cb) {
      this.root = root;
      this.repo = repo;
      this.cb = cb || {};
      this.toc = root.querySelector('.wj-toc');
      this.main = root.querySelector('.wj-main');
      this.frame = new Map();   // 手筋 id → いま見ているコマ
      this._built = false;
      this._cur = null;         // 目次で現在地を示すリンク
      root.addEventListener('click', e => this._onClick(e));
      const btn = root.querySelector('.wj-toc-btn');
      if (btn) btn.addEventListener('click', () => this._tocToggle());
      const scrim = root.querySelector('.wj-scrim');
      if (scrim) scrim.addEventListener('click', () => this._tocClose());
      // Esc は盤へ戻る（about モーダルが開いている間はモーダル側の Esc に任せる）
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('tj')
            && !document.querySelector('dialog[open]') && this.cb.onExit) this.cb.onExit();
      });
    }

    /**
     * モードに入った・開く章・節が変わったときに呼ぶ。
     * @param {string|null} id 章・節・項の id（data-id）。なければ先頭へ
     * @param {boolean} [instant] 起動時などアニメ無しで飛ぶ
     */
    open(id, instant) {
      if (!this.root) return;
      this._build();
      if (id) this._reveal(id, instant);
      else {
        this.main.scrollTop = 0;
        this._mark(this.toc.querySelector('[data-go="top"]'));
      }
    }

    // ---------- 描画（初回だけ。データは静的） ----------
    _build() {
      if (this._built) return;
      this._built = true;
      const citer = makeCiter();
      const proverbs = new Map((K.PROVERBS || []).map(p => [p.id, p]));
      const srcAll = [];
      let doc = `<header class="wj-doc-h" data-id="top"><h1>手筋と格言</h1>` +
        `<p class="wj-lede">駒組み（囲い・戦法）とは別に、数手で完結する局所の技を集めた読み物です。` +
        `図は盤の一部だけを切り出し、▲が先手（下側）・△が後手（上側）です。歩の手筋はその筋に自分の歩が無い前提です（二歩の禁止）。</p></header>`;
      let toc = `<p class="wj-back"><button type="button" data-exit>← 囲い図鑑へ戻る</button></p>` +
        `<h2 class="wj-toc-h">目次</h2><ol class="wj-tree">` +
        `<li><a href="#tesuji" data-go="top"><span class="wn">§</span>手筋と格言</a></li>`;

      // 手筋1件の節（項の中では h4、章の直下では h3）
      const secHTML = (t, no, h) => {
        srcAll.push(...(t.sources || []));
        const desc = rich(t.desc, citer);
        const pv = (t.proverbs || []).map(id => proverbs.get(id)).filter(Boolean)
          .map(p => `<li><b>${esc(p.text)}</b>${rich(p.desc, citer)}</li>`).join('');
        const meta = [];
        if (t.piece) meta.push(`駒：${esc(t.piece)}`);
        if (t.aliases && t.aliases.length) meta.push(`別名：${t.aliases.map(esc).join('・')}`);
        if (t.onCastle) {
          const names = [...(t.onCastle.ids || []), ...(t.onCastle.mirrorIds || [])].map(castleName);
          if (names.length) meta.push(`対象：${[...new Set(names)].map(esc).join('・')}`);
        }
        const notes = [t.note, t.onCastle && t.onCastle.note].filter(Boolean)
          .map(n => `<p class="wj-note">${esc(n)}</p>`).join('');
        return `<section class="wj-sec" data-id="${esc(t.id)}">` +
          `<${h}><span class="wn">${no}</span>${esc(t.name)}<small>${esc(t.reading || '')}</small>` +
          `<span class="tj-role" data-role="${esc(t.role)}">${ROLE_JA[t.role] || ''}</span></${h}>` +
          (meta.length ? `<p class="wj-meta">${meta.join('　')}</p>` : '') +
          `<p class="desc">${desc}</p>` +
          `<figure class="tj-fig">${this._figure(t, this.frame.get(t.id) || 0)}</figure>` +
          notes +
          (pv ? `<h5 class="wj-mini-h">関連する格言</h5><ul class="tj-pv">${pv}</ul>` : '') +
          `</section>`;
      };
      const tocItem = (id, no, name) =>
        `<li><a href="#tesuji" data-go="${esc(id)}"><span class="wn">${no}</span>${esc(name)}</a></li>`;

      let cno = 0;
      for (const ch of buildTree(K.TESUJI || [])) {
        cno++;
        doc += `<section class="wj-ch" data-id="${esc(ch.id)}"><h2><span class="wn">${cno}</span>${esc(ch.title)}</h2>`;
        toc += `<li><a href="#tesuji" data-go="${esc(ch.id)}"><span class="wn">${cno}</span>${esc(ch.title)}</a><ol>`;
        if (ch.subs) {
          let sno = 0;
          for (const s of ch.subs) {
            sno++;
            const sid = `${ch.id}-${s.key || 'misc'}`;
            doc += `<section class="wj-sub" data-id="${esc(sid)}"><h3><span class="wn">${cno}.${sno}</span>${esc(s.title)}の崩し方</h3>`;
            toc += `<li><a href="#tesuji" data-go="${esc(sid)}"><span class="wn">${cno}.${sno}</span>${esc(s.title)}</a><ol>`;
            s.items.forEach((t, i) => {
              const no = `${cno}.${sno}.${i + 1}`;
              doc += secHTML(t, no, 'h4');
              toc += tocItem(t.id, no, t.name);
            });
            doc += `</section>`;
            toc += `</ol></li>`;
          }
        } else {
          ch.items.forEach((t, i) => {
            const no = `${cno}.${i + 1}`;
            doc += secHTML(t, no, 'h3');
            toc += tocItem(t.id, no, t.name);
          });
        }
        doc += `</section>`;
        toc += `</ol></li>`;
      }

      // 格言の章: PROVERB_GROUPS の節ごとに一覧（節単位で目次に載せる）
      const groups = K.PROVERB_GROUPS || [];
      const pvRest = new Set(K.PROVERBS || []);
      if ((K.PROVERBS || []).length) {
        cno++;
        doc += `<section class="wj-ch" data-id="ch-proverbs"><h2><span class="wn">${cno}</span>格言</h2>`;
        toc += `<li><a href="#tesuji" data-go="ch-proverbs"><span class="wn">${cno}</span>格言</a><ol>`;
        const pvGroups = [...groups.map(([gid, title]) => ({ gid, title })), { gid: 'etc', title: 'その他' }];
        let gno = 0;
        for (const g of pvGroups) {
          const items = g.gid === 'etc' ? [...pvRest] : (K.PROVERBS || []).filter(p => p.group === g.gid);
          for (const p of items) pvRest.delete(p);
          if (!items.length) continue;
          gno++;
          const sid = `pv-${g.gid}`;
          doc += `<section class="wj-sub" data-id="${esc(sid)}"><h3><span class="wn">${cno}.${gno}</span>${esc(g.title)}</h3>` +
            `<ul class="tj-pv wj-pv-all">` +
            items.map(p => `<li data-id="pv-${esc(p.id)}"><b>${esc(p.text)}</b>` +
              `<small>${esc(p.reading || '')}${p.alt && p.alt.length ? `（別名：${p.alt.map(esc).join('・')}）` : ''}</small>` +
              `${rich(p.desc, citer)}</li>`).join('') +
            `</ul></section>`;
          toc += tocItem(sid, `${cno}.${gno}`, g.title);
        }
        doc += `</section>`;
        toc += `</ol></li>`;
      }

      // 出典の章: 宣言の無い引用も拾って [n] を空振りさせない（格言は未宣言のことがある）
      {
        cno++;
        const declared = new Set(srcAll.map(s => s.ref));
        for (const t of K.TESUJI || []) for (const r of citeRefs(t.desc || ''))
          if (!declared.has(r)) { declared.add(r); srcAll.push({ ref: r, for: '本文' }); }
        for (const p of K.PROVERBS || []) {
          for (const r of citeRefs(p.desc || '')) if (!declared.has(r)) { declared.add(r); srcAll.push({ ref: r, for: '格言' }); }
          for (const s of p.sources || []) if (!declared.has(s.ref)) { declared.add(s.ref); srcAll.push(s); }
        }
        doc += `<section class="wj-ch" data-id="sources"><h2><span class="wn">${cno}</span>出典</h2>` +
          sourcesBlock(this.repo.resolveSources(srcAll), citer) + `</section>`;
        toc += tocItem('sources', `${cno}`, '出典');
      }
      toc += `</ol>`;

      this.toc.innerHTML = toc;
      this.main.innerHTML = `<article class="wj-doc">${doc}</article>`;
      this._observe();
    }

    // ---------- コマ送り: 図・手・一言だけを差し替える（本文や出典の番号は作り直さない） ----------
    _go(id, i) {
      const t = (K.TESUJI || []).find(x => x.id === id);
      const card = this.main.querySelector(`.wj-sec[data-id="${CSS.escape(id)}"]`);
      if (!t || !card) return;
      const n = t.diagram.frames.length;
      i = Math.max(0, Math.min(n - 1, i));
      this.frame.set(id, i);
      card.querySelector('.tj-fig').innerHTML = this._figure(t, i);
    }

    _figure(t, i) {
      const d = t.diagram, fr = d.frames[i], n = d.frames.length;
      const steps = d.frames.map((f, k) =>
        `<button type="button" class="tj-step" data-step="${k}" aria-pressed="${k === i}">${esc(f.move || '初形')}</button>`).join('');
      return diagramSVG(d, i) +
        `<figcaption><p class="tj-move">${esc(fr.move || '初形')}</p><p class="tj-cap">${esc(fr.caption)}</p>` +
        `<p class="tj-hand">先手の持ち駒：${esc(handText(fr.hand))}</p>` +
        (fr.handGote !== undefined ? `<p class="tj-hand">後手の持ち駒：${esc(handText(fr.handGote))}</p>` : '') +
        (d.turn === 'gote' ? '<p class="tj-hand">△後手の番から始まる図</p>' : '') +
        `<div class="tj-nav"><button type="button" class="ib txt" data-step="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="前の手">◀</button>` +
        `<span class="tj-steps">${steps}</span>` +
        `<button type="button" class="ib txt" data-step="${i + 1}" ${i === n - 1 ? 'disabled' : ''} aria-label="次の手">▶</button></div>` +
        `</figcaption>`;
    }

    _onClick(e) {
      const step = e.target.closest('[data-step]');
      if (step) { this._go(step.closest('[data-id]').dataset.id, +step.dataset.step); return; }
      const go = e.target.closest('[data-go]');
      if (go) {
        e.preventDefault();
        this._tocClose();
        // 目次からの遷移はハッシュに積む（「戻る」でひとつ前の節に戻れる）
        if (this.cb.onGo) this.cb.onGo(go.dataset.go);
        else this._reveal(go.dataset.go);
        return;
      }
      if (e.target.closest('[data-exit]') && this.cb.onExit) this.cb.onExit();
    }

    _reveal(id, instant) {
      const el = this.main.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.scrollIntoView({
        block: 'start',
        behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      el.dataset.reveal = 'true';
      setTimeout(() => { delete el.dataset.reveal; }, 1400);
    }

    // ---------- 目次の現在地: 本文の章・節・項を IntersectionObserver で追う ----------
    _observe() {
      const links = new Map([...this.toc.querySelectorAll('[data-go]')].map(a => [a.dataset.go, a]));
      const secs = [...this.main.querySelectorAll('[data-id]')].filter(el => links.has(el.dataset.id));
      if (!('IntersectionObserver' in window)) return;
      const visible = new Set();
      this._links = links;
      this._spy = new IntersectionObserver(es => {
        for (const e of es) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        if (!visible.size) return;
        let best = null;
        for (const el of visible) {
          if (!best || el.getBoundingClientRect().top < best.getBoundingClientRect().top) best = el;
        }
        this._mark(links.get(best.dataset.id));
      }, { rootMargin: '-12% 0px -72% 0px' });
      for (const el of secs) this._spy.observe(el);
    }

    _mark(link) {
      if (!link || link === this._cur) return;
      if (this._cur) this._cur.removeAttribute('aria-current');
      link.setAttribute('aria-current', 'true');
      this._cur = link;
      link.scrollIntoView({ block: 'nearest' });
    }

    // ---------- 狭い画面: 目次は左端から開くドロワー ----------
    _tocToggle() {
      const open = this.root.dataset.toc === 'open';
      this.root.dataset.toc = open ? '' : 'open';
      const btn = this.root.querySelector('.wj-toc-btn');
      if (btn) btn.setAttribute('aria-expanded', String(!open));
    }
    _tocClose() {
      if (this.root.dataset.toc !== 'open') return;
      this.root.dataset.toc = '';
      const btn = this.root.querySelector('.wj-toc-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  K.TesujiMode = TesujiMode;
  K.tesujiChapters = buildTree;   // 章立ての純関数（unit-test からも使う）
  K.tesujiDiagramSVG = diagramSVG;
})();
