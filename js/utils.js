import { CONFIG, ROLES, MARK, PUBLIC_KIND } from "./config.js";

export function nowStamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function roleChar(role) {
  if (role === ROLES.WOLF) return "狼";
  if (role === ROLES.SEER) return "占";
  if (role === ROLES.MAD) return "狂";
  if (role === ROLES.MEDIUM) return "霊";
  if (role === ROLES.GUARD) return "狩";
  return "村";
}

export function publicLabel(kind) {
  if (kind === PUBLIC_KIND.A) return "占A";
  if (kind === PUBLIC_KIND.B) return "占B";
  if (kind === PUBLIC_KIND.MEDIUM) return "霊";
  return "";
}

export function fullRevealPublicLabel(slot) {
  if (slot.publicKind === PUBLIC_KIND.A || slot.publicKind === PUBLIC_KIND.B) {
    return roleChar(slot.role);
  }
  if (slot.publicKind === PUBLIC_KIND.MEDIUM) return "霊";
  return "";
}

export function isWolf(role) {
  return role === ROLES.WOLF;
}

export function colorFromRole(role) {
  return isWolf(role) ? MARK.BLACK : MARK.WHITE;
}

export function isPublicSlot(slot) {
  return !!slot.isPublic;
}

export function isHiddenSlot(slot) {
  return !slot.isPublic;
}

export function getPublicSlotIndexByKind(player, kind) {
  const idx = player.slots.findIndex(s => s.isPublic && s.publicKind === kind);
  return idx >= 0 ? idx : null;
}

export function getAliveSlots(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead);
}

export function getAliveHiddenSlots(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && !x.slot.isPublic);
}

export function getAliveBiteTargets(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && x.slot.role !== ROLES.WOLF);
}

export function hasAliveRole(player, role) {
  return player.slots.some(s => !s.dead && s.role === role);
}

export function countAliveRole(player, role) {
  return player.slots.filter(s => !s.dead && s.role === role).length;
}

export function countAliveWolves(player) {
  return countAliveRole(player, ROLES.WOLF);
}

export function countAliveNonWolves(player) {
  return player.slots.filter(s => !s.dead && s.role !== ROLES.WOLF).length;
}

export function countAliveOpenAndHidden(player) {
  return player.slots.filter(s => !s.dead).length;
}

export function isLineAlive(player, kind) {
  const idx = getPublicSlotIndexByKind(player, kind);
  if (idx == null) return false;
  return !player.slots[idx].dead;
}

export function getLineRole(player, kind) {
  const idx = getPublicSlotIndexByKind(player, kind);
  if (idx == null) return null;
  return player.slots[idx].role;
}

export function getTrueLineKind(player) {
  const roleA = getLineRole(player, PUBLIC_KIND.A);
  if (roleA === ROLES.SEER) return PUBLIC_KIND.A;
  return PUBLIC_KIND.B;
}

export function getFakeLineKind(player) {
  return getTrueLineKind(player) === PUBLIC_KIND.A ? PUBLIC_KIND.B : PUBLIC_KIND.A;
}

export function sameTarget(a, b) {
  if (!a || !b) return false;
  return a.targetId === b.targetId && a.slotIndex === b.slotIndex;
}

export function makeEmptySeenMap() {
  return Array(CONFIG.slotCount).fill(false);
}

export function hiddenReserveCandidates(player, seenMap) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && !x.slot.isPublic && !seenMap[x.index]);
}

export function markScore(slot) {
  const a = slot.seerA;
  const b = slot.seerB;
  const m = slot.medium;

  const vals = [a, b, m];
  if (vals.includes(MARK.BLACK)) return 3;
  if (vals.includes(MARK.WHITE)) return 1;
  return 2;
}

export function pickCpuLynchTarget(player) {
  const alive = getAliveSlots(player);
  if (!alive.length) return null;

  let best = null;
  let bestScore = -999;
  for (const x of alive) {
    let score = 0;
    const s = x.slot;

    if (s.seerA === MARK.BLACK) score += 50;
    if (s.seerB === MARK.BLACK) score += 50;
    if (s.medium === MARK.BLACK) score += 30;

    if (s.seerA === MARK.WHITE) score -= 15;
    if (s.seerB === MARK.WHITE) score -= 15;
    if (s.medium === MARK.WHITE) score -= 10;

    if (s.isPublic) score -= 4;

    score += Math.random() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = x.index;
    }
  }
  return best;
}

export function pickCpuReserveTarget(player, seenMap) {
  const cands = hiddenReserveCandidates(player, seenMap);
  if (!cands.length) return null;

  let best = null;
  let bestScore = -999;
  for (const x of cands) {
    let score = 0;
    const s = x.slot;

    if (s.seerA === MARK.BLACK || s.seerB === MARK.BLACK || s.medium === MARK.BLACK) score += 40;
    else if (s.seerA === MARK.WHITE || s.seerB === MARK.WHITE || s.medium === MARK.WHITE) score -= 10;
    else score += 5;

    score += Math.random() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = x.index;
    }
  }
  return best;
}

export function pickCpuBiteTarget(player) {
  const cands = getAliveBiteTargets(player);
  if (!cands.length) return null;

  let best = null;
  let bestScore = -999;
  for (const x of cands) {
    let score = 0;
    const s = x.slot;

    if (s.seerA === MARK.WHITE) score += 35;
    if (s.seerB === MARK.WHITE) score += 35;
    if (s.medium === MARK.WHITE) score += 10;

    if (s.seerA === MARK.BLACK) score -= 20;
    if (s.seerB === MARK.BLACK) score -= 20;
    if (s.medium === MARK.BLACK) score -= 8;

    if (s.isPublic) score += 5;

    score += Math.random() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = x.index;
    }
  }
  return best;
}

export function pickCpuGuardTarget(rightPlayer, forbiddenSlotIndex) {
  const cands = rightPlayer.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && x.index !== forbiddenSlotIndex);

  if (!cands.length) return null;

  let best = null;
  let bestScore = -999;
  for (const x of cands) {
    let score = 0;
    const s = x.slot;

    if (s.seerA === MARK.WHITE) score += 20;
    if (s.seerB === MARK.WHITE) score += 20;
    if (s.medium === MARK.WHITE) score += 5;

    if (s.seerA === MARK.BLACK) score -= 15;
    if (s.seerB === MARK.BLACK) score -= 15;
    if (s.medium === MARK.BLACK) score -= 5;

    if (s.isPublic) score += 3;

    score += Math.random() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = x.index;
    }
  }
  return best;
}
