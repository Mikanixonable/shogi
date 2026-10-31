# 品質レビュー: 新規追加の振り飛車・相振り・駒落ちの囲い（19件）と新しい系統・想定配置

作成: 2026-11-01 / 状態: **作業中（骨組み。エントリを1件確認するごとに追記する）**

- 対象データ: `js/data/castles-furibisha.js`（14件+カギ囲い）/ `js/data/castles-ibisha.js`（駒落ち4件）/ `js/data/taxonomy.js`（新 family 5つ）/ `js/data/setups.js`（hirame・empty・kakuochi）
- 判定ラベル: 🔴誤り（要修正）/ 🟡不正確・不足（要補足）/ 🟢概ね正確（加筆のみ）
- 元の振り飛車10件は `docs/content/quality-castles.md` で監査済みのため対象外
- 座標は先手の絶対座標（筋1〜9=先手から見て右→左、段1〜9=後手側→先手側）。後手・上手の図は (筋,段)→(10−筋,10−段) に変換して照合する

## 1. 要約

（作業中。全エントリ確認後に件数と修正トップ5を書く）

| 判定 | 件数 |
|---|---|
| 🔴 | - |
| 🟡 | - |
| 🟢 | - |

### 重大度順の修正トップ5

（作業中）

### 担当外で気づいた重大な誤り

（なし／作業中）

## 2. エントリ別

### 振り飛車・相振り（14件）

| # | id | 名前 | family / subtype | setup | 判定 | 状態 |
|---|---|---|---|---|---|---|
| 1 | hayagakoi | 早囲い | quick / hayagakoi | furibisha | - | 未確認 |
| 2 | gendai-anaguma | 現代穴熊 | anaguma / gendai | furibisha | - | 未確認 |
| 3 | ginmino | 銀美濃 | mino / ginmino | furibisha | - | 未確認 |
| 4 | chonmagemino | ちょんまげ美濃 | mino / chonmage | furibisha | - | 未確認 |
| 5 | bouzumino | 坊主美濃 | mino / bouzu | furibisha | - | 未確認 |
| 6 | santegakoi | 三手囲い | quick / sante | furibisha | - | 未確認 |
| 7 | hirame | 平目 | low / hirame | hirame | - | 未確認 |
| 8 | hidarigyoku | 左玉（高田流） | hidarigyoku / takada | furibisha | - | 未確認 |
| 9 | oosumi | 大住囲い | kinmusou / oosumi | furibisha | - | 未確認 |
| 10 | furibisha-anaguma-48kin | 相振り穴熊（4八金型） | anaguma / kin48 | furibisha | - | 未確認 |
| 11 | nakabisha-hidari-anaguma | 中飛車左穴熊 | anaguma / sanmai | hirame | - | 未確認 |
| 12 | muteki | 無敵囲い | quick / muteki | empty | - | 未確認 |
| 13 | furibisha-hashigyoku | 端玉銀冠（振り飛車） | mino / hashigyoku | furibisha | - | 未確認 |
| 14 | airkin | エア金（銀冠エア金） | mino / gincan | furibisha | - | 未確認 |

### 駒落ち（5件）

| # | id | 名前 | side | family / subtype | setup | 判定 | 状態 |
|---|---|---|---|---|---|---|---|
| 15 | gintaden | 銀多伝 | ibisha | komaochi / taden | empty | - | 未確認 |
| 16 | kintaden | 金多伝 | ibisha | komaochi / taden | empty | - | 未確認 |
| 17 | kinzogan | 金象眼 | ibisha | komaochi / zougan | kakuochi | - | 未確認 |
| 18 | ginzogan | 銀象眼 | ibisha | komaochi / zougan | kakuochi | - | 未確認 |
| 19 | kagi | カギ囲い | furibisha | komaochi / kagi | kakuochi | - | 未確認 |

（以下、エントリごとに「### id 名前 — 判定」「検証表」「修正案（貼れる JS 断片）」「加筆案（history / origin / steps / players / proverbs）」を追記する）

## 3. 新しい系統・想定配置のレビュー

（作業中）対象: `chudan`（中段玉）/ `hidarigyoku`（左玉）/ `quick`（簡易囲い）/ `low`（低陣）/ `komaochi`（駒落ち）の name・shape・subtype、`SETUPS.hirame` / `empty` / `kakuochi`

## 4. 新規出典の一覧

（作業中）id / title / publisher / url / 確認できた内容
