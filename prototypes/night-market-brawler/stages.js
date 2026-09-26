// 《夜市拳姬》關卡資料：每條街道由數個「戰鬥區」組成，進入戰鬥區時鏡頭鎖定，清完所有波次才能繼續前進。
// waves：每一波的敵人種類；props：場景裡的塑膠椅（可撿起當武器）、垃圾桶與紙箱（打破會掉東西）。
export const STAGES = [
  {
    id: 'gate', name: '入口牌樓', en: 'MARKET GATE', style: 'gate', song: 'stage1', length: 1960,
    boss: 'bunnyBoss', bossName: '兔兔老大', bossX: 1790,
    tips: ['Z 連按：刺拳、刺拳、直拳、上勾拳', '上勾拳把敵人打飛後，可以在空中繼續追打', '連按兩下方向鍵奔跑，奔跑中按 Z 滑壘'],
    zones: [
      { x: 330, waves: [['trainee'], ['rabbit', 'rabbit']] },
      { x: 800, waves: [['rabbit', 'rabbit', 'rabbit'], ['rabbit', 'rabbit']] },
      { x: 1270, waves: [['rabbit', 'rabbit'], ['rabbit', 'bear']] },
    ],
    props: [['chair', 180, 150], ['trash', 470, 128], ['chair', 620, 160], ['crate', 1010, 140], ['trash', 1150, 130], ['chair', 1450, 150], ['crate', 1580, 160]],
  },
  {
    id: 'food', name: '小吃街', en: 'FOOD STREET', style: 'food', song: 'stage2', length: 2240,
    boss: 'bubbleTea', bossName: '珍奶巨人', bossX: 2060,
    tips: ['走進被打暈的敵人會抓住他：Z 膝擊，跳躍鍵把他丟出去', '狗狗投手會從遠處丟東西，繞到同一條線上再靠近'],
    zones: [
      { x: 330, waves: [['rabbit', 'rabbit', 'dog'], ['rabbit', 'rabbit']] },
      { x: 820, waves: [['bear', 'rabbit'], ['dog', 'dog', 'rabbit']] },
      { x: 1310, waves: [['rabbit', 'rabbit', 'rabbit'], ['bear', 'dog']] },
      { x: 1740, waves: [['rabbit', 'dog'], ['bear', 'rabbit', 'rabbit']] },
    ],
    props: [['crate', 200, 150], ['chair', 450, 135], ['trash', 600, 165], ['chair', 990, 150], ['crate', 1120, 125], ['trash', 1480, 150], ['chair', 1560, 160], ['crate', 1900, 140]],
  },
  {
    id: 'games', name: '遊戲攤', en: 'GAME ALLEY', style: 'games', song: 'stage3', length: 2400,
    boss: 'clawMachine', bossName: '夾娃娃機大王', bossX: 2220,
    tips: ['貓咪飛踢手會從遠處飛撲過來，看到牠蹲下就準備閃開', '必殺量表滿了按 V 施放「芒果冰暴風」'],
    zones: [
      { x: 330, waves: [['cat', 'rabbit'], ['cat', 'cat', 'rabbit']] },
      { x: 820, waves: [['dog', 'cat', 'rabbit'], ['bear', 'cat']] },
      { x: 1310, waves: [['rabbit', 'rabbit', 'cat', 'cat'], ['dog', 'dog', 'bear']] },
      { x: 1830, waves: [['cat', 'cat', 'cat'], ['bear', 'bear']] },
    ],
    props: [['chair', 190, 140], ['trash', 520, 160], ['crate', 700, 128], ['chair', 1020, 150], ['crate', 1180, 165], ['trash', 1560, 135], ['chair', 1660, 155], ['crate', 2030, 150]],
  },
  {
    id: 'temple', name: '廟口廣場', en: 'TEMPLE PLAZA', style: 'temple', song: 'stage4', length: 2560,
    boss: 'panda', bossName: '熊貓大仙', bossX: 2380,
    tips: ['熊貓大仙生氣時全身霸體，等牠打完的空檔再反擊', '這是最後的決戰了！'],
    zones: [
      { x: 330, waves: [['rabbit', 'cat', 'dog'], ['bear', 'rabbit', 'rabbit']] },
      { x: 840, waves: [['cat', 'cat', 'dog'], ['bear', 'bear', 'rabbit']] },
      { x: 1360, waves: [['dog', 'dog', 'cat', 'rabbit'], ['bear', 'cat', 'cat']] },
      { x: 1900, waves: [['rabbit', 'rabbit', 'rabbit', 'rabbit'], ['bear', 'dog', 'cat'], ['bear', 'bear']] },
    ],
    props: [['chair', 200, 150], ['crate', 520, 130], ['chair', 700, 160], ['trash', 1060, 140], ['chair', 1200, 125], ['crate', 1600, 160], ['trash', 1720, 135], ['chair', 2120, 150]],
  },
];
