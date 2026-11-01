// 「手筋と格言」モーダル: data/tesuji.js の手筋を、盤の一部を切り出した図と手順のコマ送りで見せるコラム。
// 末尾に格言の一覧と出典。open(id) でその手筋の項目までスクロールして開く。
// 開閉は about-modal と同じく <dialog> に任せる（Esc・背景クリック・×ボタン）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, rich, makeCiter, sourcesBlock } = K.html;
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

  class TesujiModal {
    /**
     * @param {HTMLButtonElement|null} openBtn ヘッダーの開くボタン
     * @param {HTMLDialogElement|null} dlg モーダル本体（.tj-body を持つ）
     * @param {Kakoi.Repository} repo 出典の解決に使う
     */
    constructor(openBtn, dlg, repo) {
      this.dlg = dlg;
      this.repo = repo;
      this.frame = new Map();   // 手筋 id → いま見ているコマ
      if (!dlg) return;
      this.body = dlg.querySelector('.tj-body');
      if (openBtn) openBtn.addEventListener('click', () => this.open());
      dlg.addEventListener('click', e => {
        if (e.target === dlg) { dlg.close(); return; }
        const step = e.target.closest('[data-step]');
        if (step) { this._go(step.closest('.tj-card').dataset.id, +step.dataset.step); return; }
        const jump = e.target.closest('[data-jump]');
        if (jump) { e.preventDefault(); this._reveal(jump.dataset.jump); }
      });
      for (const b of dlg.querySelectorAll('[data-close]')) b.addEventListener('click', () => dlg.close());
    }

    /** @param {string} [id] 開いたあとスクロールする手筋の id（'proverbs' で格言の一覧） */
    open(id) {
      if (!this.dlg) return;
      this._render();
      if (!this.dlg.open) this.dlg.showModal();
      if (id) this._reveal(id);
      else this.body.scrollTop = 0;
    }

    _reveal(id) {
      const el = this.body.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.dataset.reveal = 'true';
      setTimeout(() => { delete el.dataset.reveal; }, 1400);
    }

    // コマ送り: 図・手・一言だけを差し替える（本文や出典の番号は作り直さない）
    _go(id, i) {
      const t = (K.TESUJI || []).find(x => x.id === id);
      const card = this.body.querySelector(`.tj-card[data-id="${CSS.escape(id)}"]`);
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

    _render() {
      const citer = makeCiter();
      const proverbs = new Map((K.PROVERBS || []).map(p => [p.id, p]));
      const all = [];
      const toc = (K.TESUJI || []).map(t =>
        `<a class="vchip" href="#" data-jump="${esc(t.id)}">${esc(t.name)}</a>`).join('') +
        `<a class="vchip" href="#" data-jump="proverbs">格言</a>`;
      const cards = (K.TESUJI || []).map(t => {
        all.push(...(t.sources || []));
        // 出典の番号は出現順なので、本文 → 格言 の順に組み立てる
        const desc = rich(t.desc, citer);
        const pv = (t.proverbs || []).map(id => proverbs.get(id)).filter(Boolean)
          .map(p => `<li><b>${esc(p.text)}</b>${rich(p.desc, citer)}</li>`).join('');
        return `<article class="tj-card" data-id="${esc(t.id)}">` +
          `<h3>${esc(t.name)}<small>${esc(t.reading)}</small><span class="tj-role" data-role="${esc(t.role)}">${ROLE_JA[t.role] || ''}</span></h3>` +
          `<p class="desc">${desc}</p>` +
          `<figure class="tj-fig">${this._figure(t, this.frame.get(t.id) || 0)}</figure>` +
          (pv ? `<ul class="tj-pv">${pv}</ul>` : '') +
          `</article>`;
      }).join('');
      const pvAll = (K.PROVERBS || []).map(p => {
        all.push(...(p.sources || []));
        return `<li><b>${esc(p.text)}</b><small>${esc(p.reading)}</small>${rich(p.desc, citer)}</li>`;
      }).join('');
      this.body.innerHTML =
        `<p class="note">駒組み（囲い・戦法）とは別に、数手で完結する局所の技を集めたコラムです。` +
        `図は盤の一部だけを切り出し、▲が先手（下側）・△が後手（上側）です。歩の手筋はその筋に自分の歩が無い前提です（二歩の禁止）。</p>` +
        `<nav class="vchips tj-toc" aria-label="目次">${toc}</nav>` +
        cards +
        `<section class="tj-proverbs" data-id="proverbs"><h3>格言</h3><ul class="tj-pv">${pvAll}</ul></section>` +
        `<section class="sec"><h3>出典</h3>${sourcesBlock(this.repo.resolveSources(all), citer)}</section>`;
    }
  }

  K.TesujiModal = TesujiModal;
  K.tesujiDiagramSVG = diagramSVG;
})();
