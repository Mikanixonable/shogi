# 将棋の囲い図鑑

公開ページ: https://mikanixonable.github.io/shogi/

将棋の囲いと戦法を盤面で組み合わせて、駒の配置や相手との相性を確認できるWebアプリです。自分と相手の戦法・囲いを選ぶと、組み合わせた局面を盤面に表示します。

## できること

- 囲いや戦法の特徴、駒の配置、攻め筋を盤面と解説で確認
- 「相手 △」から相手の局面を表示し、自分の形との組み合わせを比較
- 両立しない組み合わせとその理由を確認し、候補から選び直す
- URLを共有して局面を伝えたり、ブラウザの「戻る／進む」で選択を戻したりする

## 使い方

公開ページを開き、左の一覧から自分の戦法や囲いを選びます。相手も設定するときは「相手 △」を選ぶと表示がONになり、そのまま相手の戦法や囲いを選択できます。組み合わせた盤面と解説は、中央と右側に表示されます。

## 開発

ビルド不要の静的サイトです。アプリは `index.html` をブラウザで開くか、静的ファイルサーバーで実行できます。

データ検証・単体テスト・ブラウザーUIチェックは、Node.js 20以降で次のように実行できます。UIチェックにはChromeまたはEdgeが必要です。

```sh
npm install
npm test
```

## ライセンス

本リポジトリの自作部分は [CC0 1.0 Universal](LICENSE) で公開しています。

- `js/vendor/three.min.js` はThree.js r152（MIT License）です。ライセンス全文は [`js/vendor/three.js.LICENSE.txt`](js/vendor/three.js.LICENSE.txt) を参照してください。
- Shippori Mincho B1、Zen Kaku Gothic New、Cormorant GaramondはGoogle Fontsから読み込みます。各フォントはSIL Open Font License 1.1で提供されています。
