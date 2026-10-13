// 対局図の右パネル: 戦型・重視する強み（重みのペンタグラム）・対戦相性・組み合わせの理由・出典を一続きに。
// 幾何は detail-view.js の特徴ペンタグラムと同じ（正五角形・5軸）。計画書 §6
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, sqAttr, rich, makeCiter, sourcesBlock, bindCites } = K.html;
  const { label } = K.notation;

  // 強みの5軸（detail-view.js と同じ順・同じ頂点配置）
  const RATINGS = [
    ['hard', '堅さ'],
    ['wide', '玉の広さ'],
    ['top', '上部の強さ'],
    ['side', '横の強さ'],
    ['quick', '組みやすさ'],
  ];
  const RADAR = { cx: 102, cy: 74, r: 42, viewBox: '0 0 200 136' };
  const RADAR_LABEL = [
    [0, -12, 'middle'],
    [10, -3, 'start'],
    [4, 18, 'middle'],
    [-4, 18, 'middle'],
    [-10, -3, 'end'],
  ];
  const vertex = (i, rad) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [RADAR.cx + rad * Math.cos(a), RADAR.cy + rad * Math.sin(a)];
  };
  const num = n => Math.round(n * 10) / 10;
  const sqLabel = s => label(+s[0], +s[1]);

  class MatchupDetailView {
    /**
     * @param {HTMLElement} el `#matchupDetail`（.detail-body）
     * @param {{ onHover:(squares:string[], tone:string)=>void }} handlers
     */
    constructor(el, { onHover }) {
      this.el = el;
      el.addEventListener('mouseover', e => {
        const t = e.target.closest('[data-sq]');
        if (t) onHover(t.dataset.sq.split(' '), t.dataset.tone || 'focus');
      });
      el.addEventListener('mouseout', e => {
        const t = e.target.closest('[data-sq]');
        if (t && !t.contains(e.relatedTarget)) onHover([], null);
      });
      bindCites(el); // 本文の [n] ホバーで出典リストの行を強調
    }

    /**
     * @param {{ me:object, opp:object, show:{opp:boolean, threat:boolean}, threat:?object,
     *   fit:?number, meTactic:?object, meCastle:?object, oppTactic:?object, oppCastle:?object,
     *   meLabel:string, oppLabel:string, pairing:?object, trio:Array, contacts:Array,
     *   flexed:Array, sources:Array }} d モードが組み立てた表示用データ
     */
    render(d) {
      const citer = makeCiter(); // このパネル内で出現順の番号を振る
      this.el.innerHTML = [
        this._head(d),
        d.show.opp && d.threat ? this._weights(d) : '',
        d.show.opp && d.fit != null ? this._fitness(d) : '',
        this._reasons(d, citer),
        this._sources(d, citer),
      ].filter(Boolean).join('');
    }

    // 戦型の大見出しと、自分／相手の3層の併記
    _head(d) {
      const trio = (lab, t, c) => `${lab}：${t ? t.name : '―'}・${c ? c.short : '―'}`;
      const dist = d.threat && d.threat.distance != null
        ? `<p class="note">自分の玉と相手の飛車の距離は ${d.threat.distance}筋。` +
          (d.threat.distance <= 2 ? '近い＝縦（上部）から攻められやすい'
            : d.threat.distance >= 4 ? '遠い＝横から回り込まれやすい' : '縦と横の両方を意識する') + '</p>'
        : (d.show.opp ? '' : '<p class="note">相手の駒組みを表示すると、戦型と対戦相性を評価します。</p>');
      return `<div><h2 class="mu-kind">${esc(d.threat ? d.threat.label : '対局図')}</h2>` +
        `<p class="mu-kind-sub">${esc(trio(d.meLabel, d.meTactic, d.meCastle))}` +
        `<span class="x"> 対 </span>${d.show.opp ? esc(trio(d.oppLabel, d.oppTactic, d.oppCastle)) : '（非表示）'}</p></div>${dist}`;
    }

    // 戦型の重み（朱の破線）と、いまの自分の囲いの強み（墨）を同じ五角形に重ねる（計画書 §6）
    _weights(d) {
      const w = d.threat.weights || {};
      const wpts = RATINGS.map(([k], i) =>
        vertex(i, RADAR.r * Math.min(5, (w[k] || 0) * 10) / 5).map(num).join(',')).join(' ');
      const r = (d.meCastle && d.meCastle.ratings) || {};
      const rpts = RATINGS.map(([k], i) =>
        vertex(i, RADAR.r * Math.min(5, Math.max(0, r[k] || 0)) / 5).map(num).join(',')).join(' ');
      const rings = [1, 2, 3, 4, 5].map(l =>
        `<polygon class="penta-ring${l === 5 ? ' edge' : ''}" points="${RATINGS.map((_, i) => vertex(i, RADAR.r * l / 5).map(num).join(',')).join(' ')}"/>`).join('');
      const spokes = RATINGS.map((_, i) => {
        const [x, y] = vertex(i, RADAR.r).map(num);
        return `<line class="penta-spoke" x1="${RADAR.cx}" y1="${RADAR.cy}" x2="${x}" y2="${y}"/>`;
      }).join('');
      const labels = RATINGS.map(([k, name], i) => {
        const [x, y] = vertex(i, RADAR.r).map(num);
        const [dx, dy, anchor] = RADAR_LABEL[i];
        return `<text class="penta-lbl" x="${num(x + dx)}" y="${num(y + dy)}" text-anchor="${anchor}"><title>${name} 重み${(w[k] || 0).toFixed(2)}</title>${name}</text>`;
      }).join('');
      return `<div class="sec"><h3>重視する強み<small>朱の破線＝この戦型で効く軸・墨＝囲いの強み</small></h3>` +
        `<svg class="penta" viewBox="${RADAR.viewBox}" role="img" aria-label="重視する強み（5軸）">` +
        `${rings}${spokes}<polygon class="penta-val" points="${rpts}"/><polygon class="mu-w" points="${wpts}"/>${labels}</svg></div>`;
    }

    // 対戦相性スコアと、効く軸のチップ（計画書 §6「#縦に強い 上部5」の意匠）
    _fitness(d) {
      const w = d.threat.weights || {};
      const ratings = (d.meCastle && d.meCastle.ratings) || {};
      const chips = RATINGS
        .filter(([k]) => (w[k] || 0) >= .25)
        .map(([k, n]) => `<span class="tag">#${esc(n)} ${ratings[k] != null ? ratings[k] : '―'}/5</span>`).join('');
      const notes = (d.flexed || []).map(fx =>
        `<li><span class="mk">＋</span><span>${esc(fx.piece)}を${esc(sqLabel(fx.from))}から${esc(sqLabel(fx.to))}へ回す崩し形</span></li>`).join('');
      return `<div class="sec"><h3>対戦相性</h3>` +
        `<p class="mu-fit">${d.fit.toFixed(2)}<small>戦型の重み × 囲いの強み</small></p>` +
        (chips ? `<div class="tags">${chips}</div>` : '') +
        (notes ? `<ul class="mu-reasons">${notes}</ul>` : '') + `</div>`;
    }

    // 組み合わせの理由: 相性表の説明・現在の3層の compat.judge の理由・両軍の接触。
    // 同じ文は重複させない。マスのある理由は乗せると盤で光る
    _reasons(d, citer) {
      const items = [];
      if (d.pairing && d.pairing.why) items.push({ level: d.pairing.level === 'ng' ? 'ng' : 'ok', text: `${d.pairing.why}（相性表）` });
      for (const t of d.trio || []) {
        for (const r of (t.judge ? t.judge.reasons : [])) {
          if (r.code === 'PAIRING') continue;   // 相性表の文は pairing.why の項目で既に載せる（二重表示を防ぐ）
          items.push({ level: t.judge.level === 'ng' ? 'ng' : 'ok', text: r.text, squares: r.squares });
        }
      }
      for (const c of d.contacts || []) {
        items.push({ level: c.kind === 'ng' ? 'ng' : 'ok', squares: [c.sq],
          text: c.text || `${sqLabel(c.sq)}で両軍が接触` });
      }
      const seen = new Set();
      const li = items.filter(it => it.text && !seen.has(it.text) && seen.add(it.text))
        .map(it => `<li data-level="${it.level}" data-tone="${it.level === 'ng' ? 'bad' : 'focus'}"${sqAttr(it.squares)}>` +
          `<span class="mk">${it.level === 'ng' ? '×' : '＋'}</span><span>${rich(it.text, citer)}</span></li>`).join('');
      return `<div class="sec"><h3>組み合わせの理由<small>点線の項目は盤上に表示</small></h3>` +
        `<ul class="mu-reasons">${li || '<li data-level="ok"><span class="mk">＋</span><span>盤上で両立する組み合わせです</span></li>'}</ul></div>`;
    }

    _sources(d, citer) {
      if (!d.sources || !d.sources.length) return '';
      return `<div class="sec"><h3>出典<small>組み合わせ</small></h3>${sourcesBlock(d.sources, citer)}</div>`;
    }
  }

  K.MatchupDetailView = MatchupDetailView;
})();
