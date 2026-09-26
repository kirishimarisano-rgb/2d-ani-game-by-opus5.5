# 星屑遊樂場 ☆ STARDUST ARCADE

**二次元像素小遊戲合集。** 所有角色皆為原創，像素美術以程式定義像素繪製，音效以 Web Audio API 即時合成，不使用任何外部圖片或音檔。

## ▶ 開始遊玩

**https://kirishimarisano-rgb.github.io/2d-ani-game-by-opus5.5/**

首頁是像素風格的遊戲啟動器：點擊卡片即可進入遊戲，也可以用方向鍵／手把選擇、Enter／A 鍵進入。每款遊戲裡都有「遊戲選單」按鈕可以回到啟動器。

## 🎮 收錄遊戲

| 遊戲 | 類型 | 操作 | 連結 |
| --- | --- | --- | --- |
| 星織魔法少女 艾菈<br>STARLIGHT AIRA | 縱向捲軸彈幕射擊 | 鍵盤、觸控 | [遊玩](https://kirishimarisano-rgb.github.io/2d-ani-game-by-opus5.5/games/magical-shooter/) · [說明](games/magical-shooter/README.md) |

## ➕ 新增一款遊戲

1. 在 `games/<遊戲 id>/` 建立遊戲，入口為 `index.html`。
2. 在遊戲頁面的 `<body>` 內加入共用的返回按鈕：
   ```html
   <script src="../../shared/launcher-link.js"></script>
   ```
   遊玩中若怕誤觸，可呼叫 `PixelArcade.setBackVisible(false)` 暫時隱藏；`PixelArcade.goToLauncher()` 可用程式返回。
3. 在 [`games.json`](games.json) 的 `games` 陣列加入一筆資料——**啟動器只讀這份清單，不需要改任何程式**：
   ```json
   {
     "id": "my-game",
     "title": "遊戲名稱",
     "subtitle": "ENGLISH TITLE",
     "genre": "類型",
     "description": "一兩句簡介。",
     "path": "games/my-game/",
     "cover": "games/my-game/cover.png",
     "accent": "#5ef2d0",
     "controls": ["keyboard", "touch"]
   }
   ```
4. （選用）在 [`tools/make-covers.mjs`](tools/make-covers.mjs) 加入封面構圖後執行，產生 176×99 的像素封面；沒有封面時啟動器會自動畫一張替代封面。
5. 執行冒煙測試確認一切正常（見下方）。

### `games.json` 欄位

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | ✔ | 唯一識別字，建議與資料夾同名 |
| `title` | ✔ | 顯示名稱 |
| `genre` | ✔ | 類型 |
| `path` | ✔ | 入口路徑（相對於網站根目錄，以 `/` 結尾） |
| `subtitle` | | 英文或副標題 |
| `description` | | 卡片簡介 |
| `cover` | | 封面圖路徑（原生 176×99，卡片上以 2 倍整數放大） |
| `accent` | | 卡片強調色 |
| `controls` | | 支援的操作：`keyboard`、`touch`、`gamepad`、`mouse` |
| `highScoreKey` | | 遊戲存最高分用的 localStorage 鍵，啟動器會在卡片上顯示 |
| `badge` | | 封面左上角的小標籤（例如 `NEW`） |
| `concept` | | 原型專用：`loop`、`growth`、`feel`、`style` 四段概念摘要 |

清單分成 `games`（正式遊戲）與 `prototypes`（原型試玩）兩區，啟動器會分區顯示；某一區沒有項目時會自動隱藏。

## 🗂 專案結構

```
index.html              啟動器（讀取 games.json 產生卡片）
games.json              遊戲清單
shared/
  launcher-link.js      共用「返回遊戲選單」按鈕
  pixel-font.js         共用點陣字型（5×7、3×5）
games/
  magical-shooter/      星織魔法少女 艾菈（單一 index.html）
tools/
  smoke-test.mjs        冒煙測試
  make-covers.mjs       封面產生器
```

## 💻 本機開發

啟動器用 `fetch` 讀取 `games.json`，所以需要透過 HTTP 開啟（直接雙擊檔案會被瀏覽器擋下）：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

冒煙測試與封面產生器使用 [Playwright](https://playwright.dev/)：

```bash
npm install && npx playwright install chromium   # 第一次使用時
npm test             # 冒煙測試：逐一開啟啟動器、每款遊戲與原型並檢查
npm run covers       # 重新產生封面
```
