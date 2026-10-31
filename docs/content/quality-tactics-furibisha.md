# 振り飛車系「戦法」記述の文献照査レポート

対象: `js/data/tactics.js` の振り飛車系 16 エントリ、`js/data/strategies.js` の furibisha、`js/data/setups.js` の furibisha。
照合は `js/data/sources.js` の `[[ref-id]]` が指す URL を実際に取得して行った。判定は `OK / 要出典 / 疑義 / 誤り` の4段階。
※本ドキュメントは修正案の素案であり、`js/data/*.js` は一切編集していない。

## ① 監査サマリ

| id | 主な判定 | 摘要 |
|---|---|---|
| kyukenbisha 九間飛車 | OK（pairingsの出典割当に疑義1点） | 端飛車＝一間・九間の総称、8八角の障害、二段ロケットの定義は裏付け済み。mino-best の sources に充てた shinrar は実際には雁木/左美濃推奨で齟齬あり |
| mukaibisha 向かい飛車 | OK | 対穴熊互角以上・左金を攻めに回す・飛車素抜き注意・片美濃型、全て Wikipedia 記載通り |
| sankenbisha 三間飛車 | OK | 「先手三間飛車に急戦なし」、穴熊から飛車が遠い、石田流への発展、持久/急戦両対応は裏付け済み |
| ishida 石田流 | OK | 石田検校由来、棒金・「尻から金とうたれで石田負け」、角8八型/7七角型本組は裏付け済み |
| hayaisida 早石田 | OK（加筆余地あり） | ハメ手→防御策定跡化→プロで不採用は裏付け済み。「本来は後手番の戦法」が未記述 |
| masuda-ishida 升田式石田流 | 誤り1点 | 「（4→3戦法）」は後手番限定の別戦法で、▲3六飛展開の呼称としては誤用 |
| shin-ishida 新・石田流 | OK（別名に追加候補） | 内容は note-newishida と完全整合。Wikipedia では「新・早石田」が本筋の呼称 |
| tateishi 立石流 | OK（軽微な順序差1点） | 「立石勝己」表記は現行が正しい（「勝巳」は誤記と Wikipedia 注記）。位取り順が文献と逆順 |
| shikenbisha 四間飛車 | OK | 6筋/4筋、攻守バランス、美濃・穴熊・柔軟な組み替えは裏付け済み |
| fujiisystem 藤井システム | 疑義（記述不足） | 「対左美濃策」のみだが、文献上は対居飛車穴熊版がむしろ著名。升田幸三賞(1997)も未記述 |
| kakukoukan-shiken 角交換四間飛車 | OK（加筆余地大） | 定義は正しいが、大学将棋界→藤井猛採用→第40回升田幸三賞、向かい飛車的展開が未記述 |
| nakabisha 中飛車 | OK | 5筋・左金活用困難・片美濃・相振りでの不採用・破壊力は裏付け済み |
| gokigen ゴキゲン中飛車 | OK（加筆余地大） | 角道不開・位取り・後手番主体は正しい。近藤正和考案・大崎善生命名・升田幸三賞・丸山ワクチン等が未記述 |
| tsunogin-nakabisha ツノ銀中飛車 | OK | 左右対称・木村美濃・左金7八・大山の指し回し・棒銀困難・穴熊で衰退・英ちゃん流・風車、全て裏付け済み |
| gosuji-kuraidori 5筋位取り中飛車 | OK（出典の文脈に注意） | 引用記事「5筋位取り」は主に居飛車側の対振り戦法の記事。主張自体は妥当 |
| ikkenbisha 一間飛車 | OK（pairings水準に1提案） | 定義・穴熊多用・石田流/向かい飛車への組み替え・命名議論は裏付け済み |
| strategies.js furibisha | OK（例外の補足余地） | 「振った筋がそのまま戦法名」は向かい飛車が例外 |
| setups.js furibisha | OK | Wikipedia の四間飛車駒組み例と整合 |

## ② 修正提案（現行 → 案 → 理由 → 出典）

### 1. masuda-ishida（升田式石田流）desc 【誤り】

- 現行: `後の▲3六飛と3筋への展開（4→3戦法）を狙う`
- 案: `後の▲3六飛と3筋に回って3四の歩をかすめ取る展開を狙う`（「（4→3戦法）」の括弧を除去）
- 理由: 「4→3戦法」は後手番専用の別戦法で、いったん△4二飛（四間）に振ってから△3二飛と振り直す「途中下車」構想（戸辺誠発案。3・4・3戦法の系譜）。升田式側の▲3六飛展開は正しい狙いだが、その呼称として「4→3戦法」を充てるのは誤用。▲3六飛の狙い自体は Wikipedia に「飛車を浮いた升田式の狙いは、ここから次に飛車を3六に展開して後手3四の歩をかすめ取ってしまおう」と明記あり。
- 出典: wj-ishida（石田流 §升田式石田流・§4→3戦法）、thirdfilerook「4→3戦法とは」（https://thirdfilerook.jp/about-43-strategy）

### 2. tateishi（立石流）desc 【疑義（軽微）】

- 現行: `▲6八飛と四間に振ってから▲6五歩・▲7五歩と位を取り`
- 案: `▲6八飛と四間に振ってから▲7五歩・▲6五歩と位を取り`
- 理由: Wikipedia は「▲7五歩・▲6五歩と位をとる。それから飛車が▲6六飛-▲7六飛と移動し、最終的には石田流に落ち着くことが多い」。現行は位取りの列挙順が文献と逆。pieces（歩75・歩65）や essential 自体は正しいので表示上の順序だけの問題。
- 出典: wj-tateishi（立石流四間飛車）

- 補足（点検結果・変更不要）: 考案者の表記は現行「立石勝己」が正しい。Wikipedia 立石流記事は「アマチュア強豪の立石勝己」と記し、脚注で「『勝巳』は誤り」と明記。他記事（石田流記事）には「立石勝巳」と散見されるが、故人を偲ぶ会の名称が「立石勝己さんを偲ぶ会」であることが根拠とされる。なお「アマ強豪の立石勝己が考案、第31回（2004年）升田幸三賞特別賞」は確定事実。

### 3. kyukenbisha（九間飛車）pairings 【疑義】

- 現行: `{ castle: 'mino', level: 'best', why: '玉は飛車と反対の翼に囲う振り飛車の基本形…', sources: [note-nifusen-kyuken, shinrar-hashibisha] }`
- 案: mino=best の `sources` から shinrar-hashibisha を外す（why の「振り飛車の基本形」という根拠は残してよい）。あるいは「対居飛車なら雁木・対振りなら左美濃が有力という別流儀もある[[shinrar-hashibisha]]」を note 側に書き分ける。
- 理由: shinrar-hashibisha の本文は「対居飛車戦では雁木、対振り飛車戦では左美濃が有力」（中央の弱さを補うため）と明記しており、美濃を組み合わせの根拠として引くと出典と主張が逆になる。note-nifusen-kyuken は有料記事で本文未確認のため、美濃推奨の裏付けは弱い。
- 出典: shinrar-hashibisha（ポイント3）

### 4. fujiisystem（藤井システム）desc 【疑義（記述不足）】

- 現行: `藤井猛が開発した四間飛車の対左美濃策。玉を囲わず居玉のまま▲6五歩と突き捨て、飛車先交換や中央の厚みで勝負する。`
- 案: `藤井猛が考案した四間飛車のシステム（1997年升田幸三賞）。本来は対左美濃の研究として生まれたが、現在主流の「対居飛車穴熊」版では、相手が穴熊を目指す間に居玉のまま角筋を生かした縦の速攻（1筋端歩の突き越し・▲2五桂〜▲4五歩）を仕掛け、相手が急戦に転じたときは▲4八玉〜▲3九玉と美濃に移行して囲いの堅さで優位に立つ[[wj-fujiisystem|wj-shikenbisha]]。`
- 理由: Wikipedia 藤井システム記事は「左美濃対策の藤井システムと穴熊対策の藤井システムとがある」と明記し、対穴熊版を「現在主流」と位置づける。現行 desc は対左美濃面しか書かれておらず、より有名な対穴熊版が欠落。tags の「対左美濃」も同様。なお pieces（居玉・角道不開・▲6五歩）は対左美濃型として妥当。
- 出典: wj-fujiisystem（新規 ref 案）、wj-shikenbisha、wj-hidarimino

### 5. ikkenbisha（一間飛車）pairings 【疑義→変更提案】

- 現行: `furianaguma: level 'ok'`
- 案: `furianaguma: level 'best'`（why は現行「一間飛車穴熊として知られる組み合わせ…」のまま可）
- 理由: Wikipedia 一間飛車は「囲いは、通常は穴熊を用いる事が多いが、美濃囲い・片美濃囲いを用いる例もある」と明記。穴熊が標準なら best が実態に近い（mino/katamino は ok のまま）。
- 出典: wj-ikkenbisha

### 6. gosuji-kuraidori（5筋位取り中飛車）出典の文脈 【要出典→部分確認】

- 現行: desc/pros で `[[wj-gosuji-kuraidori]]` を多用
- 案: 出典としては維持可だが、note に「Wikipedia『5筋位取り』記事は主に居飛車が振り飛車に5筋の位を取る対抗策を扱い、振り飛車側の型は『5筋位取り中飛車』として別称される」と書き添える。または中飛車記事の該当行（「序盤早々に5筋の位を取る戦法。陣形が伸び伸びして作戦勝ちしやすい」）を `[[wj-nakabisha]]` で補強。
- 理由: 「位を取ると相手は5筋の歩を突けず」は位取り一般の定義として正しいが、引用記事の主文は居飛車側の戦法論。「5五（天王山）」の呼称も居飛車側文脈。
- 出典: wj-gosuji-kuraidori、wj-nakabisha

### 7. mukaibisha（向かい飛車）desc 【OK・条件付】

- 現行: `攻撃力は振り飛車の中で最も高いとされる[[wj-mukaibisha|we-ranging-rook]]`
- 判定: OK。Wikipedia は相振りで「中飛車＜四間飛車＜三間飛車＜向かい飛車」、中飛車記事は対抗型でも同順の「攻撃の要素」序列を記載。「最も高い」の言い回しはこの序列の要約として許容範囲。厳密には「攻撃の要素が最も強いとされる」へ微修正するとより忠実。
- 出典: wj-mukaibisha、wj-nakabisha

### 8. kyukenbisha（九間飛車）note の「一間」説明 【OK・注記提案】

- 現行: `（「一間」は筋の番号「1」のことで、端から1マス内側という意味ではない）`
- 判定: 誤りとは言えないが、Wikipedia の命名議論は「四間・三間と同じ『左から数える』流儀で名付けるなら九間飛車や右一間飛車が適切」という趣旨。「筋の番号1」説明は一つの解釈。より忠実には「『一間』は右端（1筋側）から数えて1間目という解釈があり、左から数える流儀では『九間飛車』『右一間飛車』が適切との意見もある」。
- 出典: wj-ikkenbisha

### 9. hayaisida（早石田）【OK・加筆候補】

- 現行 desc/pros/cons は全て裏付け済み（ハメ手・防御策定跡化・プロ不採用）。
- 一点だけ文献との齟齬確認: なし。「本来早石田は後手番で仕掛ける戦法とされる」（wj-ishida）は③の加筆へ。

### 10. その他 OK 確認済みの主な主張（簡潔列挙）

- kyukenbisha: 「端飛車」は一間飛車と九間飛車の総称（shinrar 冒頭）、8八角が飛車の道を塞ぐ（note ティザー）、「二段ロケット」＝香・飛車の縦重ねの用語で戦法名ではない（wj-shogi-yogo）。pieces は出典例がない旨 note に明記済みで適切。
- sankenbisha: 「先手三間飛車に急戦なし」格言、急戦に強い、角を8八に引いて石田流へ、穴熊から飛車が遠い、左銀を5七/6七両方に使える、持久/急戦両対応 → 全て wj-sankenbisha に存在。
- ishida: 石田検校由来（上方では「宗無流」）、棒金対策と川柳「尻から金とうたれで石田負け」（誹風柳多留）、角7七型の石田本組 → wj-ishida/wj-sankenbisha に存在。
- shikenbisha: 先手6筋・後手4筋、左から4マス目が命名由来、攻守バランス、美濃が一般・穴熊まで組む例・向かい/中飛車/石田流への柔軟な組み替え → wj-shikenbisha に存在。
- nakabisha: 5筋中央が由来、「中飛車は玉の頭に尻を乗せ」川柳、「下手の中飛車」異名、左金活用困難→片美濃、相振りで採用少ない、破壊力（角・桂活用）→ wj-nakabisha に存在。
- gokigen: 角道を止めない・5筋の位を早く取る・後手番主体で先手でも応用 → wj-gokigen に存在。
- tsunogin-nakabisha: 左右対称の構え、名前の由来（ツノ状の2銀）、右銀4七・右金3八・玉2八（木村美濃）、左金7八、大山の指し回し、3八飛袖飛車逆襲、棒銀困難、穴熊対策なく衰退、英ちゃん流（山口英夫・5筋不突）、風車（一段飛車＋角5筋＋中住まい）→ 全て wj-tsunogin に逐語的に存在。
- ikkenbisha: 1筋歩を1五まで突き越し→飛車1八〜1六、穴熊多用、石田流への組み替え・向かい飛車へぶつける低い陣形からのカウンター、命名議論、プロ採用例が少ない → wj-ikkenbisha に存在。
- strategies.js furibisha: 「飛車を右翼の初期位置から左翼へ」「玉を右翼に囲う」「美濃が土台」「相手も振れば相振り飛車」→ wj-furibisha と整合。「別の筋（5〜9筋や1筋）」は英版 "center or left" と整合（中飛車は center）。
- setups.js furibisha: 角77・飛68・歩76/66/56 は wj-shikenbisha 冒頭の駒組み例と一致。

## ③ 加筆提案（追記文案 → 出典）

文体は既存に合わせ、出典は `[[ref]]` 形式。新規 ref は④参照。

### kyukenbisha 九間飛車
1. desc 末尾へ追記案: `なお「端飛車」は一間飛車と九間飛車の総称で、9筋のまま直接端を攻め潰す新しい系統の端飛車戦法もある[[shinrar-hashibisha]]。`（現行は「端飛車とも呼ばれる」のみで、総称という語義と新系統の存在がない）
2. cons へ追記案: `中央が薄いため対居飛車では雁木、対振りでは左美濃のように中央に駒の利く囲いを推す流儀もある[[shinrar-hashibisha]]`（②-3 の pairings 修正とセット）

### mukaibisha 向かい飛車
1. desc へ追記案: `筋名では二間に相当するが、相手の飛車と正面から向き合うので「向かい飛車」と呼ぶのが常で、相振り飛車で向き合わなくてもこの名で呼ばれる[[wj-mukaibisha]]。`
2. note へ追記案: `種別は多く、角道を開けたままの升田流向かい飛車・鬼殺し向かい飛車、角交換から振るダイレクト向かい飛車、メリケン向かい飛車などがある[[wj-mukaibisha]]。相振りでは▲8九飛と浮く浮き飛車型や、先手が右矢倉に囲う形もオーソドックス[[wj-mukaibisha]]。`
3. context 補足案: `対居飛車（角道を止めても居飛車穴熊と互角以上に戦える）` ※対穴熊相性は文献明記済み。

### sankenbisha 三間飛車
1. desc へ追記案: `左銀を6七にも5七にも展開できる幅があり、2018年頃からelmo囲い急戦への強さもあってプロ棋戦の振り飛車主力戦法になっている[[wj-sankenbisha]]。`
2. pros へ追記案: `対居飛車穴熊の実践的な対策が蓄積され、中田功XP・コーヤン流・下町流などのスペシャリスト系統がある[[wj-sankenbisha]]`

### ishida 石田流
1. desc へ追記案: `上方では宗無流とも呼ばれ、初代大橋宗桂対本因坊算砂（慶長年間）の棋譜には既に石田流の構えが現れるとされる[[wj-ishida]]。`
2. note へ追記案: `系譜上の近縁には楠本式石田流（楠本誠二）、後手番の3・4・3戦法（島朗『島ノート』）・戸辺流4→3戦法（戸辺誠）、2手目△3二飛（今泉健司・第35回升田幸三賞）などがある[[wj-ishida|note-ishida-summary]]。`

### hayaisida 早石田
1. desc へ追記案: `本来早石田は後手番で仕掛ける戦法とされ、後手番では△3五歩に対する▲6五角の切り返しが利きにくい分リスクが高い[[wj-ishida]]。`
2. note へ追記案: `早石田系の新構想には新・石田流のほか、久保利明の▲7五飛新手（久保流急戦、第36回升田幸三賞）がある[[wj-ishida|note-kubo-rapid]]。`

### masuda-ishida 升田式石田流
1. desc へ追記案（②-1 の修正と併せて）: `第30期名人戦（対大山康晴）では7局中5局がこの戦型になり、「一時は必勝の戦法」とまで言われた。のちに後手番の3・4・3戦法や4→3戦法、▲7七銀型などで再評価が進んだ[[wj-ishida]]。`
2. pros へ追記案: `角交換して浮き飛車にするため左辺下部が薄くなりがちだが、▲7八金でこれを補う設計になっている[[note-masuda-ishida|note-ishida-summary]]`

### shin-ishida 新・石田流
1. aliases 追加案: `'新・早石田', '早石田鈴木流急戦'`（現行の「鈴木新手」「鈴木流急戦」は note-newishida 由来で維持可。Wikipedia では「新・早石田」を主見出し、「新石田流」「早石田鈴木流急戦」を別名とする）→ 出典 wj-ishida
2. desc へ追記案: `この構想が優秀なため、後手側は△8五歩を突かず先に△6二銀としたり、4手目に△4二玉・△1四歩として代表局面自体を避ける対策も増えた[[note-newishida]]。`

### tateishi 立石流
1. desc へ追記案: `アマチュア由来の戦法がプロに広まった珍しい経緯で、第31回（2004年）升田幸三賞特別賞を受賞。勝又清和は升田式石田流を元に考案されたと推測している[[wj-tateishi|wj-ishida]]。`
2. note へ追記案: `小林健二は自己流に発展させた「スーパー立石流」で1995年の早指し選手権を制した[[wj-tateishi]]。`

### shikenbisha 四間飛車
1. desc へ追記案: `「四間」は振った位置が左から4マス目であることの由来で、現存最古の棋譜（1607年・宗桂対算砂）でも後手が用いている[[wj-shikenbisha]]。`
2. note へ追記案: `江戸時代の「平手二十八手組（錆刀戦法）」や近年の耀龍四間飛車（大橋貴洸・第48回升田幸三賞）、振り飛車ミレニアムなど派生が続く[[wj-shikenbisha]]。`

### fujiisystem 藤井システム
1. tags へ追記案: `'対穴熊'`（現在主流の用法）。context も `対居飛車（対左美濃・対居飛車穴熊のシステム）` に。
2. note へ追記案: `『将棋世界』2007年9月号「現役棋士が選ぶ衝撃の新手新戦法ベスト10」で第1位。三間飛車への応用は三間飛車藤井システム（久保システム）と呼ばれる[[wj-fujiisystem|wj-shikenbisha]]。`
3. pros へ追記案: `相手が穴熊を目指せば完成前に仕掛け、急戦に転じれば囲いの堅さで優位に立てるという攻守両対応の設計[[wj-fujiisystem]]`

### kakukoukan-shiken 角交換四間飛車
1. desc へ追記案: `角交換のあと先手なら8筋に飛車を振り直して飛車先を逆襲する展開になりやすく、向かい飛車の要素も強い[[wj-kakukoukan-shiken]]。元々大学将棋界で指されていたものを藤井猛が居飛車穴熊対策に採用して流行し、2013年度升田幸三賞を受賞した[[wj-kakukoukan-shiken]]。`
2. cons へ追記案: `「振り飛車には角交換」の格言に反し、角交換の手損を受け入れる構えなので手順の組み立て方が大事になる[[wj-kakukoukan-shiken|wj-shogi-kakugen]]`

### nakabisha 中飛車
1. desc へ追記案: `現存最古級の記録（松平家忠の「家忠日記」）にも現れ、「中飛車は玉の頭に尻を乗せ」の古川柳がある一方、「下手の中飛車」の異名で軽視されてきた歴史がある[[wj-nakabisha]]。`
2. note へ追記案: `相振りでは中飛車左穴熊（2000年代末にアマチュアから発案、2010年代にプロでも採用）の形もある[[wj-nakabisha]]。`

### gokigen ゴキゲン中飛車
1. desc へ追記案: `近藤正和が升田式石田流と5筋位取り中飛車を元に開発し、「ゴキゲン」の名付け親は将棋世界編集長の大崎善生。2002年度升田幸三賞を受賞した[[wj-gokigen]]。`
2. cons へ追記案: `丸山ワクチン（位を取られる前の角交換）、▲5八金右超急戦、超速▲3七銀、角道不開型やゴキゲンはずしなど対策の系譜が厚い[[wj-gokigen]]`
3. note へ追記案: `ルーツとなる棋譜は第1期名人戦の木村義雄対花田長太郎戦が知られる。先手番ゴキゲンは3手目に▲5八飛と振る形から始まる[[wj-gokigen]]。`

### tsunogin-nakabisha ツノ銀中飛車
1. note へ追記案: `山田道美によれば原型は江戸時代後期（1846年・勝田専吉の棋譜）に見られ、戦後は松田茂役の名が得意棋士として挙げられる。相手が急戦のときそのまま対処する片方だけの形は「片ツノ銀」とも[[wj-tsunogin]]。`
2. pros へ追記案: `加藤流袖飛車（△3一金〜△3二飛〜△4五歩・△2二角）など対抗策の定跡化も進んでいる[[wj-tsunogin]]`（pros ではなく note/cons 側でも可）

### gosuji-kuraidori 5筋位取り中飛車
1. desc へ追記案: `位取りは「天王山」とも呼ばれる5五の確保が眼目で、中飛車側の型は5筋位取り中飛車とも称される[[wj-gosuji-kuraidori|wj-nakabisha]]。`
2. note へ追記案: `この形に角を端に上げてにらみを利かせる「5五龍中飛車（端角中飛車）」はつのだじろう創案で、深浦康市が王位戦で羽生善治に採用した例がある[[wj-nakabisha]]。`

### ikkenbisha 一間飛車
1. desc へ追記案: `囲いは通常は穴熊が多く（一間飛車穴熊）、美濃・片美濃の例もある。公式戦では先崎学の採用例がよく知られ、市販の定跡書（『奇襲大全』）でも公開されている[[wj-ikkenbisha]]。`
2. note へ追記案: `なお9筋側の端飛車（左一間飛車）は右玉にする別系統で、土佐浩司の採用例がある。1筋型の読みは「いっけんびしゃ」のほか「いちげんびしゃ」とも[[wj-ikkenbisha]]。`

### strategies.js furibisha desc
1. 追記案: `ただし8筋に振る「向かい飛車」は相手の飛車と向き合う形から名付けられた例外。`（「振った筋がそのまま戦法名になる」の後に）

## ④ 新規 sources.js エントリ案

既存命名規則（`wj-`=Wikipedia日本語版、`we-`=英語版、`note-`=ブログ/専門サイト）に倣う。

```js
// ---- 戦法（振り飛車追加） ----
'wj-ishida': { title: '石田流', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%9F%B3%E7%94%B0%E6%B5%81' },
'wj-tateishi': { title: '立石流四間飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E7%AB%8B%E7%9F%B3%E6%B5%81%E5%9B%9B%E9%96%93%E9%A3%9B%E8%BB%8A' },
'wj-fujiisystem': { title: '藤井システム', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E8%97%A4%E4%BA%95%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0' },
'wj-kakukoukan-shiken': { title: '角交換四間飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E8%A7%92%E4%BA%A4%E6%8F%9B%E5%9B%9B%E9%96%93%E9%A3%9B%E8%BB%8A' },
'wj-gokigen': { title: 'ゴキゲン中飛車', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E3%82%B4%E3%82%AD%E3%82%B2%E3%83%B3%E4%B8%AD%E9%A3%9B%E8%BB%8A' },
'wj-shogi-kakugen': { title: '将棋の格言', publisher: 'Wikipedia日本語版', url: 'https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B%E3%81%AE%E6%A0%BC%E8%A8%80' },
'note-masuda-ishida': { title: '石田流の基礎知識 升田式石田流とは', publisher: '三間飛車のひとくちメモ', url: 'https://thirdfilerook.jp/about-masuda-ishida-style/' },
'note-kubo-rapid': { title: '石田流の基礎知識 久保流急戦とは', publisher: '三間飛車のひとくちメモ', url: 'https://thirdfilerook.jp/about-kubo-style-rapid-attack/' },
'note-43-senpou': { title: '石田流の基礎知識 4→3戦法とは', publisher: '三間飛車のひとくちメモ', url: 'https://thirdfilerook.jp/about-43-strategy/' },
'note-343-senpou': { title: '石田流の基礎知識 3・4・3戦法とは', publisher: '三間飛車のひとくちメモ', url: 'https://thirdfilerook.jp/about-343-strategy/' },
```

補足:
- 現行 `ishida` 系は `[[wj-sankenbisha]]` で石田流・早石田・升田式の根拠をまかなっているが、独立記事 `wj-ishida` を追加すれば引用精度が上がる（三間飛車記事にも石田流各派の記述はある）。
- `wj-shogi-kakugen` は「振り飛車には角交換」の格言用。角交換四間飛車・升田式の双方で使える。
- 九間飛車に独立した Wikipedia 記事は存在しない（「一間飛車」記事内の「端飛車（左一間飛車）」節と note/shinrar が現状の実質ソース）。`kyukenbisha` の `[[wj-ikkenbisha]]` 運用はその意味で妥当。
- `wj-mukaibisha`・`wj-tsunogin`・`wj-gosuji-kuraidori`・`wj-ikkenbisha`・`wj-nakabisha`・`wj-shikenbisha`・`wj-sankenbisha`・`wj-furibisha`・`wj-mino`・`wj-kimuramino`・`wj-hidarimino`・`wj-furibisha-anaguma`・`wj-shogi-yogo` は既存のまま利用可能。

## ⑤ 照合文献URL一覧（実際に取得したもの）

| ref-id / 文献 | URL | 取得状況 |
|---|---|---|
| wj-sankenbisha 三間飛車 | https://ja.wikipedia.org/wiki/三間飛車 | 取得済（全文・grepで項目抽出） |
| wj-shikenbisha 四間飛車 | https://ja.wikipedia.org/wiki/四間飛車 | 取得済 |
| （新規案）石田流 | https://ja.wikipedia.org/wiki/石田流 | 取得済 |
| wj-nakabisha 中飛車 | https://ja.wikipedia.org/wiki/中飛車 | 取得済 |
| wj-tsunogin ツノ銀中飛車 | https://ja.wikipedia.org/wiki/ツノ銀中飛車 | 取得済（概要〜脚注まで確認） |
| wj-gosuji-kuraidori 5筋位取り | https://ja.wikipedia.org/wiki/5筋位取り | 取得済（主に居飛車側の記事と確認） |
| wj-mukaibisha 向かい飛車 | https://ja.wikipedia.org/wiki/向かい飛車 | 取得済 |
| wj-ikkenbisha 一間飛車 | https://ja.wikipedia.org/wiki/一間飛車 | 取得済 |
| （新規案）ゴキゲン中飛車 | https://ja.wikipedia.org/wiki/ゴキゲン中飛車 | 取得済 |
| （新規案）立石流四間飛車 | https://ja.wikipedia.org/wiki/立石流四間飛車 | 取得済 |
| （新規案）藤井システム | https://ja.wikipedia.org/wiki/藤井システム | 取得済 |
| （新規案）角交換四間飛車 | https://ja.wikipedia.org/wiki/角交換四間飛車 | 取得済 |
| wj-furibisha 振り飛車 | https://ja.wikipedia.org/wiki/振り飛車 | 取得済（冒頭部・分類表） |
| wj-shogi-yogo 将棋用語一覧 | https://ja.wikipedia.org/wiki/将棋用語一覧 | 取得済（「ロケット」項を確認） |
| we-ranging-rook Ranging Rook | https://en.wikipedia.org/wiki/Ranging_Rook | 取得済（分類表・Fourth File 記述） |
| note-newishida 新・石田流とは | https://thirdfilerook.jp/about-new-ishida-style/ | 取得済（鈴木新手/鈴木流急戦・第32回・7手目▲7四歩・▲5六角・回避対策を確認） |
| note-ishida-summary 石田流まとめ | https://thirdfilerook.jp/summary-theory-ishida-style/ | 取得済（本組み/7七角型/宮本流/楠本式/升田式/3・4・3/4→3/棒金の分類確認） |
| note-nifusen-kyuken 九間飛車 | https://note.com/nifusen/n/n656a6498b4ba | ティザーのみ（有料記事）。「8八角をどう処理するか」「最も不人気な振り場所=九間飛車」まで確認。相振り美濃=9筋側の主張は本文未確認 |
| shinrar-hashibisha 端飛車戦法 | https://shogishinrar.com/hashibisha | 取得済（端飛車=一間+九間の総称、角交換回避、雁木/左美濃推奨を確認） |

### 未照合・補足メモ

- `we-ranging-rook` の記述は概略レベルの引用（「最も攻撃力が高い」「歴史が深い」程度）で、いずれも日本語版側で個別に裏付け済みのため問題なし。
- `note-nifusen-kyuken` は有料部分が取得不可のため、「相手の美濃＝玉が9筋側に来る」という根拠づけは盤面構造からは妥当だが出典本文未確認（要出典のまま残す判断も可）。
- 九間飛車の Wikipedia 独立記事は存在せず、「一間飛車」記事内「端飛車（左一間飛車）」節が最も近い一次文献。現行 `kyukenbisha` が `wj-ikkenbisha` を参照する構成は妥当。
- pieces の駒配置は「代表図」性のもので、各文献の基本図と必ずしも一致しないのは note 欄に明記済み（kyukenbisha）。`tateishi`（歩75・65・飛76）、`masuda-ishida`（金78・玉48）、`fujiisystem`（居玉・角道不開）など概形は文献の基本図と整合。

## ⑥ 付録：主張単位の判定一覧

監査で抽出した個別の事実的主張と判定（OK のみの主張は括弧書きで出典を簡記）。

### kyukenbisha
- 9筋に振る・端飛車と呼ぶ: OK（shinrar「一間飛車と九間飛車の総称」）
- 相振りで相手美濃が9筋側→端攻め直結: 要出典（note 有料部・構造的には妥当）
- 8八の角が飛車の道を塞ぐ: OK（note ティザー）
- 二段ロケットは用語で戦法名ではない: OK（wj-shogi-yogo「ロケット」項）
- 中央が薄く角打ちの隙: OK（shinrar ポイント2・3）
- pairings mino=best の sources 割当: 疑義（②-3）

### mukaibisha
- 8筋に振り相手飛車先と向き合う逆襲骨子: OK
- 攻撃力は振り飛車で最も高い: OK（対抗型・相振りの双方の序列で裏付け、②-7 参照）
- 角道を止めても居飛車穴熊と互角以上: OK（原文に同文あり）
- 左金は攻めに残し片美濃型になりやすい: OK（図・本文）
- 飛車の素抜き注意・玉が薄い: OK

### sankenbisha / ishida
- 先手7筋・後手3筋: OK（読みは「さんけん/さんげん」両方記載、現行「さんげん」も許容）
- 「先手三間飛車に急戦なし」格言: OK（原文あり）
- 角を8八に引き角道を開け▲7五歩・▲7六飛＝石田流: OK（石田流冒頭定義と一致）
- 石田検校由来・「尻から金とうたれで石田負け」・棒金対策: OK（誹風柳多留の川柳として記載）
- 7七角型の石田本組がある: OK（石田流 §石田流本組）
- 持久戦/急戦両対応・穴熊から飛車が遠い: OK

### hayaisida / masuda-ishida / shin-ishida
- 玉4八に寄せて囲わず早い仕掛け・ハメ手・プロ不採用: OK
- 升田幸三考案・升田式早石田とも: OK（「升田式早石田」と明記あり）
- ▲4八玉・▲7八金の形: OK（角交換型・▲6六歩保留・▲7八金の3特徴と一致）
- 「（4→3戦法）」を▲3六飛展開の呼称に使用: 誤り（②-1）
- 7手目▲7四歩の突き捨て・△6五角に▲5六角・第32回（2005年）升田幸三賞・回避対策: OK（note-newishida 全面一致）

### tateishi / shikenbisha / fujiisystem / kakukoukan-shiken
- 立石勝己考案・▲6八飛→位取り→▲6六飛-▲7六飛→石田流: OK（順序のみ疑義、②-2）
- 「石田流第二のルート」・角交換覚悟・一段金対策で衰退: OK
- 6筋/4筋・攻守バランス・美濃基本・派生多い: OK
- 藤井猛考案・居玉・▲6五歩: OK だが対左美濃のみの記述は不足（②-4）
- 角道を止めない四間・角交換厭わず: OK（大学将棋界→藤井猛採用・第40回受賞は加筆候補）

### nakabisha / gokigen / tsunogin-nakabisha / gosuji-kuraidori / ikkenbisha
- 5筋・左金難しい→片美濃・相振り少ない・破壊力: OK
- ゴキゲン＝角道不開・位取り・後手番主体: OK（近藤考案・命名・受賞は加筆候補）
- ツノ銀全記述（構え・木村美濃・大山・棒銀困難・衰退・英ちゃん流・風車）: OK
- 5五歩の位取りで5筋封じ: OK（位取り一般論として妥当、②-6）
- 1筋型の定義・穴熊多用・命名議論: OK（pairings 水準のみ提案、②-5）
