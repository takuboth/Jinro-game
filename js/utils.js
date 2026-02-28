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
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

    let best = same[0];
    let bestScore = -1e18;
    for (const x of same) {
      const score = (bonusFn ? bonusFn(x) : 0) + Math.random() * 0.01;
      if (score > bestScore) { bestScore = score; best = x; }
    }
    return best;
  }
  return candidates.length ? pickRandom(candidates) : null;
}

/* ============
   狂人の反転対象（最新版）
============ */
export function cpuPickMadInvertIndexByWolfStock(actor) {
  const buckets = { VILLAGER:[], MAD:[], MEDIUM:[], GUARD:[], SEER:[], WOLF:[] };

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
    for (const k of order) if (buckets[k].length) return pickRandom(buckets[k]);
    return null;
  }

  if (wolvesAlive === 1) return buckets.WOLF[0];
  return null;
}

/* ============
   狩人の守り優先（あなたの最新版）
   通常：
     占い（未公開）＞狂人（未発動）＞霊媒＞狂人（発動済み）＝村人＞占い（公開）
   タイマン（生存プレイヤー2人）：
     占い（公開）＞占い（未公開）＞狂人（未発動）＞霊媒＞狂人（発動済み）＝村人
   ※同順位はランダム
============ */
export function cpuPickGuardIndex(game, actor) {
  const alivePlayers = game.players.filter(p => p.alive).length;
  const seerPublicIdx = game.publicSeerReveal[actor.id]; // number or null

  const cand = [];
  for (let i = 0; i < actor.slots.length; i++) {
    const s = actor.slots[i];
    if (s.dead) continue;
    if (s.role === ROLES.GUARD) continue;
    if (s.role === ROLES.WOLF) continue;
    cand.push(i);
  }
  if (!cand.length) return null;

  function rank(i){
    const s = actor.slots[i];
    const isSeer = s.role === ROLES.SEER;
    const isSeerPublic = isSeer && (typeof seerPublicIdx === "number") && seerPublicIdx === i;
    const isSeerUnpub  = isSeer && !isSeerPublic;

    if (alivePlayers === 2) {
      if (isSeerPublic) return 1;
      if (isSeerUnpub)  return 2;
      if (s.role === ROLES.MAD && !actor.madUsed) return 3;
      if (s.role === ROLES.MEDIUM) return 4;
      if (s.role === ROLES.MAD && actor.madUsed) return 5;
      if (s.role === ROLES.VILLAGER) return 5;
      return 9;
    }

    // 通常
    if (isSeerUnpub) return 1;
    if (s.role === ROLES.MAD && !actor.madUsed) return 2;
    if (s.role === ROLES.MEDIUM) return 3;
    if (s.role === ROLES.MAD && actor.madUsed) return 4;
    if (s.role === ROLES.VILLAGER) return 4;
    if (isSeerPublic) return 5;
    return 9;
  }

  let bestRank = 1e9;
  const best = [];
  for (const i of cand) {
    const r = rank(i);
    if (r < bestRank) { bestRank = r; best.length = 0; best.push(i); }
    else if (r === bestRank) best.push(i);
  }
  return best.length ? pickRandom(best) : null;
}
