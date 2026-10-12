// 囲いデータの検証: 駒配置・必須項目・マス表記・出典の整合性を調べる
// 使い方: node shogi/tools/validate-castles.js （エラーがあれば終了コード1）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/core/notation.js', 'js/data/sources.js', 'js/data/setups.js',
  'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js',
  'js/core/position.js', 'js/core/attack-map.js',
];

const ctx = vm.createContext({ console });
ctx.window = ctx;
for (const f of FILES) {
  const full = path.join(ROOT, f);
  let code;
  try { code = fs.readFileSync(full, 'utf8'); }
  catch (e) { console.error(`missing file: ${f} (${full})`); process.exit(1); }
  try { vm.runInContext(code, ctx, { filename: f }); }
  catch (e) { console.error(`load error in ${f}: ${e && e.message}`); process.exit(1); }
}
const K = ctx.Kakoi;
if (!K || !Array.isArray(K.CASTLES) || !K.SETUPS || !K.SOURCES || typeof K.validateCastle !== 'function') {
  console.error('load error: Kakoi.CASTLES / SETUPS / SOURCES / validateCastle のいずれかが未定義');
  process.exit(1);
}

const SQ = /^[1-9][1-9]$/;
const isStr = v => typeof v === 'string' && v.length > 0;
const isArr = Array.isArray;
const RATING_KEYS = ['hard', 'wide', 'top', 'side', 'quick'];
const warnings = [];
const usedRefs = new Set();
const seenIds = new Set();
let fails = 0;

function checkCastle(c) {
  const e = [];
  try { e.push(...K.validateCastle(c)); } catch (x) { e.push(`validateCastle例外: ${x.message}`); }
  for (const k of ['id', 'name', 'short', 'reading', 'group', 'core', 'support', 'desc'])
    if (!isStr(c[k])) e.push(`必須項目なし: ${k}`);
  if (!['ibisha', 'furibisha'].includes(c.side)) e.push(`side不正: ${c.side}`);
  if (!isStr(c.setup) || !K.SETUPS[c.setup]) e.push(`setup未登録: ${c.setup}`);
  if (!isArr(c.tags)) e.push('tagsが配列でない');
  if (!c.ratings || typeof c.ratings !== 'object') e.push('ratingsなし');
  else for (const k of RATING_KEYS) {
    const v = c.ratings[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) e.push(`ratings.${k}が1..5の整数でない: ${v}`);
  }
  for (const [name, list] of [['pros', c.pros], ['cons', c.cons]]) {
    if (!isArr(list)) { e.push(`${name}が配列でない`); continue; }
    list.forEach((x, i) => {
      if (!x || !isStr(x.t)) e.push(`${name}[${i}].tなし`);
      if (x && x.sq !== undefined) {
        if (!isArr(x.sq)) e.push(`${name}[${i}].sqが配列でない`);
        else for (const s of x.sq) if (!SQ.test(String(s))) e.push(`${name}[${i}].sq不正: ${s}`);
      }
    });
  }
  if (!isArr(c.attacks)) e.push('attacksが配列でない');
  else {
    const ids = new Set();
    c.attacks.forEach((a, i) => {
      for (const k of ['id', 'name', 't', 'gote']) if (!a || !isStr(a[k])) e.push(`attacks[${i}].${k}なし`);
      if (!a) return;
      if (ids.has(a.id)) e.push(`攻め筋idが重複: ${a.id}`);
      ids.add(a.id);
      if (!isArr(a.target)) e.push(`attacks[${i}].targetが配列でない`);
      else for (const s of a.target) if (!SQ.test(String(s))) e.push(`attacks[${i}].target不正: ${s}`);
    });
  }
  if (!isArr(c.sources) || c.sources.length === 0) e.push('sourcesが空');
  else {
    c.sources.forEach((s, i) => {
      if (!s || !isStr(s.ref)) e.push(`sources[${i}].refなし`); else usedRefs.add(s.ref);
      if (!s || !isStr(s.for)) e.push(`sources[${i}].forなし`);
    });
    if (c.sources.length < 2) warnings.push(`${c.id}: sourcesが${c.sources.length}件（2件以上が望ましい）`);
  }
  if (seenIds.has(c.id)) e.push(`idが重複: ${c.id}`);
  seenIds.add(c.id);
  return e;
}

for (const c of K.CASTLES) {
  const errs = checkCastle(c);
  if (errs.length) { fails++; console.log(`FAIL ${c.id}: ${errs.join(' / ')}`); }
  else console.log(`OK   ${c.id}`);
}

// 出典レジストリの検査
let srcErrors = 0;
for (const [sid, s] of Object.entries(K.SETUPS)) {
  for (const r of s.sources || []) {
    usedRefs.add(r.ref);
    if (!K.SOURCES[r.ref]) { srcErrors++; console.log(`FAIL setup:${sid}: 未登録の出典: ${r.ref}`); }
  }
}
for (const [ref, s] of Object.entries(K.SOURCES)) {
  const miss = ['title', 'publisher', 'url'].filter(k => !s || !isStr(s[k]));
  if (s && isStr(s.url) && !/^https:\/\//.test(s.url)) miss.push('url(https://でない)');
  if (miss.length) { srcErrors++; console.log(`FAIL source:${ref}: ${miss.join(', ')}`); }
  if (!usedRefs.has(ref)) warnings.push(`source:${ref}: どこからも参照されていない`);
}

for (const w of warnings) console.log(`WARN ${w}`);
const total = K.CASTLES.length;
console.log(`---\n${total} castles, ${total - fails} ok, ${fails} fail; source errors ${srcErrors}; warnings ${warnings.length}`);
process.exit(fails || srcErrors ? 1 : 0);
