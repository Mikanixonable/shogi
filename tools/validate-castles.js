// 囲いデータの検証ツール: js/core/validate.js の検査結果を表示する
// 使い方: node shogi/tools/validate-castles.js （エラーがあれば終了コード1）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;

function load(f) {
  const full = path.join(ROOT, f);
  let code;
  try { code = fs.readFileSync(full, 'utf8'); }
  catch (e) { console.error(`missing file: ${f} (${full})`); process.exit(1); }
  try { vm.runInContext(code, ctx, { filename: f }); }
  catch (e) { console.error(`load error in ${f}: ${e && e.message}`); process.exit(1); }
}

load('js/manifest.js');
const M = ctx.Kakoi && ctx.Kakoi.MANIFEST;
if (!M) { console.error('load error: Kakoi.MANIFEST が未定義'); process.exit(1); }
// 画面側（ui / app）は読み込まない
for (const f of [...M.core, ...M.data, ...M.logic]) load(f);

const K = ctx.Kakoi;
if (!Array.isArray(K.CASTLES) || !K.SETUPS || !K.SOURCES || !Array.isArray(K.CASTLE_FAMILIES) || !K.validate) {
  console.error('load error: Kakoi.CASTLES / SETUPS / SOURCES / CASTLE_FAMILIES / validate のいずれかが未定義');
  process.exit(1);
}

const report = K.validate.all({ CASTLES: K.CASTLES, SETUPS: K.SETUPS, SOURCES: K.SOURCES, CASTLE_FAMILIES: K.CASTLE_FAMILIES, TACTICS: K.TACTICS, TACTIC_FAMILIES: K.TACTIC_FAMILIES });
const warnings = [];
let fails = 0, tFails = 0, srcErrors = 0;
for (const r of report.results) {
  for (const w of r.warnings) warnings.push(`${r.id}: ${w}`);
  if (r.kind === 'castle') {
    if (r.errors.length) { fails++; console.log(`FAIL ${r.id}: ${r.errors.join(' / ')}`); }
    else console.log(`OK   ${r.id}`);
  }
}
for (const r of report.results) {
  if (r.kind !== 'tactic') continue;
  if (r.errors.length) { tFails++; console.log(`FAIL tactic:${r.id}: ${r.errors.join(' / ')}`); }
  else console.log(`OK   tactic:${r.id}`);
}
for (const r of report.results) {
  if (r.kind !== 'castle' && r.kind !== 'tactic' && r.errors.length) { srcErrors++; console.log(`FAIL ${r.kind}:${r.id}: ${r.errors.join(' / ')}`); }
}
warnings.push(...report.warnings.filter(w => !w.startsWith('castle id')));
for (const w of warnings) console.log(`WARN ${w}`);
const total = K.CASTLES.length;
const tTotal = report.results.filter(r => r.kind === 'tactic').length;
console.log(`---\n${total} castles, ${total - fails} ok, ${fails} fail; ${tTotal} tactics, ${tTotal - tFails} ok, ${tFails} fail; source errors ${srcErrors}; warnings ${warnings.length}`);
process.exit(fails || tFails || srcErrors ? 1 : 0);
