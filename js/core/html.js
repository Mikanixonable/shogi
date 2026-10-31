// HTML文字列の補助: テンプレートに埋め込む文字列のエスケープと data-sq 属性、
// 本文中の出典トークン [[ref]] / [[ref1|ref2]] → [n] リンクの変換（計画書 §7）
window.Kakoi = window.Kakoi || {};
(() => {
  'use strict';

  const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ENT[c]);
  /** マスの配列を data-sq 属性にする（空なら空文字） */
  const sqAttr = sq => sq && sq.length ? ` data-sq="${sq.join(' ')}"` : '';

  // [[ref]] / [[ref1|ref2]]: 各 ref は ] と | を含まない（esc は [ ] | を通すので esc 後にも一致する）
  const TOKEN = /\[\[([^\][|]+(?:\|[^\][|]+)*)\]\]/g;

  /**
   * パネル1枚につき1つ作る。cite(refId) は出現順の番号 n を返し、
   * 同じ refId には同じ番号を返す。entries() は {n, ref} の出現順リスト
   */
  const makeCiter = () => {
    const byRef = new Map();
    const list = [];
    const cite = ref => {
      let e = byRef.get(ref);
      if (!e) { e = { n: list.length + 1, ref }; byRef.set(ref, e); list.push(e); }
      return e.n;
    };
    const entries = () => list.slice();
    return { cite, entries };
  };

  /**
   * 本文を HTML にする: esc したあと [[ref]] / [[ref1|ref2]] を
   * <sup class="cite"><a href="#src-N">[N]</a>…</sup> に置き換える。
   * トークンの無い文字列は esc だけでそのまま返る
   */
  const rich = (text, citer) => {
    const s = esc(text);
    if (!citer || s.indexOf('[[') < 0) return s;
    return s.replace(TOKEN, (_, inner) =>
      '<sup class="cite">' + inner.split('|').map(r => {
        const n = citer.cite(r.trim());
        return `<a href="#src-${n}">[${n}]</a>`;
      }).join('') + '</sup>');
  };

  /** title 属性などプレーンテキストを入れる場所用: 出典トークンを取り除く（esc は呼び側で） */
  const plain = text => String(text).replace(TOKEN, '');

  /**
   * 本文中の [[ref]] / [[ref1|ref2]] トークンから ref 名のリストを取り出す。
   * トークンの形はこのモジュールが唯一の権威（validate.js の出典検査もこれを使う）
   * @param {string} text 本文
   * @returns {string[]} 出現順の ref 名（重複はそのまま残す）
   */
  const citeRefs = text => {
    if (typeof text !== 'string' || text.indexOf('[[') < 0) return [];
    const out = [];
    for (const m of text.matchAll(TOKEN))
      out.push(...m[1].split('|').map(r => r.trim()).filter(Boolean));
    return out;
  };

  /**
   * 出典リストの共通描画。items は {for, ref?, title, publisher, url} の配列。
   * 本文で引用されたものは cite() の番号順、引用されなかったものはその後ろに連番で続ける。
   * 引用が1件も無い（トークン未導入の）パネルでは従来どおり番号なしの見た目になる
   */
  const sourcesBlock = (items, citer) => {
    if (!items || !items.length) return '';
    const cited = new Map(citer ? citer.entries().map(e => [e.ref, e.n]) : []);
    const first = [], rest = [];
    for (const it of items) (it.ref != null && cited.has(it.ref) ? first : rest).push({ it, n: cited.get(it.ref) });
    first.sort((a, b) => a.n - b.n);
    const rows = [...first];
    for (const { it } of rest) rows.push({ it, n: citer ? citer.cite(it.ref != null ? it.ref : it) : rows.length + 1 });
    const li = rows.map(({ it, n }) => {
      const cv = cited.size ? `[${n}]${it.for ? ' ' + esc(it.for) : ''}` : esc(it.for || '');
      return `<li id="src-${n}"><span class="cv">${cv}</span>` +
        `<span><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>（${esc(it.publisher)}）</span></li>`;
    }).join('');
    return `<ul class="sources">${li}</ul>`;
  };

  Kakoi.html = { esc, sqAttr, makeCiter, rich, plain, citeRefs, sourcesBlock };
})();
