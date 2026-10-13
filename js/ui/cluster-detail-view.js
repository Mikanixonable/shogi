// 分類マップの右: 選んだ囲い／系統の説明。何も選んでいなければ木の図の読み方
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const { esc } = Kakoi.html;

  class ClusterDetailView {
    /** @param {HTMLElement} el @param {{ onOpen:(id:string)=>void, onSelect:(id:string)=>void }} handlers */
    constructor(el, handlers) {
      this.el = el;
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-open]');
        if (b) return handlers.onOpen(b.dataset.open);
        const c = e.target.closest('button[data-id]');
        if (c) handlers.onSelect(c.dataset.id);
      });
    }

    /** @param {{ castle:?object, family:?object, ctx:object }} sel ctx: repo と model から作った読み取り用の関数群 */
    render({ castle, family }, ctx) {
      this.el.innerHTML = castle ? this._castle(castle, ctx) : family ? this._family(family, ctx) : this._help(ctx);
      this.el.scrollTop = 0;
    }

    _castle(c, ctx) {
      const fam = ctx.familyOf(c), sub = ctx.subtypeOf(c);
      const { mates, same, dominant } = ctx.match(c);
      const verdict = !mates.length ? '計算では、近い囲いのない単独のグループです'
        : same ? '計算でも同じ系統の囲いと近い' : `計算では${esc(ctx.familyName(dominant))}の囲いと近い`;
      return `<div class="cl-d">
        <div><h2 class="cl-d-t">${esc(c.name)}</h2>
          <div class="tags"><span class="tag group"><i class="cl-dot" data-family="${esc(c.family)}"></i> ${esc(fam.name)}</span>${sub ? `<span class="tag">${esc(sub.name)}</span>` : ''}</div></div>
        ${c.refFamily ? `<p class="note">文献上の分類：${esc(c.refFamily)}</p>` : ''}
        <button class="cl-open" data-open="${esc(c.id)}">囲い図鑑で開く</button>
        <div class="sec"><h3>計算上のグループ</h3>
          <p class="desc">${verdict}。</p>
          ${mates.length ? `<div class="cl-chips ro">${mates.map(m => `<span class="cl-chip" data-family="${esc(m.family)}"><i class="cl-dot"></i>${esc(m.short)}</span>`).join('')}</div>` : ''}</div>
        <div class="sec"><h3>形の近い囲い</h3>
          <ol class="cl-near">${ctx.nearest(c.id).map(n => `<li><button data-id="${esc(n.castle.id)}" class="cl-near-b"><i class="cl-dot" data-family="${esc(n.castle.family)}"></i><span>${esc(n.castle.short)}</span><em>${n.d.toFixed(2)}</em></button></li>`).join('')}</ol>
          <p class="note">数字は形の距離（小さいほど近い。0は左右反転で同じ形）</p></div>
      </div>`;
    }

    _family(f, ctx) {
      const members = ctx.membersOf(f.id);
      const t = ctx.together(f.id);
      const bySub = f.subtypes.length
        ? f.subtypes.map(s => ({ name: s.name, list: members.filter(c => c.subtype === s.id) })).filter(g => g.list.length)
        : [{ name: null, list: members }];
      return `<div class="cl-d">
        <div><h2 class="cl-d-t"><i class="cl-dot" data-family="${esc(f.id)}"></i> ${esc(f.name)}</h2><p class="desc">${esc(f.shape)}</p></div>
        <div class="sec"><h3>計算との一致</h3>
          <p class="desc">${t.total}件の囲いのうち、${t.together}件を計算でも同じグループにまとめました${t.together === t.total ? '。' : `（残りは別のグループ。${t.groups}グループにまたがる）。`}</p></div>
        <div class="sec"><h3>タイプと所属</h3>${bySub.map(g => `<div class="cl-sub">${g.name ? `<b>${esc(g.name)}</b>` : ''}<div class="cl-chips">${g.list.map(c =>
          `<button class="cl-chip" data-id="${esc(c.id)}" data-family="${esc(c.family)}">${esc(c.short)}</button>`).join('')}</div></div>`).join('')}</div>
      </div>`;
    }

    _help(ctx) {
      return `<div class="cl-d">
        <h2 class="cl-d-t">木の図の読み方</h2>
        <div class="sec"><h3>近さの測り方</h3>
          <p class="desc">玉からの相対位置で金・銀などの駒を対応づけ、位置のずれの合計と、駒の種類の違い、玉の位置の差を足して「形の距離」にしています。振り飛車の囲いは左右を反転して比べます。</p></div>
        <div class="sec"><h3>枝と葉</h3>
          <p class="desc">右端の葉がひとつひとつの囲いで、色はこのアプリの作者による系統の分類です（文献の分類そのものではありません）。左へたどるほど大きな束に合流し、合流する位置が左に寄るほど形が離れています。縦の破線は、計算上の${ctx.k}グループに切る位置です。</p></div>
        <div class="sec"><h3>一致度（ARI）＝${ctx.ari.toFixed(2)}</h3>
          <p class="desc">作者の系統分けと、計算で同じ数（${ctx.k}グループ）に切った結果の一致度です。1なら完全に一致、0なら偶然と同程度。値が低いのは、形が近くても系統が違う囲いがあるためです。</p></div>
        <p class="note">葉や左の囲い名を選ぶと、ここに詳しく表示されます。</p>
      </div>`;
    }
  }

  Kakoi.ClusterDetailView = ClusterDetailView;
})();
