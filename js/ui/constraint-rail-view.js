// 統合画面の左ドック（暫定。U4 でタイル化・上下分割に置き換わる）:
// 「相手」「自分」の2ブロックを縦に並べ、各ブロックに戦略の Segmented＋戦法一覧＋囲い一覧を出す。
// 選択はすべて constraints.apply/preview に通す前提で、候補には2軸のバッジを付ける（計画書 §3-1）:
//   整合: preview で他の層が変わる選択肢 → 破線の枠＋右肩に「→要約」
//   対敵: compat.judge().vs → ◎（good・朱の左帯）/ △（bad・理由は title）/ 印なし（neutral・相手なし）
// ホバーすると変更される予定の制約を親へ知らせる（onPreview。制約バーの点滅・盤のマス表示に使う）。
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';
  const K = window.Kakoi;
  const { esc, plain } = K.html;
  const SIDES = [['ibisha', '居飛車'], ['furibisha', '振り飛車']];
  const VS_MARK = { good: '◎', bad: '△', neutral: '' };
  const LAYER_JA = { strategy: '戦略', tactic: '戦法', castle: '囲い' };
  const FIELD = { strategy: 'strategy', tactic: 'tacticId', castle: 'castleId' };

  const nameOf = (kind, id) => {
    if (id == null) return '（なし）';
    if (kind === 'strategy') return (K.STRATEGIES[id] && K.STRATEGIES[id].label) || id;
    const x = kind === 'tactic' ? (K.TACTICS || []).find(t => t.id === id) : (K.CASTLES || []).find(c => c.id === id);
    return x ? x.name : id;
  };

  class ConstraintRailView {
    /**
     * @param {HTMLElement} el `#pickRail`
     * @param {{ onChoose:(who:'me'|'opp', kind:string, id:string)=>void,
     *   onRemoveSide:(who:string)=>void, onShow:(key:'threat', on:boolean)=>void,
     *   onPreview:(who:string, kind:string, id:string)=>void, onPreviewEnd:()=>void }} handlers
     */
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers;
      el.innerHTML =
        `<section class="cr-side" data-side="opp">
          <h3 class="cr-h">相手<small>後手</small>
            <button type="button" class="cr-clear" data-clear="opp" hidden>はずす</button>
            <label class="switch"><input type="checkbox" data-show="threat"> 脅威の帯</label>
          </h3>
          <div class="cr-empty" data-role="opp-empty">選ぶと相手の駒組みが盤に現れます</div>
          <div class="seg wide" data-role="seg-opp">
            <button data-value="ibisha">居飛車</button><button data-value="furibisha">振り飛車</button>
          </div>
          <h4 class="cr-sub">戦法</h4><div class="cr-list" data-role="list-tactic-opp"></div>
          <h4 class="cr-sub">囲い</h4><div class="cr-list" data-role="list-castle-opp"></div>
        </section>
        <section class="cr-side" data-side="me">
          <h3 class="cr-h">自分<small>先手</small></h3>
          <div class="seg wide" data-role="seg-me">
            <button data-value="ibisha">居飛車</button><button data-value="furibisha">振り飛車</button>
          </div>
          <h4 class="cr-sub">戦法</h4><div class="cr-list" data-role="list-tactic-me"></div>
          <h4 class="cr-sub">囲い</h4><div class="cr-list" data-role="list-castle-me"></div>
        </section>`;
      this.els = {
        oppClear: el.querySelector('[data-clear="opp"]'),
        oppEmpty: el.querySelector('[data-role="opp-empty"]'),
        swThreat: el.querySelector('[data-show="threat"]'),
      };
      this.seg = {
        me: new K.Segmented(el.querySelector('[data-role="seg-me"]'), v => handlers.onChoose('me', 'strategy', v)),
        opp: new K.Segmented(el.querySelector('[data-role="seg-opp"]'), v => handlers.onChoose('opp', 'strategy', v)),
      };
      el.addEventListener('click', e => {
        const clear = e.target.closest('[data-clear]');
        if (clear) { handlers.onRemoveSide(clear.dataset.clear); return; }
        const b = e.target.closest('.cr-item');
        if (b) handlers.onChoose(b.dataset.who, b.dataset.kind, b.dataset.id);
      });
      const light = e => {
        const b = e.target.closest('.cr-item');
        if (b && handlers.onPreview) handlers.onPreview(b.dataset.who, b.dataset.kind, b.dataset.id);
      };
      const unlight = e => {
        const b = e.target.closest('.cr-item');
        if (b && !b.contains(e.relatedTarget) && handlers.onPreviewEnd) handlers.onPreviewEnd();
      };
      el.addEventListener('mouseover', light);
      el.addEventListener('focusin', light);
      el.addEventListener('mouseout', unlight);
      el.addEventListener('focusout', unlight);
      el.addEventListener('change', e => {
        const sw = e.target.closest('input[data-show]');
        if (sw) handlers.onShow(sw.dataset.show, sw.checked);
      });

      // 一覧の元データ: 戦法は周期表と同じ行（系統ごと・筋の順）、囲いは戦型ごとに系統順
      this.tacticRows = K.tacticNav.tacticRows(K.TACTIC_FAMILIES, K.TACTICS);
      this.castlesBySide = Object.fromEntries(SIDES.map(([side]) =>
        [side, K.CASTLE_FAMILIES.flatMap(f => K.CASTLES.filter(c => c.side === side && c.family === f.id))]));
      this.castleFam = new Map(K.CASTLE_FAMILIES.map(f => [f.id, f.name]));
      this._build();
    }

    // 行の構造は不変なので一度だけ作る。update では属性だけを書き換え、DOM を作り直さない
    _build() {
      this.items = { me: [], opp: [] };
      const item = (parent, who, kind, id, name, sub) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tr-item cr-item';
        b.dataset.who = who; b.dataset.kind = kind; b.dataset.id = id;
        b.innerHTML = `<span class="nm">${esc(name)}</span><span class="cr-csc"></span>` +
          `<span class="cr-marks"><i class="cr-vs"></i><span class="fb">${esc(sub)}</span></span>`;
        parent.appendChild(b);
        this.items[who].push({ el: b, kind, id, csc: b.querySelector('.cr-csc'), vs: b.querySelector('.cr-vs') });
      };
      for (const who of ['me', 'opp']) {
        const tList = this.el.querySelector(`[data-role="list-tactic-${who}"]`);
        for (const { family, tactics } of this.tacticRows) {
          const sec = document.createElement('section');
          sec.className = 'tr-row';
          sec.innerHTML = `<h3><span class="pt-tile">${esc(family.piece)}</span>${esc(family.name)}</h3>`;
          for (const t of tactics) item(sec, who, 'tactic', t.id, t.name, K.tacticNav.fileBadge(t));
          tList.appendChild(sec);
        }
        const cList = this.el.querySelector(`[data-role="list-castle-${who}"]`);
        for (const [side, lab] of SIDES) {
          const sec = document.createElement('section');
          sec.className = 'tr-row';
          sec.innerHTML = `<h3>${lab}</h3>`;
          for (const c of this.castlesBySide[side]) item(sec, who, 'castle', c.id, c.short, this.castleFam.get(c.family) || '');
          cList.appendChild(sec);
        }
      }
    }

    /**
     * 選択状態に合わせて一覧とバッジを描き直す（constraints が変わるたびにモードから呼ばれる）
     * @param {object} state store.state
     * @param {{ me:object, opp:object|null }} S constraints.sides() の出力
     */
    update(state, S) {
      const list = Array.isArray(state.constraints) ? state.constraints : [];
      for (const who of ['me', 'opp']) {
        const st = S[who] || null;
        // バッジ計算用の側状態（相手が未選択なら空の状態で判定する）
        const eff = st || { strategy: null, tacticId: null, castleId: null };
        const other = who === 'me' ? S.opp : S.me;

        for (const b of this.seg[who].el.querySelectorAll('button')) {
          const id = b.dataset.value;
          const pv = K.constraints.preview(list, { type: 'set', who, kind: 'strategy', id });
          const cur = !!st && st.strategy === id;
          b.setAttribute('aria-pressed', cur);
          this._badge(b, pv.changed, K.compat.judge(eff, 'strategy', id, other), cur && st.implied.strategy);
        }
        for (const it of this.items[who]) {
          const j = K.compat.judge(eff, it.kind, it.id, other);
          const pv = K.constraints.preview(list, { type: 'set', who, kind: it.kind, id: it.id });
          const cur = !!st && eff[FIELD[it.kind]] === it.id;
          it.el.setAttribute('aria-current', cur ? 'true' : 'false');
          this._badge(it.el, pv.changed, j, cur && st.implied[it.kind]);
          // カスケードの要約は文字でも出す（色だけに頼らない。title にも理由を添える）
          it.csc.textContent = pv.changed.length
            ? `→${pv.changed.map(c => c.to != null ? nameOf(c.kind, c.to) : '外す').join('・')}` : '';
          it.vs.textContent = j.vs ? VS_MARK[j.vs.level] || '' : '';
          const tip = [];
          if (j.reasons && j.reasons.length) tip.push(j.reasons.map(r => plain(r.text)).join('／'));
          if (j.vs && j.vs.reasons && j.vs.reasons.length) tip.push(j.vs.reasons.map(r => plain(r.text)).join('／'));
          if (pv.changed.length) {
            tip.push(`連鎖: ${pv.changed.map(c =>
              `${LAYER_JA[c.kind]} ${nameOf(c.kind, c.from)}→${c.to != null ? nameOf(c.kind, c.to) : '削除'}`).join('、')}`);
          }
          if (tip.length) it.el.title = tip.join('。'); else it.el.removeAttribute('title');
        }
      }
      this.els.oppEmpty.hidden = !!S.opp;
      this.els.oppClear.hidden = !S.opp;
      this.els.swThreat.checked = state.showThreat !== false;
      this.els.swThreat.disabled = !S.opp;
    }

    _badge(b, changed, j, implied) {
      b.dataset.cascade = changed && changed.length ? 'true' : 'false';
      b.dataset.vs = j && j.vs ? j.vs.level : '';
      if (implied) b.dataset.implied = 'true'; else delete b.dataset.implied;
    }
  }

  K.ConstraintRailView = ConstraintRailView;
})();
