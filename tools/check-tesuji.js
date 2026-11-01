// 手筋の検算ツール: js/core/tesuji-check.js を全 TESUJI に走らせる
// 使い方: node tools/check-tesuji.js [id...]  （VERBOSE=1 で再生した手も表示。問題があれば終了コード1）
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
for (const f of [...M.core, ...M.data, ...M.logic]) load(f);

const K = ctx.Kakoi;
if (!Array.isArray(K.TESUJI) || !K.tesujiCheck) {
  console.error('load error: Kakoi.TESUJI / tesujiCheck のいずれかが未定義');
  process.exit(1);
}

const only = process.argv.slice(2);
let bad = 0;
for (const t of K.TESUJI) {
  if (only.length && !only.includes(t.id)) continue;
  const r = K.tesujiCheck.check(t);
  const oc = K.tesujiCheck.onCastleIssues(t, { CASTLES: K.CASTLES });
  for (const i of oc) r.issues.push(i);
  console.log(`${r.issues.length ? 'NG ' : 'OK '}  ${t.id} ${t.name}`);
  for (const i of r.issues) console.log('     ✗ ' + i);
  if (process.env.VERBOSE) for (const n of r.notes) console.log('     · ' + n);
  if (r.issues.length) bad++;
}
console.log(bad ? `${bad} 件に問題あり` : 'すべて合格');
process.exit(bad ? 1 : 0);
