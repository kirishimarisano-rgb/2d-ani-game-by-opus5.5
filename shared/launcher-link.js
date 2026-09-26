/*
 * 星屑遊樂場 — 共用「返回遊戲選單」按鈕
 *
 * 用法：在遊戲頁面的 <body> 內加入
 *   <script src="../../shared/launcher-link.js"></script>
 * 啟動器的網址會依照這支腳本自己的位置推算（shared/ 的上一層），
 * 所以不論網站部署在哪個子路徑都能正確返回。
 *
 * 可選屬性：
 *   data-slot="#selector"  把按鈕放進指定容器（預設固定在畫面左上角）
 *   data-label="文字"       按鈕文字（預設「遊戲選單」）
 *
 * 提供給遊戲使用的 API：
 *   PixelArcade.setBackVisible(bool)  遊玩中可暫時隱藏，避免誤觸
 *   PixelArcade.goToLauncher()        以程式返回（例如在標題畫面按 Esc）
 *   PixelArcade.launcherUrl           啟動器網址
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var launcherUrl = new URL('../', script.src).href;
  var label = script.getAttribute('data-label') || '遊戲選單';
  var slotSel = script.getAttribute('data-slot');

  var css =
    '.pa-back{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;' +
    'font:700 13px/1 system-ui,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;' +
    'letter-spacing:.04em;color:#fff;background:#1b0f2e;padding:7px 10px 6px 8px;margin:4px;' +
    'text-decoration:none;cursor:pointer;user-select:none;-webkit-user-select:none;' +
    '-webkit-tap-highlight-color:transparent;' +
    /* 以四個方向的陰影做出「缺角」的像素邊框 */
    'box-shadow:0 -2px 0 0 #fff,0 2px 0 0 #fff,-2px 0 0 0 #fff,2px 0 0 0 #fff,4px 4px 0 0 rgba(0,0,0,.45);' +
    'transition:transform .06s steps(2),background-color .06s steps(2)}' +
    '.pa-back:hover{background:#ff5fa2}' +
    '.pa-back:active{transform:translate(2px,2px)}' +
    '.pa-back:focus-visible{outline:2px dashed #ffd94a;outline-offset:5px}' +
    '.pa-back[hidden]{display:none}' +
    '.pa-back svg{width:10px;height:10px;shape-rendering:crispEdges;flex:none}' +
    '.pa-back.pa-fixed{position:fixed;z-index:1000;' +
    'top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left))}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var a = document.createElement('a');
  a.className = 'pa-back';
  a.href = launcherUrl;
  a.title = '返回星屑遊樂場的遊戲選單';
  // 像素箭頭（5x5）
  a.innerHTML =
    '<svg viewBox="0 0 5 5" aria-hidden="true"><path fill="currentColor" ' +
    'd="M2 0h1v1H2zM1 1h1v1H1zM0 2h5v1H0zM1 3h1v1H1zM2 4h1v1H2z"/></svg>';
  a.appendChild(document.createTextNode(label));

  var slot = slotSel ? document.querySelector(slotSel) : null;
  if (slot) slot.appendChild(a);
  else { a.classList.add('pa-fixed'); document.body.appendChild(a); }

  window.PixelArcade = {
    launcherUrl: launcherUrl,
    backButton: a,
    setBackVisible: function (v) { if (a.hidden === !!v) a.hidden = !v; },
    goToLauncher: function () { location.href = launcherUrl; }
  };
})();
