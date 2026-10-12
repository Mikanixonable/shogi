// 囲いの形の類似度レポート: 近傍・デンドログラム・MDS座標・グループとの一致度(ARI)を表示する
// 使い方: node shogi/tools/shape-report.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/core/notation.js', 'js/data/sources.js', 'js/data/setups.js',
  'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js', 'js/core/shape.js',
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
if (!K || !Array.isArray(K.CASTLES) || !K.shape) {
  console.error('load error: Kakoi.CASTLES / Kakoi.shape が未定義');
  process.exit(1);
}

const castles = K.CASTLES;
const byId = new Map(castles.map(c => [c.id, c]));
const nameOf = id => byId.get(id).name;
const S = K.shape;
const m = S.matrix(castles);
const root = S.cluster(m);

console.log('== 1. 近い囲い（上位3）==');
castles.forEach((c, i) => {
  const near = m.ids.map((id, j) => ({ id, v: m.d[i][j] })).filter((_, j) => j !== i)
    .sort((a, b) => a.v - b.v).slice(0, 3)
    .map(x => `${nameOf(x.id)} ${x.v.toFixed(2)}`);
  console.log(`${c.name}: ${near.join(' / ')}`);
});

console.log('\n== 2. デンドログラム ==');
(function print(n, depth) {
  const pad = '  '.repeat(depth);
  if (!n.left) return console.log(`${pad}- ${nameOf(n.id)}`);
  console.log(`${pad}+ [${n.height.toFixed(2)}]`);
  print(n.left, depth + 1);
  print(n.right, depth + 1);
})(root, 0);

console.log('\n== 3. MDS座標 ==');
for (const [id, p] of S.mds(m)) console.log(`${nameOf(id)}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);

console.log('\n== 4. クラスタ分割とARI ==');
const field = castles.every(c => c.family !== undefined) ? 'family' : 'group';
const labels = new Map(castles.map(c => [c.id, c[field]]));
const k = new Set(labels.values()).size;
const cl = S.cut(root, k);
console.log(`ラベル: ${field}, k=${k}`);
for (let i = 0; i < k; i++)
  console.log(`  #${i}: ${[...cl].filter(([, v]) => v === i).map(([id]) => nameOf(id)).join(', ')}`);
console.log(`ARI = ${S.adjustedRand(cl, labels).toFixed(3)}`);
