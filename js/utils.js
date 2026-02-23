// utils.js
import { ROLES, MARK } from "./config.js";

/* ============
   乱数・共通
============ */
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function nowStamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ============
   スロット/マーク関連
============ */
export function getAliveSlotIndices(pl) {
  const res = [];
  for (let i = 0; i < pl.slots.length; i++) {
    if (!pl.slots[i].dead) res.push(i);
  }
  return res;
}

export function getGuardableSlotIndices(pl) {
  const res = [];
  for (let i = 0; i < pl.slots.length; i++) {
    const s = pl.slots[i];
    if (s.dead) continue;
    if (s.role === ROLES.GUARD) continue;
    if (s.role === ROLES.WOLF) continue;
    res.push(i);
  }
  return res;
}

export function getMark(slot) {
  if (!slot || !slot.publicSeer || !slot.publicSeer.last) return MARK.GRAY;
  return slot.publicSeer.last === "黒" ? MARK.BLACK : MARK.WHITE;
}

export function isRecentBiteFail(slot, currentBiteNo, avoidSpan = 2) {
  const bf = slot.biteFailCount || 0;
  const bt = slot.biteFailTurn;
  if (bf <= 0) return false;
  if (bt === null || typeof bt !== "number") return false;
  return currentBiteNo - bt <= avoidSpan;
}

/* ============
   公開占い（★占）判定
   game.publicSeerReveal[playerId] === slotIndex
============ */
export function isPublicSeerSlot(game, playerId, slotIndex) {
  return typeof game.publicSeerReveal[playerId] === "number"
    && game.publicSeerReveal[playerId] === slotIndex;
}

/* ============
   CPU選択ユーティリティ
============ */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickByMarkPriority(candidates, priority) {
  for (const m of priority) {
    const same = candidates.filter(x => getMark(x.slot) === m);
    if (same.length) return pickRandom(same);
  }
  return candidates.length ? pickRandom(candidates) : null;
}

export function pickByMarkPriorityWithTieBonus(candidates, priority, bonusFn) {
  for (const m of priority) {
    const same = candidates.filter(x => getMark(x.slot) === m);
    if (!same.length) continue;

    // 同ランク内はスコア最大（少しだけランダム混ぜる）
    let best = same[0];
    let bestScore = -1e18;
    for (const x of same) {
      const score = (bonusFn ? bonusFn(x) : 0) + Math.random() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = x;
      }
    }
    return best;
  }
  return candidates.length ? pickRandom(candidates) : null;
}

/* ============
   狂人の反転対象（あなたの最新版ルール）
   - 生存WOLFが2枚以上:
       村人 > 狂人 > 霊媒 > 狩人 > 占い > 人狼
   - 生存WOLFが1枚:
       人狼（確定）
============ */
export function cpuPickMadInvertIndexByWolfStock(actor) {
  const buckets = {
    VILLAGER: [],
    MAD: [],
    MEDIUM: [],
    GUARD: [],
    SEER: [],
    WOLF: [],
  };

  for (let i = 0; i < actor.slots.length; i++) {
    const s = actor.slots[i];
    if (s.dead) continue;

    if (s.role === ROLES.VILLAGER) buckets.VILLAGER.push(i);
    else if (s.role === ROLES.MAD) buckets.MAD.push(i);
    else if (s.role === ROLES.MEDIUM) buckets.MEDIUM.push(i);
    else if (s.role === ROLES.GUARD) buckets.GUARD.push(i);
    else if (s.role === ROLES.SEER) buckets.SEER.push(i);
    else if (s.role === ROLES.WOLF) buckets.WOLF.push(i);
  }

  const wolvesAlive = buckets.WOLF.length;

  if (wolvesAlive >= 2) {
    const order = ["VILLAGER", "MAD", "MEDIUM", "GUARD", "SEER", "WOLF"];
    for (const k of order) {
      if (buckets[k].length) return pickRandom(buckets[k]);
    }
    return null;
  }

  if (wolvesAlive === 1) {
    return buckets.WOLF[0];
  }

  return null;
}
