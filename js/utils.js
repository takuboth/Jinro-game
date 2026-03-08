import { ROLES, MARK } from "./config.js";

export function nowStamp(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

export function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

export function pickRandom(arr){
  if (!arr.length) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}

export function getAliveSlotIndices(pl){
  const out = [];
  for (let i=0;i<pl.slots.length;i++){
    if (!pl.slots[i].dead) out.push(i);
  }
  return out;
}

export function getGuardableSlotIndices(pl){
  const out = [];
  for (let i=0;i<pl.slots.length;i++){
    const s = pl.slots[i];
    if (s.dead) continue;
    if (s.role === ROLES.GUARD) continue;
    if (s.role === ROLES.WOLF) continue;
    out.push(i);
  }
  return out;
}

export function getMark(slot){
  const last = slot.publicSeer?.last ?? null; // "白" | "黒" | null
  if (last === "白") return MARK.WHITE;
  if (last === "黒") return MARK.BLACK;
  return MARK.GRAY;
}

export function isPublicSeerSlot(game, playerId, slotIndex){
  const idx = game.publicSeerReveal?.[playerId];
  return (typeof idx === "number") && idx === slotIndex;
}

// 噛み不発が「直近2回」以内か、みたいな判定用（今は雑に）
export function isRecentBiteFail(slot, currentBiteNo, within){
  if (!slot.biteFailTurn) return false;
  return (currentBiteNo - slot.biteFailTurn) <= within;
}

/* 優先順位で1つ選ぶ（同率は先頭） */
export function pickByMarkPriority(cands, order){
  for (const m of order){
    const hits = cands.filter(x => getMark(x.slot) === m);
    if (hits.length) return pickRandom(hits);
  }
  return pickRandom(cands);
}

/* 優先＋同率ボーナス（ランダム少し） */
export function pickByMarkPriorityWithTieBonus(cands, order, bonusFn){
  let best = null;
  let bestScore = -1;

  function baseScore(mark){
    const idx = order.indexOf(mark);
    return (idx === -1) ? 0 : (order.length - idx) * 10;
  }

  for (const c of cands){
    const score =
      baseScore(getMark(c.slot)) +
      (bonusFn ? bonusFn(c) : 0) +
      Math.random()*0.01;
    if (score > bestScore){
      bestScore = score;
      best = c;
    }
  }
  return best ?? cands[0];
}

/* CPUの雑ロジック */
export function cpuPickMadInvertIndexByWolfStock(actor){
  const alive = getAliveSlotIndices(actor);
  if (!alive.length) return null;

  const wolfAlive = alive.filter(i => actor.slots[i].role === ROLES.WOLF);
  const villagerAlive = alive.filter(i => actor.slots[i].role === ROLES.VILLAGER);
  const otherAlive = alive.filter(i => {
    const r = actor.slots[i].role;
    return r !== ROLES.WOLF && r !== ROLES.VILLAGER;
  });

  // 狼が2枚生きている間は、村人を黒に見せたい
  if (wolfAlive.length >= 2) {
    if (villagerAlive.length) return pickRandom(villagerAlive);
    if (otherAlive.length) return pickRandom(otherAlive);
    return pickRandom(wolfAlive);
  }

  // 狼が1枚になったら、その狼を白に見せたい
  if (wolfAlive.length === 1) {
    return wolfAlive[0];
  }

  return pickRandom(alive);
}

export function cpuPickGuardIndex(game, actor){
  const cand = getGuardableSlotIndices(actor).map(i => ({
    slotIndex: i,
    slot: actor.slots[i],
  }));
  if (!cand.length) return null;

  const publicCands = cand.filter(x => isPublicSeerSlot(game, actor.id, x.slotIndex));
  const nonPublicCands = cand.filter(x => !isPublicSeerSlot(game, actor.id, x.slotIndex));

  const alivePlayers = game.players.filter(p => p.alive).length;
  const isDuel = alivePlayers === 2;

  // タイマン時は公開占い優先
  if (isDuel) {
    if (publicCands.length) return pickRandom(publicCands).slotIndex;

    const pick = pickByMarkPriority(nonPublicCands, [MARK.WHITE, MARK.GRAY, MARK.BLACK]);
    return pick ? pick.slotIndex : null;
  }

  // 通常時は 白 > グレー > 公開占い
  const nonPublicPick = pickByMarkPriority(nonPublicCands, [MARK.WHITE, MARK.GRAY, MARK.BLACK]);
  if (nonPublicPick) return nonPublicPick.slotIndex;

  if (publicCands.length) return pickRandom(publicCands).slotIndex;

  return null;
}
