// 戦法モードの右の解説: タグ・説明・長所短所・主役の駒の動き・相性のよい囲い・出典を一続きに
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { label } = Kakoi.notation;
  const { esc } = Kakoi.html;

  class TacticDetailView {
    /**
     * @param {HTMLElement} el `#tacticDetail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:?string)=>void, onCastle:(id:string)=>void }} handlers
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
        const b = e.target.closest('.tc-castle');
        if (b) handlers.onCastle(b.dataset.id);
      });
    }

    /**
     * @param {object} tactic
     * @param {{ family:object, castles:{id:string,name:string,familyName:string}[], sources:object[] }} info
     */
    render(tactic, { family, castles, sources }) {
      this.body.innerHTML = [
        this._tags(tactic, family),
        `<p class="desc">${esc(tactic.desc)}</p>`,
        tactic.note ? `<p class="note">${esc(tactic.note)}</p>` : '',
        this._list('長所', tactic.pros, ''),
        this._list('短所', tactic.cons, 'cons'),
        this._route(tactic),
        this._castles(castles),
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

    _castles(castles) {
      if (!castles.length) return '<p class="note">データ上の対応する囲いはありません</p>';
      const btns = castles.map(c =>
        `<button class="tc-castle" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.familyName)}</span></button>`).join('');
      return `<div class="sec"><h3>相性のよい囲い<small>押すと囲いの画面へ</small></h3><div class="tc-castles">${btns}</div></div>`;
    }

    _sources(sources) {
      const li = sources.map(s =>
        `<li><span class="cv">${esc(s.for)}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>（${esc(s.publisher)}）</span></li>`).join('');
      return `<div class="sec"><h3>出典</h3><ul class="sources">${li}</ul></div>`;
    }
  }

  Kakoi.TacticDetailView = TacticDetailView;
})();
