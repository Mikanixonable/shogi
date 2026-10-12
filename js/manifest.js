// スクリプト一覧: 読み込み順の唯一の定義（castles.html と tools/validate-castles.js が共有する）
window.Kakoi = window.Kakoi || {};
Kakoi.MANIFEST = (() => {
  const core = ['js/core/notation.js'];
  const data = ['js/data/sources.js', 'js/data/setups.js', 'js/data/castles-ibisha.js', 'js/data/castles-furibisha.js'];
  const logic = ['js/core/position.js', 'js/core/attack-map.js', 'js/core/validate.js'];
  const ui = [
    'js/ui/store.js', 'js/ui/segmented.js', 'js/ui/mini-board.js', 'js/ui/board-view.js',
    'js/ui/rail-view.js', 'js/ui/toolbar-view.js', 'js/ui/stage-view.js', 'js/ui/detail-view.js',
  ];
  const app = ['js/app.js'];
  return { core, data, logic, ui, app, order: [...core, ...data, ...logic, ...ui, ...app] };
})();
