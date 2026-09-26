// 《溫室魔女的剪定日》房間與樓層：房間模板、樓層資料、門（下一個房間）的產生規則。
//
// 房間模板只寫「內部」（牆壁由程式加上）：
//   .＝地板　P＝花台（擋路）　o＝花盆（可打破）　~＝荊棘（會刺傷人與魔物）　w＝水窪（變慢）　x＝爆裂菇（打它會爆炸）
export const TILE = { FLOOR: 0, WALL: 1, PLANTER: 2, THORN: 3, WATER: 4 };

// 一般房間內部 22x11（加上牆＝24x14）
const ROOMS = [
  [ // 空曠
    '......................',
    '......................',
    '...o..............o...',
    '......................',
    '......................',
    '.........o..o.........',
    '......................',
    '......................',
    '...o..............o...',
    '......................',
    '......................',
  ],
  [ // 兩對花台
    '......................',
    '......................',
    '.....PPP......PPP.....',
    '.....PPP......PPP.....',
    '......................',
    '..o................o..',
    '......................',
    '.....PPP......PPP.....',
    '.....PPP......PPP.....',
    '......................',
    '......................',
  ],
  [ // 中央花島
    '......................',
    '......................',
    '..o................o..',
    '.........PPPP.........',
    '........PPPPPP........',
    '........PPPPPP........',
    '........PPPPPP........',
    '.........PPPP.........',
    '..o................o..',
    '......................',
    '......................',
  ],
  [ // 花圃長排
    '......................',
    '..PPPPP..PPPP..PPPPP..',
    '......................',
    '......................',
    '..o......x..x......o..',
    '......................',
    '......................',
    '..PPPPP..PPPP..PPPPP..',
    '......................',
    '......................',
    '......................',
  ],
  [ // 荊棘十字
    '......................',
    '..........~~..........',
    '..o.......~~.......o..',
    '..........~~..........',
    '......................',
    '.~~~~~..........~~~~~.',
    '......................',
    '..........~~..........',
    '..o.......~~.......o..',
    '..........~~..........',
    '......................',
  ],
  [ // 水窪
    '......................',
    '...www..........www...',
    '..wwwww........wwwww..',
    '...www..........www...',
    '......................',
    '.........o..o.........',
    '......................',
    '...www..........www...',
    '..wwwww........wwwww..',
    '...www..........www...',
    '......................',
  ],
  [ // 爆裂菇迴廊
    '......................',
    '..~~..............~~..',
    '..~~...o......o...~~..',
    '......................',
    '.....PP........PP.....',
    '.....PP...xx...PP.....',
    '.....PP........PP.....',
    '......................',
    '..~~...o......o...~~..',
    '..~~..............~~..',
    '......................',
  ],
  [ // 兩道矮牆
    '......................',
    '......................',
    'PPPPPPPP......PPPPPPPP',
    '......................',
    '....o......x.....o....',
    '......................',
    'PPPPPPPP......PPPPPPPP',
    '......................',
    '......................',
    '..........o...........',
    '......................',
  ],
  [ // 苗床
    '......................',
    '.PP..PP..PP..PP..PP...',
    '......................',
    '...o..............o...',
    '......~~~~~~~~~~......',
    '......................',
    '...x..............x...',
    '......................',
    '.PP..PP..PP..PP..PP...',
    '......................',
    '......................',
  ],
  [ // 斜向花台
    '......................',
    '..PP..................',
    '..PPP.........~~......',
    '...PPP........~~...o..',
    '......................',
    '..o.......ww..........',
    '..........ww.......o..',
    '......................',
    '......~~........PPP...',
    '..o...~~.........PPP..',
    '..................PP..',
  ],
];
// 特殊房間
const FOUNTAIN_ROOM = [
  '......................',
  '......................',
  '..o................o..',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '..o................o..',
  '......................',
  '......................',
];
const SHOP_ROOM = [
  '......................',
  '......................',
  '.o..................o.',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
];
// 守護者房間內部 28x14
const BOSS_ROOM = [
  '............................',
  '............................',
  '..o......................o..',
  '............................',
  '............................',
  '............................',
  '............................',
  '............................',
  '............................',
  '............................',
  '............................',
  '..o......................o..',
  '............................',
  '............................',
];

export const FLOORS = [
  { id: 'nursery', name: '苗圃區', en: '1F NURSERY', rooms: 6, pool: [['slime', 1], ['slime', 1], ['mushroom', 2], ['beetle', 3]], boss: 'slimeKing', bossName: '芽芽史萊姆王', song: 'floor1', seeds: 12 },
  { id: 'herb', name: '藥草園', en: '2F HERB GARDEN', rooms: 6, pool: [['slime', 1], ['bee', 1], ['bee', 1], ['mushroom', 2], ['cactus', 2], ['beetle', 3]], boss: 'queenBee', bossName: '女王蜂', song: 'floor2', seeds: 20 },
  { id: 'dome', name: '玻璃穹頂', en: '3F GLASS DOME', rooms: 7, pool: [['bee', 1], ['slime', 1], ['cactus', 2], ['mushroom', 2], ['snapper', 3], ['beetle', 3]], boss: 'rafflesia', bossName: '巨大食人花 拉芙蕾西亞', song: 'floor3', seeds: 35 },
];

export const ROOM_INFO = {
  battle: { name: '戰鬥' }, elite: { name: '強敵' }, fountain: { name: '泉水' }, shop: { name: '商店' }, boss: { name: '守護者' },
};
export const REWARD_INFO = {
  boon: { name: '祝福' }, rare: { name: '稀有祝福' }, coins: { name: '金幣' }, seeds: { name: '種子' }, heal: { name: '回復' }, upgrade: { name: '祝福升級' },
};

/** 把內部模板加上牆壁與門的位置，轉成地圖 */
export function buildRoom(inner, rng = Math.random) {
  const iw = inner[0].length, ih = inner.length;
  const MW = iw + 2, MH = ih + 3;
  const tiles = new Uint8Array(MW * MH);
  const pots = [], puffs = [];
  const flip = rng() < 0.5; // 左右鏡像，增加變化
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let t = TILE.FLOOR;
    if (y < 2 || y === MH - 1 || x === 0 || x === MW - 1) t = TILE.WALL;
    else {
      const row = inner[y - 2];
      const ch = row[flip ? iw - 1 - (x - 1) : x - 1];
      if (ch === 'P') t = TILE.PLANTER;
      else if (ch === '~') t = TILE.THORN;
      else if (ch === 'w') t = TILE.WATER;
      else if (ch === 'o') pots.push({ tx: x, ty: y });
      else if (ch === 'x') puffs.push({ tx: x, ty: y });
    }
    tiles[y * MW + x] = t;
  }
  // 門：頂牆上的三個位置（左、中、右），每扇門兩格寬
  const mid = Math.floor(MW / 2) - 1;
  const doorSlots = [Math.max(3, mid - 7), mid, Math.min(MW - 5, mid + 7)];
  const start = { tx: Math.floor(MW / 2), ty: MH - 3 };
  return { MW, MH, tiles, pots, puffs, doorSlots, start, at(tx, ty) { return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? TILE.WALL : tiles[ty * MW + tx]; } };
}

export function roomTemplate(type, rng = Math.random) {
  if (type === 'boss') return BOSS_ROOM;
  if (type === 'fountain') return FOUNTAIN_ROOM;
  if (type === 'shop') return SHOP_ROOM;
  return ROOMS[Math.floor(rng() * ROOMS.length)];
}

/** 下一個房間的選項（門） */
export function doorOptions(floorIdx, roomIdx, run, rng = Math.random) {
  const F = FLOORS[floorIdx];
  if (roomIdx >= F.rooms - 1) return [{ type: 'boss', reward: null }];
  const pool = [
    { type: 'battle', reward: 'boon', w: 5 },
    { type: 'battle', reward: 'coins', w: 3 },
    { type: 'battle', reward: 'seeds', w: 2 },
    { type: 'battle', reward: 'upgrade', w: roomIdx >= 1 && Object.keys(run.boons).length ? 2 : 0 },
    { type: 'elite', reward: 'rare', w: roomIdx >= 2 ? 2.5 : 0 },
    { type: 'fountain', reward: 'heal', w: roomIdx >= 2 && !run.usedFountain ? 2 : 0 },
    { type: 'shop', reward: null, w: roomIdx >= 1 && !run.usedShop ? 3 : 0 },
  ].filter(o => o.w > 0);
  const n = rng() < 0.45 ? 3 : 2;
  const out = [];
  // 樓層後段還沒去過商店時保證出現
  if (!run.usedShop && roomIdx >= F.rooms - 3) { out.push({ type: 'shop', reward: null }); }
  while (out.length < n && pool.length) {
    const tot = pool.reduce((s, o) => s + o.w, 0);
    let r = rng() * tot, k = 0;
    for (; k < pool.length; k++) { r -= pool[k].w; if (r <= 0) break; }
    const o = pool.splice(Math.min(k, pool.length - 1), 1)[0];
    if (out.some(x => x.type === o.type && x.reward === o.reward)) continue;
    if (o.type === 'shop' && out.some(x => x.type === 'shop')) continue;
    out.push({ type: o.type, reward: o.reward });
  }
  return out;
}

/** 一波敵人：依樓層與房間計算預算，從該樓層的魔物池挑選 */
export function waveEnemies(floorIdx, roomIdx, waveIdx, elite, rng = Math.random) {
  const F = FLOORS[floorIdx];
  let budget = 3 + floorIdx * 2.5 + roomIdx * 0.7 + waveIdx * 1.2;
  const out = [];
  if (elite && waveIdx === 0) { const [t] = F.pool[Math.floor(rng() * F.pool.length)]; out.push({ type: t === 'bee' ? 'beetle' : t, elite: true }); budget -= 4; }
  let guard = 0;
  while (budget > 0.5 && guard++ < 40) {
    const [t, c] = F.pool[Math.floor(rng() * F.pool.length)];
    if (c > budget + 0.5) continue;
    out.push({ type: t, elite: false });
    budget -= c;
  }
  return out;
}
