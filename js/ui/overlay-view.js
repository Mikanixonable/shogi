// 盤の重ね表示: 筋道（手順）の矢印は SVG で、
// 脅威の帯（筋まるごとの薄い朱色）と接触の印（◆）は HTML 層で盤に重ねる
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  /** マス "39" の中心（viewBox は 9×9、1マス=1） */
  const center = sq => ({ x: 9 - +sq[0] + .5, y: +sq[1] - .5 });
  /** マス "39" の中心（HTML 層の百分率座標。盤全体 = 100%） */
  const pct = sq => ({ x: (9 - +sq[0] + .5) / 9 * 100, y: (+sq[1] - .5) / 9 * 100 });

  const MARKER_BODY = 'viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth=".42" markerHeight=".42" orient="auto"';
  const HEAD_D = 'd="M0 0L10 5L0 10L3 5z"';

  class OverlayView {
    /** @param {HTMLElement} boardEl position:relative の盤。squares の再描画では消えない兄弟として追加する */
    constructor(boardEl) {
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.setAttribute('class', 'overlay');
      this.svg.setAttribute('viewBox', '0 0 9 9');
      this.svg.setAttribute('preserveAspectRatio', 'none');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.innerHTML =
        '<defs>' +
        `<marker id="rtHead" ${MARKER_BODY}><path class="rt-head" ${HEAD_D}/></marker>` +
        `<marker id="rtHeadGood" ${MARKER_BODY}><path class="rt-head rt-hg" ${HEAD_D}/></marker>` +
        `<marker id="rtHeadBad" ${MARKER_BODY}><path class="rt-head rt-hb" ${HEAD_D}/></marker>` +
        `<marker id="rtHeadInk" ${MARKER_BODY}><path class="rt-head rt-hi" ${HEAD_D}/></marker>` +
        '</defs>' +
        '<g class="rt-g"></g>';
      this.routeLayer = this.svg.querySelector('.rt-g');
      this.throughSvg = document.createElementNS(NS, 'svg');
      this.throughSvg.setAttribute('class', 'overlay overlay-through');
      this.throughSvg.setAttribute('viewBox', '0 0 9 9');
      this.throughSvg.setAttribute('preserveAspectRatio', 'none');
      this.throughSvg.setAttribute('aria-hidden', 'true');
      this.throughSvg.innerHTML = '<g class="rt-through-g"></g>';
      this.throughLayer = this.throughSvg.querySelector('.rt-through-g');

      // 脅威の帯はマスの下（盤面の木目の上、駒とグリッド線・ヒートの下）に置く。
      // .sq は container-type で自分の重なり順を持つので、帯をマスの内側と外側で
      // 分けることはできない。.squares より前の兄弟なら駒の後ろに必ず収まる
      this.threatLayer = document.createElement('div');
      this.threatLayer.className = 'ov-threats';
      this.threatLayer.setAttribute('aria-hidden', 'true');
      const squares = boardEl.querySelector('.squares');
      boardEl.insertBefore(this.threatLayer, squares || boardEl.firstChild);
      // 接触の印は最前面（矢印・骨格線より上）
      this.contactLayer = document.createElement('div');
      this.contactLayer.className = 'ov-contacts';
      this.contactLayer.setAttribute('aria-hidden', 'true');
      boardEl.appendChild(this.svg);
      boardEl.appendChild(this.throughSvg);
      boardEl.appendChild(this.contactLayer);
    }

    /**
     * マスの列を結ぶ破線の矢印を複数描く。null/[] で消す
     * @param {Array<{squares:string[], tone?:'good'|'bad'|'ink'|'lead'}>|null} list
     *   squares 例: ['39','38','27','26']。tone: 'good'=緑、'bad'=朱、'ink'=墨、それ以外（'lead' 含む）=主役の朱
     */
    routes(list) {
      this.routeLayer.replaceChildren();
      this.throughLayer.replaceChildren();
      if (!list || !list.length) return;
      let html = '', throughHtml = '';
      for (const rt of list) {
        const squares = rt && rt.squares;
        if (!squares || squares.length < 2) continue;
        const pts = squares.map(center);
        const end = pts[pts.length - 1], prev = pts[pts.length - 2];
        const dx = end.x - prev.x, dy = end.y - prev.y;
        const length = Math.hypot(dx, dy);
        if (length) {
          const inset = Math.min(.42, length * .45);
          end.x -= dx / length * inset;
          end.y -= dy / length * inset;
        }
        const points = pts.map(c => `${c.x},${c.y}`).join(' ');
        const cls = rt.tone === 'good' ? ' rt-good' : rt.tone === 'bad' ? ' rt-bad' : rt.tone === 'ink' ? ' rt-ink' : '';
        const mk = rt.tone === 'good' ? 'rtHeadGood' : rt.tone === 'bad' ? 'rtHeadBad' : rt.tone === 'ink' ? 'rtHeadInk' : 'rtHead';
        html += `<polyline class="rt rt-line${cls}" points="${points}" marker-end="url(#${mk})"/>`;
        throughHtml += `<polyline class="rt rt-line${cls}" points="${points}"/>`;
      }
      this.routeLayer.innerHTML = html;
      this.throughLayer.innerHTML = throughHtml;
    }

    /**
     * 脅威の帯: 筋まるごと薄い朱色の帯を引く（相手の飛車の筋・主役の経路の終点の筋）。
     * マスと駒の下、盤面の木目の上に置く。null/[] で消す
     * @param {number[]|null} files 筋番号 1..9（先手から見た絶対座標）
     */
    threat(files) {
      this.threatLayer.replaceChildren();
      if (!files || !files.length) return;
      for (const f of files) {
        if (!Number.isInteger(f) || f < 1 || f > 9) continue;
        const el = document.createElement('div');
        el.className = 'ov-threat';
        el.dataset.file = f;
        el.style.left = `${(9 - f) / 9 * 100}%`;
        this.threatLayer.appendChild(el);
      }
    }

    /**
     * 接触の印: 両軍の駒がぶつかったマスに小さな ◆ を置く。null/[] で消す
     * @param {Array<{sq:string, kind?:'pawn'|'piece'|'ng'}>|null} list  sq 例 '35'
     *   kind: 'pawn'/'piece' は墨の中立印、'ng' は朱（両立しない重なり）
     */
    contacts(list) {
      this.contactLayer.replaceChildren();
      if (!list || !list.length) return;
      for (const c of list) {
        if (!c || typeof c.sq !== 'string' || c.sq.length < 2) continue;
        const p = pct(c.sq);
        if (isNaN(p.x) || isNaN(p.y)) continue;
        const el = document.createElement('div');
        el.className = 'ov-contact';
        el.dataset.kind = c.kind || 'piece';
        el.dataset.sq = c.sq;
        el.style.left = `${p.x}%`;
        el.style.top = `${p.y}%`;
        this.contactLayer.appendChild(el);
      }
    }
  }

  Kakoi.OverlayView = OverlayView;
})();
