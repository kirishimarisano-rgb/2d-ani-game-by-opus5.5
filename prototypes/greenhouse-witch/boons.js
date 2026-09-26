// 《溫室魔女的剪定日》祝福：每一輪清完房間後三選一，最多升到 Lv3。
// desc(lv) 回傳該等級的說明；實際效果寫在 world.js（用 boon(id) 取得等級）。
export const MAX_LV = 3;

export const BOONS = {
  vineDash: { name: '荊棘衝刺', desc: lv => `翻滾時沿路留下荊棘藤蔓，碰到的魔物受到 ${6 + lv * 4} 點傷害。` },
  crescent: { name: '新月剪', desc: lv => `連段最後一擊射出新月劍氣（${10 + lv * 8} 傷害）${lv >= 3 ? '，一次兩道' : ''}。` },
  pollen: { name: '花粉爆裂', desc: lv => `魔物倒下時爆炸，對周圍造成 ${10 + lv * 8} 點傷害，可以連鎖。` },
  honeyShield: { name: '蜂蜜護盾', desc: lv => `每個房間可以抵擋 ${lv} 次傷害。` },
  dew: { name: '朝露', desc: lv => `每清完一個房間回復 ${lv} 點體力。` },
  steelLeaf: { name: '鋼之葉', desc: lv => `所有攻擊傷害提高 ${lv * 20}%。` },
  longHandle: { name: '長柄', desc: lv => `揮擊範圍擴大 ${lv * 12}%。` },
  tailwind: { name: '順風', desc: lv => `移動速度提高 ${lv * 8}%，翻滾冷卻縮短 ${lv * 25}%。` },
  thornArmor: { name: '荊棘之衣', desc: lv => `受傷時放出尖刺，對周圍造成 ${lv * 20} 點傷害並擊退。` },
  sunflower: { name: '向日葵', desc: lv => `蓄力迴旋時放出擴散的日光環（${lv * 12} 傷害）。` },
  dandelion: { name: '蒲公英', desc: lv => `完美閃避時放出 ${2 + lv} 顆會追蹤的種子（各 10 傷害）。` },
  rootBind: { name: '根鬚纏繞', desc: lv => `攻擊有 ${lv * 15}% 機率讓魔物被根纏住 1.5 秒。` },
  fertilizer: { name: '撞擊肥料', desc: lv => `把魔物打去撞牆、撞人的傷害提高 ${lv * 50}%，撞擊時小爆炸。` },
  harvest: { name: '豐收', desc: lv => `金幣掉落增加 ${lv * 40}%，每清一個房間多得 ${lv} 顆種子。` },
  mint: { name: '薄荷清涼', desc: lv => `翻滾後 1 秒內的下一擊傷害提高 ${lv * 50}%。` },
  lifeBloom: { name: '生命之花', desc: lv => `最大體力 +${lv * 2}（取得時立刻回復）。` },
};
export const BOON_LIST = Object.keys(BOONS);

/** 三選一：優先給新的祝福，也會出現已有祝福的升級 */
export function boonChoices(owned, rare, rng = Math.random, n = 3) {
  const up = rare ? 2 : 1;
  const cands = BOON_LIST.filter(id => (owned[id] || 0) < MAX_LV);
  const out = [];
  const pool = [...cands];
  while (out.length < n && pool.length) {
    // 已有的祝福權重低一點
    const weights = pool.map(id => owned[id] ? 0.7 : 1.3);
    const tot = weights.reduce((a, b) => a + b, 0);
    let r = rng() * tot, k = 0;
    for (; k < pool.length - 1; k++) { r -= weights[k]; if (r <= 0) break; }
    const id = pool.splice(k, 1)[0];
    out.push({ id, from: owned[id] || 0, to: Math.min(MAX_LV, (owned[id] || 0) + up) });
  }
  return out;
}
