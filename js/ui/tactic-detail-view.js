// 戦法モードの右の解説: タグ・説明・長所短所・主役の駒の動き・相性のよい囲い・出典を一続きに
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;
  const { esc } = Kakoi.html;

  class TacticDetailView {
    /**
     * @param {HTMLElement} el `#tacticDetail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:?string)=>void,
     *   onCastle:(id:string)=>void, onToggle:(id:string)=>void }} handlers
     *   onToggle: 囲いを盤に重ねる／外す。onCastle: 「→」で囲いの画面へ移る
     */
    constructor(el, handlers) {
      this.body = el;
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) handlers.onHover(t.dataset.sq.split(' '), 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) handlers.onHover([], null);
      });
      el.addEventListener('click', e => {
        const go = e.target.closest('.tc-go');
        if (go) { handlers.onCastle(go.dataset.id); return; }
        const b = e.target.closest('.tc-castle');
        if (b) handlers.onToggle(b.dataset.id);
      });
    }

    /**
     * @param {object} tactic
     * @param {{ family:object, castleId:?string,
     *   castles:{id:string,name:string,familyName:string,desc:string}[], sources:object[] }} info
     *   castleId: 盤に重ねている囲い（出典は戦法＋囲いの併記が渡される）
     */
    render(tactic, { family, castles, castleId, sources }) {
      this.body.innerHTML = [
        this._tags(tactic, family),
        `<p class="desc">${esc(tactic.desc)}</p>`,
        tactic.note ? `<p class="note">${esc(tactic.note)}</p>` : '',
        this._list('長所', tactic.pros, ''),
        this._list('短所', tactic.cons, 'cons'),
        this._route(tactic),
        this._castles(castles, castleId),
        this._sources(sources),
      ].filter(Boolean).join('');
    }

    // #ハッシュタグ表記（装飾のみ・クリック不可）
    _tags(t, family) {
      const tags = [t.context, ...(t.aliases || []).map(a => `別名：${a}`)].filter(Boolean);
      return `<div class="tags"><span class="tag group">#${esc(family.name)}</span>${tags.map(x => `<span class="tag">#${esc(x)}</span>`).join('')}</div>`;
    }

    _list(title, items, cls) {
      if (!items || !items.length) return '';
      return `<div class="sec"><h3>${title}</h3><ul class="pc-list ${cls}">${items.map(it => `<li>${esc(it.t)}</li>`).join('')}</ul></div>`;
    }

    // 経路を「▲３九銀 → ３八 → …」の手順にし、各マスに乗せると盤で光る
    _route(t) {
      const sq = s => label(+s[0], +s[1]);
      const steps = t.route.map((s, i) =>
        `<li class="rt-step" data-sq="${s}">${i === 0 ? `▲${sq(s)}${esc(t.lead.piece)}` : sq(s)}</li>`).join('');
      const last = t.route[t.route.length - 1];
      const text = t.route.length > 1
        ? `主役の${t.lead.piece}は、最終的に${sq(last)}に立ちます。`
        : `主役の${t.lead.piece}は、初期位置の${sq(last)}のまま動きません。`;
      return `<div class="sec"><h3>主役の駒の動き<small>マスに乗せると盤で光る</small></h3><ol class="rt-steps">${steps}</ol></div>` +
        `<p class="desc">${esc(text)}</p>` +
        (/推定/.test(t.note || '') ? '<p class="note">経路の途中のマスは推定です。</p>' : '');
    }

    // 囲い名を押すと盤に重なり（もう一度押すと解除）、横の「→」で囲いの画面へ移る
    _castles(castles, castleId) {
      if (!castles.length) return '<p class="note">データ上の対応する囲いはありません</p>';
      const rows = castles.map(c => {
        const on = c.id === castleId;
        return `<div class="tc-row"><button class="tc-castle" data-id="${esc(c.id)}" aria-pressed="${on}">` +
          `<b>${esc(c.name)}</b><span>${esc(c.familyName)}</span></button>` +
          `<button class="tc-go" data-id="${esc(c.id)}" title="${esc(c.name)}を囲いの画面で見る" aria-label="${esc(c.name)}を囲いの画面で見る">→</button></div>`;
      }).join('');
      const sel = castles.find(c => c.id === castleId);
      const note = sel ? `<p class="desc tc-desc"><b>${esc(sel.name)}</b>：${esc(sel.desc)}</p>` : '';
      return `<div class="sec"><h3>相性のよい囲い<small>押すと盤に重ねる。「→」は囲いの画面へ</small></h3><div class="tc-castles">${rows}</div>${note}</div>`;
    }

    _sources(sources) {
      const li = sources.map(s =>
        `<li><span class="cv">${esc(s.for)}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>（${esc(s.publisher)}）</span></li>`).join('');
      return `<div class="sec"><h3>出典</h3><ul class="sources">${li}</ul></div>`;
    }
  }

  Kakoi.TacticDetailView = TacticDetailView;
})();
