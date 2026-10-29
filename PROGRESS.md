# PROGRESS

## M0 規劃 — 完成
- PLAN.md、story/BIBLE.md（世界、角色說話方式、好感度系統、各路線大綱）、ART.md（32 色調色盤）

## M1 核心 — 完成
- `src/core/parser.ts`：劇本解析（標籤、指令、台詞、選項、條件、效果），解析時檢查跳轉目標
- `src/core/vm.ts`：純邏輯 VM，不碰 DOM
- `src/core/wrap.ts`：點陣字換行、避頭尾點、分頁
- `tests/branches.test.ts`：靜態檢查名稱＋窮舉分支，確認每個結局都能到達、沒有死路、沒有走不到的句子
