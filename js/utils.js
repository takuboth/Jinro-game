import { getSlotMark } from "./markUtils.js";
import { MARK_KEYS } from "./markKeys.js";
import {
  roleLabel,
  isWolfRole,
  countsAsWolf,
  canBeBitten,
  canGuardSelfTarget,
  isFoxRole,
} from "./roles.js";
import { CPU_RULES } from "./cpuRules.js";
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
  return roleLabel(role);
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
  return isWolfRole(role);
}

export function isFox(role) {
  return isFoxRole(role);
}

export function colorFromRole(role) {
  return isWolf(role) ? MARK.BLACK : MARK.WHITE;
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
    .filter(x => !x.slot.dead && canBeBitten(x.slot.role));
}

export function getAliveGuardTargets(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead);
}

export function hasAliveRole(player, role) {
  return player.slots.some(s => !s.dead && s.role === role);
}

export function countAliveRole(player, role) {
  return player.slots.filter(s => !s.dead && s.role === role).length;
}

export function countAliveWolves(player) {
  return player.slots.filter(s => !s.dead && countsAsWolf(s.role)).length;
}

export function countAliveNonWolves(player) {
  return player.slots.filter(s => !s.dead && !countsAsWolf(s.role)).length;
}

export function countAliveFoxes(player) {
  return player.slots.filter(s => !s.dead && isFox(s.role)).length;
}

export function isAnyFoxAlive(game) {
  return game.players.some(player => countAliveFoxes(player) > 0);
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

export function judgeLineTrust(player) {
  let trustA = 0;
  let trustB = 0;

  let fixedTrue = null;
  let fixedFalse = null;

  for (const slot of player.slots) {
    const a = getSlotMark(slot, MARK_KEYS.SEER_A);
    const b = getSlotMark(slot, MARK_KEYS.SEER_B);
    const m = getSlotMark(slot, MARK_KEYS.MEDIUM);

    const aBlack = a === MARK.BLACK;
    const aWhite = a === MARK.WHITE;
    const bBlack = b === MARK.BLACK;
    const bWhite = b === MARK.WHITE;
    const mBlack = m === MARK.BLACK;
    const mWhite = m === MARK.WHITE;

    if (m !== MARK.NONE) {
      const split = (aBlack && bWhite) || (aWhite && bBlack);

      if (split) {
        if (mBlack) {
          if (aBlack && bWhite) {
            fixedTrue = "A";
            fixedFalse = "B";
          } else if (bBlack && aWhite) {
            fixedTrue = "B";
            fixedFalse = "A";
          }
        } else if (mWhite) {
          if (aWhite && bBlack) {
            fixedTrue = "A";
            fixedFalse = "B";
          } else if (bWhite && aBlack) {
            fixedTrue = "B";
            fixedFalse = "A";
          }
        }
      }
    }

    if (mWhite) {
      const oneBlack = (aBlack ? 1 : 0) + (bBlack ? 1 : 0) === 1;
      if (oneBlack) {
        if (aBlack) {
          fixedTrue = "B";
          fixedFalse = "A";
        } else if (bBlack) {
          fixedTrue = "A";
          fixedFalse = "B";
        }
      }
    }

    if (mBlack) {
      const oneBlack = (aBlack ? 1 : 0) + (bBlack ? 1 : 0) === 1;
      if (oneBlack) {
        if (aBlack) trustA += 80;
        if (bBlack) trustB += 80;
      }
    }
  }

  if (fixedTrue === "A") {
    trustA = 1000;
    trustB = -1000;
  } else if (fixedTrue === "B") {
    trustA = -1000;
    trustB = 1000;
  }

  let trueLike = null;
  if (trustA > trustB) trueLike = "A";
  else if (trustB > trustA) trueLike = "B";

  return {
    trustA,
    trustB,
    trueLike,
    fixedTrue,
    fixedFalse,
  };
}

export function hasSplitWithLiveMedium(player) {
  if (!isLineAlive(player, PUBLIC_KIND.MEDIUM)) return false;

  return player.slots.some(slot => {
    const a = getSlotMark(slot, MARK_KEYS.SEER_A);
    const b = getSlotMark(slot, MARK_KEYS.SEER_B);
    return (
      (a === MARK.WHITE && b === MARK.BLACK) ||
      (a === MARK.BLACK && b === MARK.WHITE)
    );
  });
}

export function hasHighTrustSeer(player) {
  const trust = judgeLineTrust(player);
  if (trust.fixedTrue) return true;
  const diff = Math.abs(trust.trustA - trust.trustB);
  return diff >= 80;
}

export function getPreferredSeerKind(player) {
  const trust = judgeLineTrust(player);
  if (trust.trueLike === "A") return PUBLIC_KIND.A;
  if (trust.trueLike === "B") return PUBLIC_KIND.B;
  return null;
}

export function hasBlackReserve(player) {
  const trust = judgeLineTrust(player);

  return player.slots.some(slot => {
    if (slot.dead) return false;
    if (isFox(slot.role)) return false;

    const a = getSlotMark(slot, MARK_KEYS.SEER_A);
    const b = getSlotMark(slot, MARK_KEYS.SEER_B);

    const aBlack = a === MARK.BLACK;
    const bBlack = b === MARK.BLACK;

    // 確定黒
    if (aBlack && bBlack) return true;

    // 真占い寄りの単黒
    if (trust.trueLike === "A" && aBlack && !bBlack) return true;
    if (trust.trueLike === "B" && bBlack && !aBlack) return true;

    return false;
  });
}

export function classifySlotForLynch(slot, trust, mediumAlive = false) {
  const a = getSlotMark(slot, MARK_KEYS.SEER_A);
  const b = getSlotMark(slot, MARK_KEYS.SEER_B);

  const aBlack = a === MARK.BLACK;
  const aWhite = a === MARK.WHITE;
  const bBlack = b === MARK.BLACK;
  const bWhite = b === MARK.WHITE;

  const trueLike = trust.trueLike;

  if (isFox(slot.role)) return "FOX_HIT";

  if (aBlack && bBlack) return "CERT_BLACK";

  const isSplit = (aBlack && bWhite) || (aWhite && bBlack);
  if (isSplit) {
    if (mediumAlive) return "SPLIT_MEDIUM_ON";
    return "SPLIT_MEDIUM_OFF";
  }

  const blackCount = (aBlack ? 1 : 0) + (bBlack ? 1 : 0);
  const whiteCount = (aWhite ? 1 : 0) + (bWhite ? 1 : 0);

  if (blackCount === 1) {
    if (trueLike === "A" && aBlack) return "HALF_BLACK_HIGH";
    if (trueLike === "B" && bBlack) return "HALF_BLACK_HIGH";

    if (trueLike === "A" && bBlack) return "HALF_BLACK_LOW";
    if (trueLike === "B" && aBlack) return "HALF_BLACK_LOW";

    return "HALF_BLACK_FLAT";
  }

  if (blackCount === 0 && whiteCount === 0) return "GRAY";

  if (blackCount === 0 && whiteCount === 1) {
    if (trueLike === "A" && aWhite) return "HALF_WHITE_HIGH";
    if (trueLike === "B" && bWhite) return "HALF_WHITE_HIGH";

    if (trueLike === "A" && bWhite) return "HALF_WHITE_LOW";
    if (trueLike === "B" && aWhite) return "HALF_WHITE_LOW";

    return "HALF_WHITE_FLAT";
  }

  if (blackCount === 0 && whiteCount >= 2) return "CERT_WHITE";

  return "GRAY";
}

function pickByPriorityGroups(cands, classifyFn, priority, preferHidden = false) {
  for (const cls of priority) {
    const hits = cands.filter(x => classifyFn(x.slot, x) === cls);
    if (!hits.length) continue;

    if (preferHidden) {
      const hidden = hits.filter(x => !x.slot.isPublic);
      if (hidden.length) return pickRandom(hidden)?.index ?? null;
    }

    return pickRandom(hits)?.index ?? null;
  }

  return null;
}

export function pickCpuLynchTarget(player) {
  const alive = getAliveSlots(player);
  if (!alive.length) return null;

  const trust = judgeLineTrust(player);
  const mediumAlive = isLineAlive(player, PUBLIC_KIND.MEDIUM);

  const priority = [
    "CERT_BLACK",
    "SPLIT_MEDIUM_ON",
    "HALF_BLACK_HIGH",
    "HALF_BLACK_FLAT",
    "HALF_BLACK_LOW",
    "SPLIT_MEDIUM_OFF",
    "GRAY",
    "HALF_WHITE_LOW",
    "HALF_WHITE_FLAT",
    "HALF_WHITE_HIGH",
    "CERT_WHITE",
  ];

  return pickByPriorityGroups(
    alive,
    (slot) => classifySlotForLynch(slot, trust, mediumAlive),
    priority,
    true
  );
}

export function pickCpuReserveTarget(player, seenMap, otherReservedIndex = null) {
  const unseen = hiddenReserveCandidates(player, seenMap);
  if (!unseen.length) return null;

  const priority = [
    "GRAY",        // 最優先：未情報
    "HALF_BLACK",
    "HALF_WHITE",
    "CERT_WHITE",
  ];

  const classify = (slot) => {
    const a = getSlotMark(slot, MARK_KEYS.SEER_A);
    const b = getSlotMark(slot, MARK_KEYS.SEER_B);

    const blackCount = (a === MARK.BLACK ? 1 : 0) + (b === MARK.BLACK ? 1 : 0);
    const whiteCount = (a === MARK.WHITE ? 1 : 0) + (b === MARK.WHITE ? 1 : 0);

    if (blackCount === 0 && whiteCount === 0) return "GRAY";
    if (blackCount === 1) return "HALF_BLACK";
    if (blackCount === 0 && whiteCount === 1) return "HALF_WHITE";
    if (blackCount === 0 && whiteCount >= 2) return "CERT_WHITE";

    return "GRAY";
  };

  for (const cls of priority) {
    let hits = unseen.filter(x => classify(x.slot) === cls);
    if (!hits.length) continue;

    const noOverlap = hits.filter(x => x.index !== otherReservedIndex);
    if (noOverlap.length) hits = noOverlap;

    return pickRandom(hits)?.index ?? null;
  }

  return pickRandom(unseen)?.index ?? null;
}

function classifyProtectTarget(slot, trust) {
  const a = getSlotMark(slot, MARK_KEYS.SEER_A);
  const b = getSlotMark(slot, MARK_KEYS.SEER_B);

  const aBlack = a === MARK.BLACK;
  const aWhite = a === MARK.WHITE;
  const bBlack = b === MARK.BLACK;
  const bWhite = b === MARK.WHITE;

  const trueLike = trust.trueLike;

  if (slot.isPublic && (slot.publicKind === PUBLIC_KIND.A || slot.publicKind === PUBLIC_KIND.B)) {
    if (trueLike === "A" && slot.publicKind === PUBLIC_KIND.A) return "SEER_HIGH";
    if (trueLike === "B" && slot.publicKind === PUBLIC_KIND.B) return "SEER_HIGH";

    if (trueLike === "A" && slot.publicKind === PUBLIC_KIND.B) return "SEER_LOW";
    if (trueLike === "B" && slot.publicKind === PUBLIC_KIND.A) return "SEER_LOW";

    return "SEER_FLAT";
  }

  if (slot.isPublic && slot.publicKind === PUBLIC_KIND.MEDIUM) {
    return "MEDIUM";
  }

  if (isFox(slot.role)) return "FOX";

  if (aWhite && bWhite) return "CERT_WHITE";

  const blackCount = (aBlack ? 1 : 0) + (bBlack ? 1 : 0);
  const whiteCount = (aWhite ? 1 : 0) + (bWhite ? 1 : 0);

  if (blackCount === 0 && whiteCount === 1) return "HALF_WHITE";
  if (blackCount === 0 && whiteCount === 0) return "GRAY";
  if (blackCount === 1) return "HALF_BLACK";
  if (aBlack && bBlack) return "BLACK";

  return "GRAY";
}

function pickFromTopPriorityOnly(cands, classifyFn, priority) {
  for (const cls of priority) {
    const hits = cands.filter(x => classifyFn(x.slot, x) === cls);
    if (hits.length) {
      return pickRandom(hits)?.index ?? null;
    }
  }
  return null;
}

function getBitePriority(player, game) {
  if (game && isAnyFoxAlive(game)) {
    return CPU_RULES.BITE.FOX_ALIVE;
  }

  if (hasSplitWithLiveMedium(player)) {
    return CPU_RULES.BITE.SPLIT_MEDIUM;
  }

  if (hasHighTrustSeer(player)) {
    return CPU_RULES.BITE.HIGH_SEER;
  }

  return Math.random() < 0.5
    ? CPU_RULES.BITE.NORMAL_A
    : CPU_RULES.BITE.NORMAL_B;
}

function getGuardPriority(player) {
  if (hasSplitWithLiveMedium(player)) {
    return CPU_RULES.GUARD.SPLIT_MEDIUM;
  }

  if (hasHighTrustSeer(player)) {
    return CPU_RULES.GUARD.HIGH_SEER;
  }

  return Math.random() < 0.5
    ? CPU_RULES.GUARD.NORMAL_A
    : CPU_RULES.GUARD.NORMAL_B;
}

export function pickCpuBiteTarget(targetPlayer, game) {
  const cands = getAliveBiteTargets(targetPlayer);
  if (!cands.length) return null;

  const trust = judgeLineTrust(targetPlayer);

  const priority = [
    "MEDIUM",
    "SEER_HIGH",
    "SEER_FLAT",
    "CERT_WHITE",
    "HALF_WHITE",
    "GRAY",
    "HALF_BLACK",
    "BLACK",
  ];

  return pickFromTopPriorityOnly(
    cands,
    (slot) => classifyProtectTarget(slot, trust),
    priority
  );
}

export function pickCpuGuardTarget(targetPlayer, game) {
  const cands = getAliveGuardTargets(targetPlayer);
  if (!cands.length) return null;

  const trust = judgeLineTrust(targetPlayer);

  const priority = [
    "SEER_HIGH",
    "MEDIUM",
    "SEER_FLAT",
    "CERT_WHITE",
    "HALF_WHITE",
    "GRAY",
    "HALF_BLACK",
    "BLACK",
  ];

  return pickFromTopPriorityOnly(
    cands,
    (slot) => classifyProtectTarget(slot, trust),
    priority
  );
}
